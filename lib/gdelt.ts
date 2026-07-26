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
export async function fetchGdeltSignal(keyword: string): Promise<GdeltResult> {
  const cacheKey = `gdelt:${keyword.toLowerCase().trim()}`;
  const cached = getCached<GdeltResult>(cacheKey);
  if (cached) return cached;

  const encodedQuery = encodeURIComponent(`"${keyword}"`);
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodedQuery}&mode=TimelineTone&format=json`;

  try {
    // Fail fast to the fallback when GDELT is unreachable (don't retry timeouts /
    // network errors — the fallback is cheap). Still retry 429/5xx so rate limits
    // recover. Short timeout keeps the dashboard's first paint snappy.
    const res = await fetchWithRetry(url, {}, { timeoutMs: 4000, retryOnNetworkError: false });
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

export function calculateOpportunityScore(volumeShare: number, tone: number): number {
  const toneMultiplier = 1 + (Math.abs(tone) / 20);
  const rawScore = (volumeShare * 0.6) * toneMultiplier;
  return Math.min(99, Math.max(20, Math.round(rawScore)));
}
