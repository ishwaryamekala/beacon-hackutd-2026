-- Beacon database schema.
--
-- Run the whole file in the Supabase SQL Editor (see docs/SUPABASE_SETUP.md).
-- Safe to re-run: every statement is idempotent.
--
-- DEMO POLICIES: the anon-role policies below are deliberately permissive so the
-- web app and the iMessage agent ("Beau") can both read and write during a
-- hackathon. Production would move all writes behind a server that holds the
-- service role key, and make these policies read-only for anon.

-- ---------------------------------------------------------------------------
-- reports: one row per obstacle reported on campus
-- ---------------------------------------------------------------------------
create table if not exists reports (
  id            uuid primary key default gen_random_uuid(),
  edge_from     text not null,
  edge_to       text not null,
  kind          text not null check (kind in ('broken','blocked','construction','crowded')),
  note          text,
  reported_by   text,
  source        text not null default 'web' check (source in ('web','imessage','sms','email')),
  photo_url     text,
  reported_at   timestamptz not null default now(),
  confirmations int not null default 1,
  disputes      int not null default 0,
  resolved      boolean not null default false
);

-- For databases created before these columns existed.
alter table reports add column if not exists note       text;
alter table reports add column if not exists source     text not null default 'web';
alter table reports add column if not exists photo_url  text;

alter table reports enable row level security;

drop policy if exists "demo: anon read reports"   on reports;
drop policy if exists "demo: anon insert reports" on reports;
drop policy if exists "demo: anon update reports" on reports;

create policy "demo: anon read reports"   on reports for select to anon using (true);
create policy "demo: anon insert reports" on reports for insert to anon with check (true);
create policy "demo: anon update reports" on reports for update to anon using (true) with check (true);

-- ---------------------------------------------------------------------------
-- subscribers: people who texted Beau and want route/obstacle alerts
-- ---------------------------------------------------------------------------
create table if not exists subscribers (
  id            uuid primary key default gen_random_uuid(),
  platform      text not null,
  handle        text not null,
  space_id      text not null,
  agent_user_id text not null,
  saved_from    text,
  saved_to      text,
  alerts        boolean not null default true,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  unique (platform, handle)
);

alter table subscribers enable row level security;

drop policy if exists "demo: anon read subscribers"   on subscribers;
drop policy if exists "demo: anon insert subscribers" on subscribers;
drop policy if exists "demo: anon update subscribers" on subscribers;

-- No anon policies on purpose: this table holds phone numbers / chat ids.
-- RLS with no policies = the public web key can't read it. Beau's server uses
-- SUPABASE_SERVICE_ROLE_KEY (server-only), which bypasses RLS.

-- ---------------------------------------------------------------------------
-- verification_asks: Beau asks a subscriber "is this still broken?" and records the answer
-- ---------------------------------------------------------------------------
create table if not exists verification_asks (
  id            uuid primary key default gen_random_uuid(),
  report_id     uuid not null references reports(id) on delete cascade,
  subscriber_id uuid not null references subscribers(id) on delete cascade,
  asked_at      timestamptz default now(),
  answer        text check (answer in ('yes','no')),
  answered_at   timestamptz
);

alter table verification_asks enable row level security;

drop policy if exists "demo: anon read verification_asks"   on verification_asks;
drop policy if exists "demo: anon insert verification_asks" on verification_asks;
drop policy if exists "demo: anon update verification_asks" on verification_asks;

-- No anon policies on purpose: this table holds phone numbers / chat ids.
-- RLS with no policies = the public web key can't read it. Beau's server uses
-- SUPABASE_SERVICE_ROLE_KEY (server-only), which bypasses RLS.

-- ---------------------------------------------------------------------------
-- Realtime: the website listens for changes to reports so a text from Beau
-- shows up on the map without a refresh. Skipped if already published.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'reports'
  ) then
    alter publication supabase_realtime add table reports;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Storage: public bucket for report photos
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('report-photos', 'report-photos', true)
on conflict do nothing;

drop policy if exists "demo: anon read report photos"   on storage.objects;
drop policy if exists "demo: anon upload report photos" on storage.objects;

create policy "demo: anon read report photos"
  on storage.objects for select to anon
  using (bucket_id = 'report-photos');

create policy "demo: anon upload report photos"
  on storage.objects for insert to anon
  with check (bucket_id = 'report-photos');
