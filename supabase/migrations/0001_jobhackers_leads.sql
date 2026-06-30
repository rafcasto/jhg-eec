-- Job Hackers — leads table used by the EEC landing page.
-- This documents the schema the app writes to via the REST API.
-- (Already present in the live project; included here for portability.)

do $$
begin
  if not exists (select 1 from pg_type where typname = 'lead_stage') then
    create type public.lead_stage as enum (
      'awareness', 'acquisition', 'activation', 'revenue', 'retention', 'referral'
    );
  end if;
end$$;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end$$;

create table if not exists public.jobhackers_leads (
  id uuid not null default gen_random_uuid (),
  first_name text not null,
  last_name text null,
  email text not null,
  stage public.lead_stage not null default 'acquisition'::lead_stage,
  tag text null,
  source text null,
  score integer not null default 0,
  archetype text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  location text null,
  phone text null,
  grade text null,
  obstacle text null,
  quiz_answers jsonb null,
  variant text null,
  constraint jobhackers_leads_pkey primary key (id),
  constraint jobhackers_leads_email_tag_stage_key
    unique nulls not distinct (email, tag, stage)
);

create index if not exists idx_jobhackers_leads_stage
  on public.jobhackers_leads using btree (stage);
create index if not exists idx_jobhackers_leads_source
  on public.jobhackers_leads using btree (source);

drop trigger if exists trg_jobhackers_leads_updated_at on public.jobhackers_leads;
create trigger trg_jobhackers_leads_updated_at
  before update on public.jobhackers_leads
  for each row execute function public.set_updated_at();
