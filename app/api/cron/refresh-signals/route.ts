import { NextResponse } from 'next/server';
import { fetchGdeltSignalsSequential } from '@/lib/gdelt';
import { upsertSignalMetric } from '@/lib/signalMetricsStore';
import { MOCK_SIGNALS } from '@/lib/mockSignals';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// ~6 topics × ~5.5s spacing + ~9s latency each → keep well under the limit.
export const maxDuration = 120;

/**
 * GET /api/cron/refresh-signals
 *
 * Background refresh of the curated topics' GDELT metrics. Vercel Cron invokes
 * this on a schedule (see vercel.json). It fetches GDELT one-at-a-time (spaced
 * to respect the 1-req/5s rate limit) and upserts results into signal_metrics,
 * so /api/signals can serve live data instantly without touching GDELT.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer $CRON_SECRET` when CRON_SECRET
 * is set on the project. We require it in production; if unset (local dev), the
 * endpoint is open so you can trigger a refresh by hand.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const topics = MOCK_SIGNALS.map((s) => s.topic);
  const startedAt = new Date().toISOString();

  try {
    const results = await fetchGdeltSignalsSequential(topics);

    let refreshed = 0;
    let live = 0;
    await Promise.all(
      results.map(async (r) => {
        // Only persist genuine GDELT hits; a fallback result would poison the
        // cache with the uniform offline value and mask the real curated metrics.
        if (!r.live) return;
        await upsertSignalMetric({
          topic: r.topic,
          volumeShare: r.volumeShare,
          sentimentTone: r.sentimentTone,
          source: 'gdelt',
        });
        refreshed++;
        live++;
      })
    );

    return NextResponse.json({
      ok: true,
      startedAt,
      finishedAt: new Date().toISOString(),
      topics: topics.length,
      refreshed,
      live,
      persisted: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL ? 'supabase' : 'memory',
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: (err as Error).message || 'refresh failed', startedAt },
      { status: 500 }
    );
  }
}
