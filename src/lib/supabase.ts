import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Null when env vars are missing, so the app still runs on demo data at a
 * hackathon table with no wifi. Check for null before using.
 */
export const supabase = url && key ? createClient(url, key) : null;

export const SCHEMA_SQL = `
-- Run in Supabase SQL editor.
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  edge_from text not null,
  edge_to   text not null,
  kind      text not null check (kind in ('broken','blocked','construction','crowded')),
  note      text,
  reported_by text,
  reported_at timestamptz not null default now(),
  confirmations int not null default 0,
  disputes      int not null default 0,
  resolved   boolean not null default false
);
alter table reports enable row level security;
create policy "read all"   on reports for select using (true);
create policy "insert any" on reports for insert with check (true);
`;
