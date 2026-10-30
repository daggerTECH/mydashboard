import { config } from '../config.js';

const store = new Map(); // key -> { value, expiresAt }

export function cacheGet(key) {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) { store.delete(key); return undefined; }
  return entry.value;
}

export function cacheSet(key, value, ttlSeconds = config.cache.ttlSeconds) {
  store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

export function cacheClear() {
  store.clear();
}

/** Wrap an async producer with caching, so callers don't repeat the get/set dance. */
export async function cached(key, producer, ttlSeconds) {
  const hit = cacheGet(key);
  if (hit !== undefined) return hit;
  const value = await producer();
  cacheSet(key, value, ttlSeconds);
  return value;
}
