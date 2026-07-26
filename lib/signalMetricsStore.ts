import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';

export interface SignalMetric {
  topic: string;
  volumeShare: number;
  sentimentTone: number;
  source: 'gdelt' | 'fallback';
  updatedAt: string; // ISO-8601
}

/**
 * Background-refresh cache for GDELT metrics.
 *
 * The cron job (app/api/cron/refresh-signals) upserts one metric per curated
 * topic on a schedule; the /api/signals route reads them for instant, live
 * data — decoupling the request path from GDELT's slow, rate-limited API.
 *
 * Durable via Supabase (table `signal_metrics`) when configured, so the cron
 * writer and the request reader share one source of truth across serverless
 * instances. Falls back to an in-memory map (per-process) for local dev — note
 * that on serverless the fallback is NOT shared between the cron and request
 * lambdas, so Supabase (or another shared store) is required for this to
 * actually surface live data in production.
 */
const TABLE = 'signal_metrics';

/** Stored metrics older than this are treated as stale and ignored (fall back to curated). */
export const SIGNAL_METRIC_TTL_MS = 24 * 60 * 60 * 1000; // 24h

const globalStore = globalThis as unknown as { __cloutSignalMetrics?: Map<string, SignalMetric> };
const mem: Map<string, SignalMetric> = globalStore.__cloutSignalMetrics ?? new Map();
globalStore.__cloutSignalMetrics = mem;

const keyFor = (topic: string) => topic.toLowerCase().trim();

function fromRow(row: any): SignalMetric {
  return {
    topic: row.topic,
    volumeShare: row.volume_share,
    sentimentTone: row.sentiment_tone,
    source: row.source ?? 'gdelt',
    updatedAt: row.updated_at,
  };
}

const isFresh = (m: SignalMetric): boolean =>
  Date.now() - Date.parse(m.updatedAt) < SIGNAL_METRIC_TTL_MS;

export async function upsertSignalMetric(
  metric: Omit<SignalMetric, 'updatedAt'> & { updatedAt?: string }
): Promise<void> {
  const updatedAt = metric.updatedAt ?? new Date().toISOString();
  if (isSupabaseConfigured()) {
    try {
      const { error } = await getSupabase().from(TABLE).upsert({
        topic: metric.topic,
        volume_share: Math.round(metric.volumeShare),
        sentiment_tone: metric.sentimentTone,
        source: metric.source,
        updated_at: updatedAt,
      });
      if (error) throw error;
      return;
    } catch (e) {
      console.warn('[signalMetricsStore] Supabase upsert failed, using memory:', (e as Error).message);
    }
  }
  mem.set(keyFor(metric.topic), { ...metric, updatedAt });
}

/** Fresh stored metric for a topic, or undefined when absent/stale. */
export async function getSignalMetric(topic: string): Promise<SignalMetric | undefined> {
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await getSupabase()
        .from(TABLE)
        .select('*')
        .eq('topic', topic)
        .maybeSingle();
      if (error) throw error;
      const m = data ? fromRow(data) : undefined;
      return m && isFresh(m) ? m : undefined;
    } catch (e) {
      console.warn('[signalMetricsStore] Supabase read failed, using memory:', (e as Error).message);
    }
  }
  const m = mem.get(keyFor(topic));
  return m && isFresh(m) ? m : undefined;
}

/** All fresh stored metrics, keyed by lowercased topic. */
export async function getSignalMetricsMap(): Promise<Map<string, SignalMetric>> {
  const out = new Map<string, SignalMetric>();
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await getSupabase().from(TABLE).select('*');
      if (error) throw error;
      for (const row of data ?? []) {
        const m = fromRow(row);
        if (isFresh(m)) out.set(keyFor(m.topic), m);
      }
      return out;
    } catch (e) {
      console.warn('[signalMetricsStore] Supabase list failed, using memory:', (e as Error).message);
    }
  }
  for (const [k, m] of mem) if (isFresh(m)) out.set(k, m);
  return out;
}
