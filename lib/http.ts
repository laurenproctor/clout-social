export interface RetryOptions {
  /** Max retry attempts after the first try (total attempts = retries + 1). */
  retries?: number;
  /** Base backoff in ms (grows exponentially). */
  baseDelayMs?: number;
  /** Cap on any single backoff delay. */
  maxDelayMs?: number;
  /** Per-attempt timeout in ms (AbortController). */
  timeoutMs?: number;
  /** Retry on 5xx responses. Disable for non-idempotent writes to avoid dupes. */
  retryOn5xx?: boolean;
  /** Retry when fetch throws (network error / timeout). Disable for non-idempotent writes. */
  retryOnNetworkError?: boolean;
}

// Defaults chosen to bound worst-case latency for UI-facing calls:
// 3 attempts × 8s timeout + backoff ≈ 25s ceiling for a fully-down service,
// while transient 429/5xx (fast responses) recover in ~1–2s.
const DEFAULTS: Required<RetryOptions> = {
  retries: 2,
  baseDelayMs: 400,
  maxDelayMs: 4000,
  timeoutMs: 8000,
  retryOn5xx: true,
  retryOnNetworkError: true,
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Exponential backoff with full jitter. */
function backoff(attempt: number, base: number, max: number): number {
  const exp = Math.min(max, base * 2 ** attempt);
  return Math.round(Math.random() * exp);
}

/** Honor a 429 `Retry-After` header (delta-seconds or HTTP-date); else backoff. */
function delayForResponse(res: Response, attempt: number, base: number, max: number): number {
  if (res.status === 429) {
    const header = res.headers.get('retry-after');
    if (header) {
      const secs = Number(header);
      if (Number.isFinite(secs)) return Math.min(max, secs * 1000);
      const dateMs = Date.parse(header);
      if (!Number.isNaN(dateMs)) return Math.min(max, Math.max(0, dateMs - Date.now()));
    }
  }
  return backoff(attempt, base, max);
}

/**
 * fetch() with per-attempt timeout and exponential-backoff retry on 429 and
 * (optionally) 5xx / network errors.
 *
 * 429 is ALWAYS retried (the request was rejected, so retrying is safe even for
 * writes). 5xx and network errors are retried only when `retryOn5xx` /
 * `retryOnNetworkError` are true — turn these OFF for non-idempotent POSTs
 * (e.g. creating a post) where a retry could duplicate the side effect.
 */
export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  options: RetryOptions = {}
): Promise<Response> {
  const opts = { ...DEFAULTS, ...options };
  let attempt = 0;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);

      const retryable =
        res.status === 429 || (opts.retryOn5xx && res.status >= 500 && res.status <= 599);

      if (retryable && attempt < opts.retries) {
        await sleep(delayForResponse(res, attempt, opts.baseDelayMs, opts.maxDelayMs));
        attempt++;
        continue;
      }
      return res;
    } catch (err) {
      clearTimeout(timer);
      if (opts.retryOnNetworkError && attempt < opts.retries) {
        await sleep(backoff(attempt, opts.baseDelayMs, opts.maxDelayMs));
        attempt++;
        continue;
      }
      throw err;
    }
  }
}
