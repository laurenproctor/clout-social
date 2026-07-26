import { getBigQuery, isBigQueryConfigured } from '@/lib/bigquery';
import type { GdeltResult } from '@/lib/gdelt';

export { isBigQueryConfigured };

/** Lookback window (days) for the GKG scan. Smaller = cheaper + more "current". */
const LOOKBACK_DAYS = 3;
/** Safety cap so a mis-scoped query can't run up cost (GKG is large). */
const MAX_BYTES_BILLED = String(25 * 1024 * 1024 * 1024); // 25 GB

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/**
 * Map a raw GKG article count to the 15–100 volumeShare scale the UI expects.
 * Log-scaled so both niche and mainstream topics land on a sensible spread.
 */
function toVolumeShare(count: number): number {
  if (count <= 0) return 15;
  return clamp(Math.round(Math.log10(count + 1) * 22), 15, 100);
}

/**
 * Fetch volume + average tone for each topic from GDELT's GKG dataset in
 * BigQuery, in a SINGLE query (conditional aggregation) so the partitioned
 * table is scanned once regardless of topic count. Matches a topic when its
 * lowercased phrase appears in the article's extracted names or themes.
 *
 * Returns one GdeltResult per input topic (same order). A topic with zero
 * coverage comes back with live=false so callers keep their curated metrics.
 * Never throws — on any BigQuery error it returns all-fallback results.
 */
export async function fetchGdeltMetricsBQ(topics: string[]): Promise<GdeltResult[]> {
  const fallback = (): GdeltResult[] =>
    topics.map((t) => ({ topic: t, volumeShare: 55, sentimentTone: 3.4, live: false }));

  if (!isBigQueryConfigured() || topics.length === 0) return fallback();

  // Build per-topic conditional aggregates with named params kw0..kwN.
  const params: Record<string, unknown> = { days: LOOKBACK_DAYS };
  const selects = topics
    .map((topic, i) => {
      params[`kw${i}`] = `%${topic.toLowerCase().trim()}%`;
      return `COUNTIF(hay LIKE @kw${i}) AS vol${i}, AVG(IF(hay LIKE @kw${i}, tone, NULL)) AS tone${i}`;
    })
    .join(',\n    ');

  const query = `
    WITH base AS (
      SELECT
        LOWER(CONCAT(IFNULL(AllNames, ''), ' ', IFNULL(V2Themes, ''))) AS hay,
        SAFE_CAST(SPLIT(V2Tone, ',')[SAFE_OFFSET(0)] AS FLOAT64) AS tone
      FROM \`gdelt-bq.gdeltv2.gkg_partitioned\`
      WHERE _PARTITIONTIME >= TIMESTAMP(DATE_SUB(CURRENT_DATE(), INTERVAL @days DAY))
    )
    SELECT
    ${selects}
    FROM base
  `;

  try {
    const [rows] = await getBigQuery().query({
      query,
      params,
      types: { days: 'INT64' },
      maximumBytesBilled: MAX_BYTES_BILLED,
    });
    const row = rows?.[0] ?? {};

    return topics.map((topic, i) => {
      const count = Number(row[`vol${i}`] ?? 0);
      const rawTone = row[`tone${i}`];
      if (!count) return { topic, volumeShare: 55, sentimentTone: 3.4, live: false };
      const tone = rawTone == null ? 0 : Number(Number(rawTone).toFixed(1));
      return { topic, volumeShare: toVolumeShare(count), sentimentTone: tone, live: true };
    });
  } catch (err) {
    console.warn('[gdeltBigquery] query failed, returning fallback:', (err as Error).message);
    return fallback();
  }
}
