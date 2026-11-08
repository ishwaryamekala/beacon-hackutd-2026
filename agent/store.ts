// Beau's server-side data layer.
//
// Same Supabase project as the website, so a report texted to Beau lands on
// the web map in real time and a report filed on the web can trigger alerts
// over iMessage. Uses the SERVICE ROLE key because `subscribers` holds phone
// numbers and is deliberately invisible to the public web key.
//
// With no Supabase configured everything falls back to memory, so the agent
// still demos on bad conference wifi.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Obstacle } from "../src/lib/graph";

const URL = process.env.VITE_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const db: SupabaseClient | null = URL && KEY ? createClient(URL, KEY) : null;

export type Source = "web" | "imessage" | "sms" | "email";

export interface Subscriber {
  id: string;
  platform: string;
  handle: string;
  space_id: string;
  agent_user_id: string;
  saved_from: string | null;
  saved_to: string | null;
  alerts: boolean;
}

type ReportRow = {
  id: string; edge_from: string; edge_to: string; kind: Obstacle["kind"];
  note: string | null; source: Source; photo_url: string | null;
  reported_at: string; confirmations: number; disputes: number; resolved: boolean;
  reported_by: string | null;
};

const toObstacle = (r: ReportRow): Obstacle => ({
  id: r.id, edgeFrom: r.edge_from, edgeTo: r.edge_to, kind: r.kind,
  reportedAt: new Date(r.reported_at).getTime(),
  confirmations: r.confirmations, disputes: r.disputes, resolved: r.resolved,
  note: r.note ?? undefined, source: r.source, photoUrl: r.photo_url ?? undefined,
});

// ---- memory fallback -------------------------------------------------------
const mem = {
  reports: [] as (Obstacle & { reportedBy?: string })[],
  subscribers: [] as Subscriber[],
  asks: [] as { id: string; report_id: string; subscriber_id: string; answer: string | null }[],
};
const uid = () => (globalThis.crypto?.randomUUID?.() ?? `m_${Date.now()}_${Math.random()}`);

// ---- reports ---------------------------------------------------------------
export async function openReports(): Promise<Obstacle[]> {
  if (!db) return mem.reports.filter((r) => !r.resolved);
  const { data, error } = await db.from("reports").select("*").eq("resolved", false);
  if (error) throw error;
  return (data as ReportRow[]).map(toObstacle);
}

export async function reportsSince(sinceIso: string): Promise<(Obstacle & { reportedBy?: string })[]> {
  if (!db) return mem.reports.filter((r) => r.reportedAt > Date.parse(sinceIso));
  const { data, error } = await db
    .from("reports").select("*").gt("reported_at", sinceIso).eq("resolved", false)
    .order("reported_at", { ascending: true });
  if (error) throw error;
  return (data as ReportRow[]).map((r) => ({ ...toObstacle(r), reportedBy: r.reported_by ?? undefined }));
}

export async function insertReport(r: {
  edgeFrom: string; edgeTo: string; kind: Obstacle["kind"];
  note?: string; source: Source; photoUrl?: string; reportedBy?: string;
}): Promise<Obstacle> {
  if (!db) {
    const o = {
      id: uid(), edgeFrom: r.edgeFrom, edgeTo: r.edgeTo, kind: r.kind, note: r.note,
      source: r.source, photoUrl: r.photoUrl, reportedAt: Date.now(),
      confirmations: 1, disputes: 0, resolved: false, reportedBy: r.reportedBy,
    };
    mem.reports.push(o);
    return o;
  }
  const { data, error } = await db.from("reports").insert({
    edge_from: r.edgeFrom, edge_to: r.edgeTo, kind: r.kind, note: r.note ?? null,
    source: r.source, photo_url: r.photoUrl ?? null, reported_by: r.reportedBy ?? null,
  }).select().single();
  if (error) throw error;
  return toObstacle(data as ReportRow);
}

