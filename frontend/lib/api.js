import { cached, invalidateAll } from './cache.js';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function getAuthHeaders() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}
// TTLs
const TTL_STATS      = 2 * 60 * 1000;  // 2 min  — cheap, changes after ingestion
const TTL_GRAPH      = 5 * 60 * 1000;  // 5 min  — expensive query
const TTL_SUSPICIOUS = 5 * 60 * 1000;  // 5 min  — expensive detection
const TTL_WALLET     = 3 * 60 * 1000;  // 3 min  — per-address, moderate cost

async function request(path, options = {}) {
  const url = `${API_URL}${path}`;
  const headers = {
    ...getAuthHeaders(),
    ...options.headers,
  };

  const res = await fetch(url, {
    ...options,
    headers,
  });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `API error: ${res.status}`);
  }

  return data;
}

// Auth functions
export async function login(username, password) {
  return request('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
}

export async function register(username, email, password) {
  return request('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password }),
  });
}

export async function getCurrentUser() {
  return request('/auth/me');
}

export async function logout() {
  return request('/auth/logout', { method: 'POST' });
}

export async function refreshToken() {
  return request('/auth/refresh', { method: 'POST' });
}

// User management functions
export async function getUsers({ skip = 0, limit = 50 } = {}) {
  return request(`/users?skip=${skip}&limit=${limit}`);
}

export async function getUser(username) {
  return request(`/users/${encodeURIComponent(username)}`);
}

export async function updateUser(username, updates) {
  return request(`/users/${encodeURIComponent(username)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
}

export async function deleteUser(username) {
  return request(`/users/${encodeURIComponent(username)}`, {
    method: 'DELETE',
  });
}

export async function banUser(username, is_banned) {
  return request(`/users/${encodeURIComponent(username)}/ban`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_banned }),
  });
}

// Logging functions
export async function logActivity(action, details = '') {
  return request('/logs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, details }),
  });
}

export async function getLogs({ skip = 0, limit = 100, username, action } = {}) {
  const params = new URLSearchParams({ skip, limit });
  if (username) params.set('username', username);
  if (action) params.set('action', action);
  return request(`/logs?${params.toString()}`);
}

export async function getSystemStats() {
  return request('/logs/stats/system');
}

// Settings functions
export async function getSettings() {
  return request('/settings');
}

export async function updateSettings(settings) {
  return request('/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
}

// Blockchain functions (existing)
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

export async function getGraph({ limit = 200, coinType, address, addresses, datasetId = 'shared' } = {}) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (coinType) params.set('coin_type', coinType);
  if (addresses && addresses.length > 0) {
    params.set('addresses', addresses.join(','));
  } else if (address) {
    params.set('address', address);
  }
  params.set('dataset_id', datasetId || 'shared');
  const qs = params.toString();
  return cached(`graph:${qs}`, () => request(`/graph?${qs}`), TTL_GRAPH);
}

export async function getSuspicious({ type = 'circular', threshold = 5, limit = 20, windowSeconds = 60, datasetId = 'shared' } = {}) {
  const params = new URLSearchParams({
    type,
    threshold: String(threshold),
    limit: String(limit),
    window: String(windowSeconds),
    dataset_id: datasetId || 'shared',
  });
  const qs = params.toString();
  return cached(`suspicious:${qs}`, () => request(`/suspicious?${qs}`), TTL_SUSPICIOUS);
}

export async function getRiskRanking({ limit = 50, datasetId = 'shared' } = {}) {
  const qs = `limit=${limit}&dataset_id=${encodeURIComponent(datasetId || 'shared')}`;
  return cached(`risk-ranking:${qs}`, () => request(`/suspicious/risk-ranking?${qs}`), TTL_SUSPICIOUS);
}

export async function getMyPreferences() {
  return request('/users/me/preferences');
}

export async function saveMyPreferences(preferences) {
  return request('/users/me/preferences', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(preferences),
  });
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
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method: 'POST',
    body: formData,
    headers,
  });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `Upload failed: ${res.status}`);
  }

  invalidateAll(); // new data ingested — fresh fetch on next navigation
  return data;
}

export async function uploadUserData(file, name) {
  const formData = new FormData();
  formData.append('file', file);

  const url = `${API_URL}/user/upload${name ? `?name=${encodeURIComponent(name)}` : ''}`;
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { method: 'POST', body: formData, headers });
  const data = await res.json();

  if (!res.ok) throw new Error(data.error || `Upload failed: ${res.status}`);
  return data;
}

export async function getUserDatasets() {
  return request('/user/datasets');
}

export async function deleteUserDataset(id) {
  return request(`/user/datasets/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
