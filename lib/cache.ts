interface CacheEntry<T> {
  value: T;
  expires: number; // epoch ms
}

/**
 * Process-wide TTL cache. Persists across Next.js dev hot-reloads via globalThis.
 * In production (serverless) it's per-instance — swap for Vercel KV / Upstash
 * Redis if you need a cache shared across function instances. The get/set/withCache
 * interface stays the same.
 */
const globalCache = globalThis as unknown as {
  __cloutCache?: Map<string, CacheEntry<unknown>>;
};
const cache: Map<string, CacheEntry<unknown>> = globalCache.__cloutCache ?? new Map();
globalCache.__cloutCache = cache;

export function getCached<T>(key: string): T | undefined {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return undefined;
  if (Date.now() > entry.expires) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
}

export function setCached<T>(key: string, value: T, ttlMs: number): void {
  cache.set(key, { value, expires: Date.now() + ttlMs });
}

export function clearCached(key: string): void {
  cache.delete(key);
}

/**
 * Read-through cache: return the cached value if fresh, otherwise run `fn`,
 * cache its result, and return it. Note: this caches whatever `fn` returns —
 * do NOT use it for functions that return a fallback on error, or the fallback
 * gets cached for the full TTL (cache successes only; see lib/gdelt.ts).
 */
export async function withCache<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = getCached<T>(key);
  if (hit !== undefined) return hit;
  const value = await fn();
  setCached(key, value, ttlMs);
  return value;
}
