/**
 * Lightweight in-memory TTL cache for API responses.
 *
 * Lives at module scope so it survives React unmount/remount cycles
 * (i.e. switching between tabs in the same session never re-fetches stale
 * data until the TTL expires or the cache is explicitly invalidated).
 */

const store = new Map(); // key → { value, expiresAt }

/**
 * Read a cached value. Returns `undefined` on miss or expiry.
 * @param {string} key
 */
export function get(key) {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return entry.value;
}

/**
 * Store a value with a TTL.
 * @param {string} key
 * @param {*} value
 * @param {number} ttlMs  Time-to-live in milliseconds (default 5 minutes)
 */
export function set(key, value, ttlMs = 5 * 60 * 1000) {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/**
 * Remove one specific key.
 * @param {string} key
 */
export function remove(key) {
  store.delete(key);
}

/**
 * Wipe the entire cache.
 * Call this after any mutation (upload, clear-database) so subsequent
 * reads reflect the new backend state.
 */
export function invalidateAll() {
  store.clear();
}

/**
 * Convenience: cache-aside wrapper.
 * Returns the cached value if present, otherwise calls `fetcher()`,
 * caches its result, and returns it.
 *
 * @param {string}   key
 * @param {Function} fetcher   Async function that returns fresh data
 * @param {number}   ttlMs
 */
export async function cached(key, fetcher, ttlMs) {
  const hit = get(key);
  if (hit !== undefined) return hit;
  const value = await fetcher();
  set(key, value, ttlMs);
  return value;
}