/** Confirm or dispute. Net -2 resolves it: the community says it's gone. */
export async function voteReport(id: string, agrees: boolean) {
  let r: { confirmations: number; disputes: number } | undefined;
  if (!db) {
    const m = mem.reports.find((x) => x.id === id);
    if (!m) return null;
    agrees ? m.confirmations++ : m.disputes++;
    m.resolved = m.confirmations - m.disputes <= -2;
    r = m;
  } else {
    const { data } = await db.from("reports").select("confirmations,disputes").eq("id", id).single();
    if (!data) return null;
    const confirmations = data.confirmations + (agrees ? 1 : 0);
    const disputes = data.disputes + (agrees ? 0 : 1);
    await db.from("reports").update({
      confirmations, disputes, resolved: confirmations - disputes <= -2,
    }).eq("id", id);
    r = { confirmations, disputes };
  }
  const net = r.confirmations - r.disputes;
  return { net, verified: net >= 2, resolved: net <= -2 };
}

// ---- subscribers -----------------------------------------------------------
export async function upsertSubscriber(s: {
  platform: string; handle: string; space_id: string; agent_user_id: string;
}): Promise<Subscriber> {
  if (!db) {
    let m = mem.subscribers.find((x) => x.platform === s.platform && x.handle === s.handle);
    if (!m) {
      m = { id: uid(), saved_from: null, saved_to: null, alerts: true, ...s };
      mem.subscribers.push(m);
    } else Object.assign(m, s);
    return m;
  }
  const { data, error } = await db.from("subscribers")
    .upsert({ ...s, updated_at: new Date().toISOString() }, { onConflict: "platform,handle" })
    .select().single();
  if (error) throw error;
  return data as Subscriber;
}

export async function updateSubscriber(id: string, patch: Partial<Subscriber>) {
  if (!db) {
    const m = mem.subscribers.find((x) => x.id === id);
    if (m) Object.assign(m, patch);
    return;
  }
  await db.from("subscribers").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
}

export async function alertSubscribers(): Promise<Subscriber[]> {
  if (!db) return mem.subscribers.filter((s) => s.alerts);
  const { data } = await db.from("subscribers").select("*").eq("alerts", true);
  return (data ?? []) as Subscriber[];
}

// ---- verification asks -----------------------------------------------------
export async function createAsk(reportId: string, subscriberId: string) {
  if (!db) { mem.asks.push({ id: uid(), report_id: reportId, subscriber_id: subscriberId, answer: null }); return; }
  await db.from("verification_asks").insert({ report_id: reportId, subscriber_id: subscriberId });
}

/** The most recent unanswered question Beau asked this person, if any. */
export async function pendingAsk(subscriberId: string): Promise<{ id: string; report_id: string } | null> {
  if (!db) {
    const a = [...mem.asks].reverse().find((x) => x.subscriber_id === subscriberId && !x.answer);
    return a ?? null;
  }
  const { data } = await db.from("verification_asks").select("id,report_id")
    .eq("subscriber_id", subscriberId).is("answer", null)
    .order("asked_at", { ascending: false }).limit(1);
  return data?.[0] ?? null;
}

export async function answerAsk(askId: string, answer: "yes" | "no") {
  if (!db) { const a = mem.asks.find((x) => x.id === askId); if (a) a.answer = answer; return; }
  await db.from("verification_asks").update({ answer, answered_at: new Date().toISOString() }).eq("id", askId);
}

// ---- photos ----------------------------------------------------------------
/** Store a texted photo in the public bucket and return its URL. */
export async function uploadPhoto(bytes: Blob, contentType: string): Promise<string | undefined> {
  if (!db) return undefined;
  const ext = contentType.split("/")[1]?.split(";")[0] ?? "jpg";
  const path = `imessage/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await db.storage.from("report-photos").upload(path, bytes, { contentType });
  if (error) { console.error("[store] photo upload failed:", error.message); return undefined; }
  return db.storage.from("report-photos").getPublicUrl(path).data.publicUrl;
}
