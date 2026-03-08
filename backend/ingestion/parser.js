import Papa from 'papaparse';

const REQUIRED_FIELDS = [
  'wallet_from',
  'wallet_to',
  'amount',
  'timestamp',
  'coin_type',
  'transaction_id',
];

// BigQuery Ethereum transaction schema field names
const BIGQUERY_FIELDS = ['transaction_hash', 'from_address', 'block_timestamp'];

function isBigQuerySchema(row) {
  return BIGQUERY_FIELDS.every((f) => f in row);
}

// Convert a BigQuery row to internal format.
// value is in Wei (1 ETH = 1e18 Wei).
function normalizeBigQueryRow(row) {
  let amount = 0;
  const valStr = String(row.value || '0').trim();
  // parseFloat handles all formats: integers, decimals, and scientific notation
  // (e.g. BigQuery numeric exports like 1.5E+16 Wei).  BigInt would silently
  // truncate "1.5E+16" to "1" Wei, producing 0 ETH displayed.
  const weiFloat = parseFloat(valStr);
  amount = isNaN(weiFloat) ? 0 : weiFloat / 1e18;

  // block_timestamp may be a Unix epoch (integer) or ISO string
  let timestamp = String(row.block_timestamp || '').trim();
  if (/^\d+$/.test(timestamp)) {
    timestamp = new Date(parseInt(timestamp, 10) * 1000).toISOString();
  }

  // Preserve value_lossless (raw Wei string) for 3D graph Z-axis mapping
  const valueLossless = String(row.value_lossless || row.value || '0').trim();

  return {
    wallet_from: String(row.from_address || '').trim(),
    wallet_to: String(row.to_address || '').trim(),
    amount,
    value_lossless: valueLossless,
    timestamp,
    coin_type: 'ETH',
    transaction_id: String(row.transaction_hash || '').trim(),
  };
}

export function parseCSV(text) {
  const result = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  if (result.errors.length > 0) {
    const critical = result.errors.filter((e) => e.type === 'FieldMismatch' || e.type === 'Quotes');
    if (critical.length > 0) {
      throw new Error(`CSV parse error: ${critical[0].message} (row ${critical[0].row})`);
    }
  }

  return validateTransactions(result.data);
}

export function parseJSON(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON format');
  }

  if (!Array.isArray(data)) {
    throw new Error('JSON must be an array of transaction objects');
  }

  // Normalize keys to lowercase
  data = data.map((row) => {
    const normalized = {};
    for (const [key, value] of Object.entries(row)) {
      normalized[key.trim().toLowerCase()] = value;
    }
    return normalized;
  });

  return validateTransactions(data);
}

function validateTransactions(rows) {
  if (rows.length === 0) {
    throw new Error('File contains no transaction records');
  }

  // Auto-detect BigQuery schema from the first non-empty row
  const sample = rows.find((r) => Object.keys(r).length > 0) || rows[0];
  const isBigQuery = isBigQuerySchema(sample);

  const errors = [];
  const validated = [];

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    const rowNum = i + 1;

    const row = isBigQuery ? normalizeBigQueryRow(raw) : raw;

    // Skip rows with no to_address (contract creation) when using BigQuery schema
    if (isBigQuery && !row.wallet_to) {
      continue;
    }

    const missing = REQUIRED_FIELDS.filter((f) => !row[f] && row[f] !== 0);

    if (missing.length > 0) {
      errors.push(`Row ${rowNum}: missing fields: ${missing.join(', ')}`);
      if (errors.length >= 10) {
        errors.push(`...and potentially more errors (stopped checking at 10)`);
        break;
      }
      continue;
    }

    const amount = parseFloat(row.amount);
    if (isNaN(amount) || amount < 0) {
      errors.push(`Row ${rowNum}: invalid amount "${row.amount}"`);
      continue;
    }

    validated.push({
      wallet_from: String(row.wallet_from).trim(),
      wallet_to: String(row.wallet_to).trim(),
      amount,
      value_lossless: String(row.value_lossless || row.amount || '0').trim(),
      timestamp: String(row.timestamp).trim(),
      coin_type: String(row.coin_type).trim().toUpperCase(),
      transaction_id: String(row.transaction_id).trim(),
    });
  }

  if (errors.length > 0 && validated.length === 0) {
    throw new Error(`All rows failed validation:\n${errors.join('\n')}`);
  }

  return { transactions: validated, errors, totalRows: rows.length };
}

export function detectFormat(filename) {
  const ext = filename.toLowerCase().split('.').pop();
  if (ext === 'csv') return 'csv';
  if (ext === 'json') return 'json';
  return null;
}
