-- Clout background-refresh cache for GDELT metrics.
--
-- GDELT's free DOC API throttles per-request calls from datacenter IPs
-- (1 req / 5s, ~9s latency), so it can't be called synchronously per dashboard
-- load. Instead a Vercel Cron job (app/api/cron/refresh-signals) fetches GDELT
-- for the curated topics one-at-a-time on a schedule and upserts the results
-- here; the /api/signals route reads this table for instant, live metrics.
--
-- Backs lib/signalMetricsStore.ts. Server-side access via the service-role key
-- only (bypasses RLS). Falls back to in-memory when Supabase isn't configured.

create table if not exists public.signal_metrics (
  topic          text primary key,
  volume_share   integer not null,
  sentiment_tone real not null,
  source         text not null default 'gdelt', -- 'gdelt' | 'fallback'
  updated_at     timestamptz not null default now()
);

create index if not exists signal_metrics_updated_at_idx on public.signal_metrics (updated_at desc);

-- Server-only access via the service-role key (which bypasses RLS). Enable RLS
-- with no public policies so the anon key cannot read/write this table.
alter table public.signal_metrics enable row level security;
