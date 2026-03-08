import { cached, invalidateAll } from './cache.js';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

// TTLs
const TTL_STATS      = 2 * 60 * 1000;  // 2 min  — cheap, changes after ingestion
const TTL_GRAPH      = 5 * 60 * 1000;  // 5 min  — expensive query
const TTL_SUSPICIOUS = 5 * 60 * 1000;  // 5 min  — expensive detection
const TTL_WALLET     = 3 * 60 * 1000;  // 3 min  — per-address, moderate cost

async function request(path, options = {}) {
  const url = `${API_URL}${path}`;
  const res = await fetch(url, options);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `API error: ${res.status}`);
  }

  return data;
}

export async function getStats() {
  return cached('stats', () => request('/stats'), TTL_STATS);
}

export async function getWallet(address, { skip = 0, limit = 50 } = {}) {
  const key = `wallet:${address}:${skip}:${limit}`;
  return cached(key, () => request(`/wallet/${encodeURIComponent(address)}?skip=${skip}&limit=${limit}`), TTL_WALLET);
}

export async function getTransactionPath(from, to) {
  // Paths are cheap and query-specific — cache briefly (30 s) to avoid
  // double-firing on StrictMode double-invokes but not stale for long.
  const key = `path:${from}:${to}`;
  return cached(key, () => request(`/transactions/path?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`), 30 * 1000);
}

export async function getGraph({ limit = 200, coinType, address } = {}) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (coinType) params.set('coin_type', coinType);
  if (address) params.set('address', address);
  const qs = params.toString();
  return cached(`graph:${qs}`, () => request(`/graph?${qs}`), TTL_GRAPH);
}

export async function getSuspicious({ type = 'circular', threshold = 5, limit = 20, windowSeconds = 60 } = {}) {
  const params = new URLSearchParams({
    type,
    threshold: String(threshold),
    limit: String(limit),
    window: String(windowSeconds),
  });
  const qs = params.toString();
  return cached(`suspicious:${qs}`, () => request(`/suspicious?${qs}`), TTL_SUSPICIOUS);
}

export async function clearDatabase() {
  const result = await request('/clear-database', { method: 'DELETE' });
  invalidateAll(); // stale data — nuke everything
  return result;
}

export async function uploadTransactions(file) {
  const formData = new FormData();
  formData.append('file', file);

  const url = `${API_URL}/upload-transactions`;
  const res = await fetch(url, {
    method: 'POST',
    body: formData,
  });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `Upload failed: ${res.status}`);
  }

  invalidateAll(); // new data ingested — fresh fetch on next navigation
  return data;
}
