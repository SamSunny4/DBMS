const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

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
  return request('/stats');
}

export async function getWallet(address, { skip = 0, limit = 50 } = {}) {
  return request(`/wallet/${encodeURIComponent(address)}?skip=${skip}&limit=${limit}`);
}

export async function getTransactionPath(from, to) {
  return request(
    `/transactions/path?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
  );
}

export async function getGraph({ limit = 200, coinType, address } = {}) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (coinType) params.set('coin_type', coinType);
  if (address) params.set('address', address);
  return request(`/graph?${params.toString()}`);
}

export async function getSuspicious({ type = 'circular', threshold = 5, limit = 20, windowSeconds = 60 } = {}) {
  const params = new URLSearchParams({
    type,
    threshold: String(threshold),
    limit: String(limit),
    window: String(windowSeconds),
  });
  return request(`/suspicious?${params.toString()}`);
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

  return data;
}
