import { LifecycleStage, SignalItem } from '@/types';
import { calculateOpportunityScore, fetchGdeltSignal } from '@/lib/gdelt';
import { MOCK_SIGNALS } from '@/lib/mockSignals';

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
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

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

/**
 * Live signals for a search keyword: query GDELT for the keyword + related
 * facets in parallel and build a SignalItem per facet. fetchGdeltSignal is
 * cached, retried, and falls back internally, so this never rejects.
 */
export interface BuiltSignals {
  signals: SignalItem[];
  /** true when at least one topic's metrics came from GDELT (not fallback). */
  live: boolean;
}

export async function buildLiveSignals(keyword: string): Promise<BuiltSignals> {
  const facets = relatedFacets(keyword);
  const results = await Promise.all(facets.map((facet) => fetchGdeltSignal(facet)));
  const live = results.some((r) => r.live);

  const seen = new Set<string>();
  const signals = results
    .map((g) => buildSignal(g.topic, g))
    .filter((s) => (seen.has(s.id) ? false : (seen.add(s.id), true)))
    .sort((a, b) => b.opportunityScore - a.opportunityScore);

  return { signals, live };
}

/**
 * Default heatmap: the curated topics enriched with LIVE GDELT metrics
 * (volume, tone, opportunity score) while keeping their rich narrative fields.
 */
export async function buildEnrichedDefaults(): Promise<BuiltSignals> {
  const results = await Promise.all(
    MOCK_SIGNALS.map(async (base) => {
      const g = await fetchGdeltSignal(base.topic);
      // GDELT down → keep the topic's rich curated metrics (graceful degradation),
      // rather than overwriting every tile with the uniform offline fallback.
      if (!g.live) return { signal: base, live: false };

      const volumeShare = Math.round(g.volumeShare);
      const sentimentTone = g.sentimentTone;
      return {
        signal: {
          ...base,
          volumeShare,
          sentimentTone,
          opportunityScore: calculateOpportunityScore(volumeShare, sentimentTone),
        },
        live: true,
      };
    })
  );

  return { signals: results.map((r) => r.signal), live: results.some((r) => r.live) };
}
