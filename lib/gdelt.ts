import { getCached, setCached } from '@/lib/cache';
import { fetchWithRetry } from '@/lib/http';

const GDELT_TTL_MS = 30 * 60 * 1000; // 30-minute cache to avoid rate limiting

export interface GdeltResult {
  topic: string;
  volumeShare: number;
  sentimentTone: number;
  /** true when the data came from GDELT; false when the fallback was used. */
  live: boolean;
}

/** Deterministic fallback used when GDELT is unreachable/rate-limited (never cached). */
function gdeltFallback(keyword: string): GdeltResult {
  return { topic: keyword, volumeShare: 55, sentimentTone: 3.4, live: false };
}

/**
 * Fetch a topic's news volume + tone from GDELT.
 *
 * Resilience:
 *  - 30-minute in-memory cache keyed by keyword (only successful results are
 *    cached) so heavy dashboard usage doesn't hammer GDELT and trip rate limits.
 *  - retry with exponential backoff on 429/5xx and an 8s per-attempt timeout so
 *    a slow/hung GDELT can't block the request indefinitely.
 *  - tolerant parsing (GDELT returns HTML error pages on some failures) with a
 *    deterministic fallback that is intentionally NOT cached, so the next call
 *    re-attempts GDELT once it recovers.
 */
/** GDELT allows ~1 request / 5s per IP; space sequential calls by this much. */
export const GDELT_MIN_SPACING_MS = 5500;

export interface FetchGdeltOptions {
  /**
   * Per-attempt timeout. GDELT's real latency is ~9s from datacenter IPs, so
   * the default is generous. Callers on the request hot-path can lower it.
   */
  timeoutMs?: number;
  /** Skip the 30-min cache read (the cron always wants a fresh fetch). */
  skipCache?: boolean;
}

export async function fetchGdeltSignal(
  keyword: string,
  options: FetchGdeltOptions = {}
): Promise<GdeltResult> {
  const { timeoutMs = 12000, skipCache = false } = options;
  const cacheKey = `gdelt:${keyword.toLowerCase().trim()}`;
  if (!skipCache) {
    const cached = getCached<GdeltResult>(cacheKey);
    if (cached) return cached;
  }

  const encodedQuery = encodeURIComponent(`"${keyword}"`);
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodedQuery}&mode=TimelineTone&format=json`;

  try {
    // GDELT is slow (~9s) and rate-limits with 429 + Retry-After, so use a
    // generous timeout and let fetchWithRetry back off on 429 (it always
    // retries 429 and honors Retry-After). Don't retry network errors/timeouts —
    // the fallback is cheap and we don't want to stack multi-second waits.
    const res = await fetchWithRetry(url, {}, { timeoutMs, retries: 2, retryOnNetworkError: false });
    if (!res.ok) throw new Error(`GDELT query failed: ${res.status}`);

    // GDELT sometimes returns an HTML error page with a 200 — guard JSON parse.
    const data = await res.json().catch(() => null);
    if (!data) throw new Error('GDELT returned a non-JSON response');

    const timeline: Array<{ value?: number }> = data?.timeline?.[0]?.data ?? [];
    const avgTone =
      timeline.length > 0
        ? timeline.reduce((sum, item) => sum + (Number(item?.value) || 0), 0) / timeline.length
        : 0;

    const result: GdeltResult = {
      topic: keyword,
      volumeShare: Math.min(100, Math.max(15, timeline.length * 4)),
      sentimentTone: Number(avgTone.toFixed(1)),
      live: true,
    };

    setCached(cacheKey, result, GDELT_TTL_MS); // cache successes only
    return result;
  } catch (error) {
    console.warn(`GDELT fetch error for "${keyword}", returning fallback:`, (error as Error).message);
    return gdeltFallback(keyword);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Fetch GDELT metrics for several topics SEQUENTIALLY, spacing calls by
 * ~5.5s to respect GDELT's "1 request / 5s" rate limit. Used by the cron
 * refresh job — never call this on the request hot-path (it takes
 * topics.length × ~5.5s). Always fetches fresh (skips the cache).
 */
export async function fetchGdeltSignalsSequential(topics: string[]): Promise<GdeltResult[]> {
  const results: GdeltResult[] = [];
  for (let i = 0; i < topics.length; i++) {
    if (i > 0) await sleep(GDELT_MIN_SPACING_MS);
    results.push(await fetchGdeltSignal(topics[i], { skipCache: true }));
  }
  return results;
}

export function calculateOpportunityScore(volumeShare: number, tone: number): number {
  const toneMultiplier = 1 + (Math.abs(tone) / 20);
  const rawScore = (volumeShare * 0.6) * toneMultiplier;
  return Math.min(99, Math.max(20, Math.round(rawScore)));
}
