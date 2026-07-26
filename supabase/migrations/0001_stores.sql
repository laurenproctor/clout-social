-- Clout durable stores. Run in the Supabase SQL editor (or `supabase db push`).
-- These tables back lib/postTagStore.ts and lib/postStatusStore.ts so the
-- publish, webhook, analytics, and queue routes share state across serverless
-- instances. Accessed server-side with the service-role key only.

-- Signal provenance recorded at publish time (topic → post → Opportunity Score).
create table if not exists public.post_tags (
  post_id           text primary key,
  topic             text not null,
  opportunity_score integer not null,
  platform          text,
  created_at        timestamptz not null default now()
);

-- Webhook-driven post status (published / failed / needs re-auth, etc.).
create table if not exists public.post_status (
  post_id      text primary key,
  status       text not null,
  platform     text,
  error        text,
  needs_reauth boolean not null default false,
  updated_at   timestamptz not null default now()
);

create index if not exists post_tags_created_at_idx on public.post_tags (created_at desc);
create index if not exists post_status_updated_at_idx on public.post_status (updated_at desc);

-- Server-only access via the service-role key (which bypasses RLS). Enable RLS
-- with no public policies so the anon key cannot read/write these tables.
alter table public.post_tags enable row level security;
alter table public.post_status enable row level security;
