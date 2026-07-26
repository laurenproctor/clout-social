import { LifecycleStage, SignalItem } from '@/types';
import { calculateOpportunityScore, fetchGdeltSignal } from '@/lib/gdelt';
import { fetchGdeltMetricsBQ, isBigQueryConfigured } from '@/lib/gdeltBigquery';
import { getSignalMetric, getSignalMetricsMap } from '@/lib/signalMetricsStore';
import { MOCK_SIGNALS } from '@/lib/mockSignals';
import { slug } from '@/lib/slug';

/** Map GDELT volume share to a lifecycle stage (magnitude-based heuristic). */
function deriveLifecycle(volumeShare: number): LifecycleStage {
  if (volumeShare >= 80) return 'peaking';
  if (volumeShare >= 60) return 'rising';
  if (volumeShare >= 35) return 'emerging';
  return 'declining';
}

const AUTHORITY_WINDOW: Record<LifecycleStage, string> = {
  emerging: '6-10 days',
  rising: '5-9 days',
  peaking: '2-4 days',
  declining: '1-3 days',
};

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** Per-platform virality prediction derived from the opportunity score. */
function derivePredictions(opportunityScore: number) {
  const d = (delta: number) => clamp(opportunityScore + delta, 40, 96);
  return {
    linkedin: d(6),
    blog: d(9),
    tiktok: d(-4),
    instagram: d(-7),
    youtube: d(2),
  };
}

/** Build a full SignalItem from GDELT metrics, deriving the non-GDELT fields. */
export function buildSignal(
  topic: string,
  gdelt: { volumeShare: number; sentimentTone: number }
): SignalItem {
  const volumeShare = Math.round(gdelt.volumeShare);
  const sentimentTone = gdelt.sentimentTone;
  const opportunityScore = calculateOpportunityScore(volumeShare, sentimentTone);
  const lifecycle = deriveLifecycle(volumeShare);

  return {
    id: slug(topic) || topic,
    topic,
    volumeShare,
    sentimentTone,
    lifecycle,
    opportunityScore,
    authorityWindowDays: AUTHORITY_WINDOW[lifecycle],
    confidenceRating: clamp(60 + Math.round(volumeShare * 0.3), 60, 95),
    predictions: derivePredictions(opportunityScore),
    strategicWhy: {
      moves: `"${topic}" is accelerating across global news coverage, reshaping how audiences discover and evaluate the space.`,
      matters: `Brands that stake a clear point of view on ${topic} now will own the narrative before it saturates.`,
      whitespace: `Few competitors have published a structured, opinionated framework on ${topic}.`,
    },
    strongestAngles: [
      `What ${topic} changes for your 2026 strategy`,
      `The metrics most teams get wrong about ${topic}`,
      `A practical playbook for acting on ${topic} this quarter`,
    ],
  };
}

/** The keyword expanded into a small set of related facets for the heatmap. */
export function relatedFacets(keyword: string): string[] {
  const k = keyword.trim();
  return [k, `${k} marketing`, `${k} strategy`, `${k} B2B`, `${k} trends`];
}

export interface BuiltSignals {
  signals: SignalItem[];
  /** true when at least one topic's metrics came from GDELT (not fallback). */
  live: boolean;
}

/** Small deterministic per-facet deltas so the heatmap shows a spread without extra GDELT calls. */
const FACET_VOLUME_DELTA = [0, -8, -5, -12, -3];
const FACET_TONE_DELTA = [0, 0.4, -0.6, 0.2, -0.3];

/**
 * Live signals for a search keyword. GDELT rate-limits to ~1 request / 5s per
 * IP, so we make a SINGLE live GDELT call for the keyword (checking the
 * background-refresh cache first) and derive the related facets deterministically
 * from it — never fanning out N parallel calls (which guarantees 429s).
 * fetchGdeltSignal falls back internally, so this never rejects.
 */
export async function buildLiveSignals(keyword: string): Promise<BuiltSignals> {
  const cached = await getSignalMetric(keyword);
  let primary: { topic: string; volumeShare: number; sentimentTone: number; live: boolean };
  if (cached) {
    primary = { topic: keyword, volumeShare: cached.volumeShare, sentimentTone: cached.sentimentTone, live: true };
  } else if (isBigQueryConfigured()) {
    // BigQuery works from Vercel's IP (GDELT's HTTP API does not).
    primary = (await fetchGdeltMetricsBQ([keyword]))[0];
  } else {
    primary = await fetchGdeltSignal(keyword);
  }

  const facets = relatedFacets(keyword);
  const seen = new Set<string>();
  const signals = facets
    .map((facet, i) => {
      const volumeShare = clamp(Math.round(primary.volumeShare + (FACET_VOLUME_DELTA[i] ?? 0)), 15, 100);
      const sentimentTone = Number((primary.sentimentTone + (FACET_TONE_DELTA[i] ?? 0)).toFixed(1));
      return buildSignal(facet, { volumeShare, sentimentTone });
    })
    .filter((s) => (seen.has(s.id) ? false : (seen.add(s.id), true)))
    .sort((a, b) => b.opportunityScore - a.opportunityScore);

  return { signals, live: primary.live };
}

/**
 * Default heatmap: the curated topics overlaid with LIVE GDELT metrics from the
 * background-refresh cache (signal_metrics), keeping their rich narrative fields.
 * Reads the shared store — it never calls GDELT on the request path (the cron
 * does that). Topics without fresh cached metrics keep their curated values.
 */
export async function buildEnrichedDefaults(): Promise<BuiltSignals> {
  const metrics = await getSignalMetricsMap();
  let live = false;

  const signals = MOCK_SIGNALS.map((base) => {
    const m = metrics.get(base.topic.toLowerCase().trim());
    if (!m) return base; // no fresh cache → keep curated metrics (graceful degradation)
    live = true;
    const volumeShare = Math.round(m.volumeShare);
    const sentimentTone = m.sentimentTone;
    return {
      ...base,
      volumeShare,
      sentimentTone,
      opportunityScore: calculateOpportunityScore(volumeShare, sentimentTone),
    };
  });

  return { signals, live };
}
