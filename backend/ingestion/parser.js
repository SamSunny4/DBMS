import Papa from 'papaparse';

const REQUIRED_FIELDS = [
  'wallet_from',
  'wallet_to',
  'amount',
  'timestamp',
  'coin_type',
  'transaction_id',
];

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

  const errors = [];
  const validated = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;
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
