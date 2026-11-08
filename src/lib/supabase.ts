import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Null when env vars are missing, so the app still runs on demo data at a
 * hackathon table with no wifi. Check for null before using.
 *
 * The database schema (tables, RLS demo policies, realtime, photo bucket) lives
 * in supabase/schema.sql. Run it once in the Supabase SQL editor.
 */
export const supabase = url && key ? createClient(url, key) : null;
