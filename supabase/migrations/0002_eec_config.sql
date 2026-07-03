-- Job Hackers — editable A/B / landing-page config for the /admin panel.
--
-- On serverless hosts (Vercel) the app filesystem is read-only, so the config
-- can't be saved to data/eec-config.json. It is stored here instead: a single
-- row (id = 'default') holding the whole ABConfig as JSONB.
--
-- Run once in the Supabase SQL editor, or via `supabase db push`.

create table if not exists public.eec_config (
  id text primary key default 'default',
  config jsonb not null,
  updated_at timestamptz not null default now()
);
