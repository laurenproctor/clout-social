import {
  AnalyticsSummary,
  PlatformLeaderboard,
  SocialPlatform,
  TopicAnalytics,
} from '@/types';
import { MOCK_SIGNALS } from '@/lib/mockSignals';
import { getPostAnalytics } from '@/lib/zernio';
import { getPostTags } from '@/lib/postTagStore';

// Platforms carried on each signal's `predictions` map.
const PLATFORMS: SocialPlatform[] = ['linkedin', 'tiktok', 'instagram', 'youtube', 'blog'];

// Relative audience reach per platform (drives modeled impression volume).
const PLATFORM_REACH: Record<SocialPlatform, number> = {
  tiktok: 1.8,
  instagram: 1.5,
  linkedin: 1.0,
  youtube: 0.9,
  blog: 0.5,
  twitter: 1.2,
};

/** Stable integer hash so modeled numbers don't jump between requests. */
function hash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h;
}
/** Deterministic delta in [-range, +range] from a key. */
function stableDelta(key: string, range = 18): number {
  return (hash(key) % (range * 2 + 1)) - range;
}

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

/**
 * Signal Accuracy Rating: how closely the initial GDELT Opportunity Score
 * predicted the post's actual engagement. 100 = perfect prediction.
 */
export function signalAccuracy(opportunityScore: number, engagementIndex: number): number {
  return Math.round(clamp(100 - Math.abs(opportunityScore - engagementIndex)));
}

/** Model an engagement row for a signal/platform (used when no live data exists). */
function modelRow(
  topic: string,
  platform: SocialPlatform,
  opportunityScore: number,
  volumeShare: number,
  prediction: number
): TopicAnalytics {
  const engagementIndex = clamp(prediction + stableDelta(`${topic}:${platform}`), 2, 99);
  const impressions = Math.round(volumeShare * 800 * (PLATFORM_REACH[platform] ?? 1));
  const engagementRate = Number(((engagementIndex / 100) * 7.5).toFixed(2)); // 0–7.5%
  const engagements = Math.round((impressions * engagementRate) / 100);
  const clicks = Math.round(engagements * 0.65);
  const shares = Math.max(0, engagements - clicks);

  return {
    topic,
    platform,
    opportunityScore,
    impressions,
    clicks,
    shares,
    engagementRate,
    engagementIndex,
    signalAccuracy: signalAccuracy(opportunityScore, engagementIndex),
  };
}

/** Convert a real engagement rate into a 0-100 index (7.5% ≈ ceiling). */
function rateToIndex(engagementRate: number): number {
  return clamp(Math.round((engagementRate / 7.5) * 100), 0, 100);
}

/**
 * Build the analytics summary. Attempts real Zernio analytics for published
 * posts that can be matched to a known signal topic; otherwise models the
 * engagement from each signal's platform predictions so the dashboard and the
 * Signal Accuracy Rating are demonstrable. Rows are always keyed to a topic's
 * initial Opportunity Score.
 */
export async function buildAnalytics(): Promise<AnalyticsSummary> {
  const rows: TopicAnalytics[] = [];
  let usedLive = false;

  // ── Real path: posts tagged at publish time → join their Zernio analytics to
  // the signal's initial Opportunity Score (accurate provenance, no guessing). ──
  const tags = await getPostTags();
  const livePostsFound = tags.length;

  for (const tag of tags) {
    try {
      const a = await getPostAnalytics(tag.postId);
      const engagementIndex = rateToIndex(a.engagementRate);
      rows.push({
        topic: tag.topic,
        platform: (tag.platform ?? 'linkedin') as SocialPlatform,
        opportunityScore: tag.opportunityScore,
        impressions: a.impressions,
        clicks: a.clicks,
        shares: a.shares,
        engagementRate: a.engagementRate,
        engagementIndex,
        signalAccuracy: signalAccuracy(tag.opportunityScore, engagementIndex),
      });
      usedLive = true;
    } catch {
      /* skip tagged posts whose analytics can't be fetched yet */
    }
  }

  // ── Fallback: model engagement from each signal's platform predictions ──
  if (rows.length === 0) {
    for (const s of MOCK_SIGNALS) {
      for (const platform of PLATFORMS) {
        const prediction = (s.predictions as unknown as Record<string, number>)[platform];
        if (prediction == null) continue;
        rows.push(modelRow(s.topic, platform, s.opportunityScore, s.volumeShare, prediction));
      }
    }
  }

  const totals = rows.reduce(
    (acc, r) => ({
      impressions: acc.impressions + r.impressions,
      clicks: acc.clicks + r.clicks,
      shares: acc.shares + r.shares,
    }),
    { impressions: 0, clicks: 0, shares: 0 }
  );

  const overallSignalAccuracy = rows.length
    ? Math.round(rows.reduce((sum, r) => sum + r.signalAccuracy, 0) / rows.length)
    : 0;

  // Leaderboards: per platform, topics ranked by engagement rate.
  const leaderboards: PlatformLeaderboard[] = PLATFORMS.map((platform) => ({
    platform,
    rows: rows
      .filter((r) => r.platform === platform)
      .sort((a, b) => b.engagementRate - a.engagementRate),
  })).filter((lb) => lb.rows.length > 0);

  return {
    source: usedLive ? 'zernio' : 'sample',
    generatedAt: new Date().toISOString(),
    livePostsFound,
    totals,
    overallSignalAccuracy,
    topics: rows.sort((a, b) => b.engagementRate - a.engagementRate),
    leaderboards,
  };
}
