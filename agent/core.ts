// Beau's brain, independent of how messages arrive.
//
// Two Photon connectors feed it:
//   agent/spectrum.ts  — Photon Spectrum SDK (dashboard: app.photon.codes)
//   agent/photon.ts    — Photon 2.0 beta HTTP API (dashboard: app.beta.photon.codes)
// Both get identical behaviour: routes, text + photo reports, YES/NO
// verification, watched-route alerts, STOP/START.

import { ApiError } from "@photon-ai/api";
import { setTimeout as sleep } from "node:timers/promises";
import { UTD_DEMO } from "../src/lib/campus";
import { compareRoutes, DEFAULT_PREFS } from "../src/lib/routing";
import type { Obstacle } from "../src/lib/graph";
import { runBeau, type Msg } from "./beau";
import { find_accessible_route, submit_report, resolve_location, type ToolContext } from "./toolImpl";
import * as store from "./store";

const HAS_MODEL = Boolean(process.env.NVIDIA_API_KEY);
const WATCH_MS = 5_000;

export const brainLabel = HAS_MODEL ? "Nemotron + tools" : "rule-based router (no NVIDIA_API_KEY)";
export const dataLabel = store.db ? "Supabase (shared with the web map)" : "memory only (no Supabase keys)";

export function describe(err: unknown) {
  return err instanceof ApiError
    ? `Photon ${err.status} (request ${err.requestId ?? "?"})`
    : (err as Error)?.message ?? String(err);
}

/** One inbound message, already unwrapped by a connector. */
export interface Incoming {
  platform: string;
  /** The person's phone number / email / platform user id. */
  handle: string;
  /** Conversation id, stored so Beau can text back later. */
  spaceId: string;
  /** Which agent identity received it (Photon 2.0); connectors without one pass a constant. */
  agentUserId: string;
  text: string;
  /** Lazy photo loaders, so nothing downloads unless it's an image we keep. */
  photos: Array<() => Promise<{ bytes: Blob; contentType: string } | undefined>>;
}

/** How a connector sends an unsolicited text to a known subscriber. */
export type Deliver = (s: store.Subscriber, text: string, key: string) => Promise<void>;

const place = (id: string) => UTD_DEMO.nodes[id]?.name ?? id;
const KIND_TEXT: Record<Obstacle["kind"], string> = {
  broken: "something broken (likely an elevator or door)",
  blocked: "a blocked path",
  construction: "construction",
  crowded: "a crowded path",
};

// ---------------------------------------------------------------------------
// Conversation state (memory is per process; durable state lives in Supabase)
// ---------------------------------------------------------------------------

const histories = new Map<string, Msg[]>();          // subscriber/space -> model history
const pendingPhotos = new Map<string, string>();      // subscriber -> photo URL awaiting a location
const lastNudge = new Map<string, number>();          // subscriber -> last unsolicited text (ms)
const NUDGE_GAP_MS = 10 * 60_000;                     // "elevate the moment without demanding attention"

export const HELP =
  "Hi, I'm Beau ✨ I find step-free routes around UTD and keep them up to date with reports from people like you.\n\n" +
  "• \"Route from the Student Union to the library\"\n" +
  "• \"The library ramp is blocked\" (send a photo too!)\n" +
  "• STOP to pause alerts, START to resume";

// ---------------------------------------------------------------------------
// Answering one message
// ---------------------------------------------------------------------------

/** Rule-based answers for when the model is unavailable. Covers the two
 *  things that matter mid-journey: directions, and reporting a problem. */
async function savePhoto(load: Incoming["photos"][number]): Promise<string | undefined> {
  try {
    const photo = await load();
    if (!photo || !photo.contentType.startsWith("image/")) return undefined;
    return await store.uploadPhoto(photo.bytes, photo.contentType);
  } catch (err) {
    console.error("[beau] photo download failed:", describe(err));
    return undefined;
  }
}

async function fallbackReply(text: string, ctx: ToolContext): Promise<string> {
  const kind: Obstacle["kind"] | null =
    /broken|out of order|not working|down\b/i.test(text) ? "broken"
    : /construction|torn up|fenced/i.test(text) ? "construction"
    : /blocked|closed|obstruct|can'?t get/i.test(text) ? "blocked"
    : /crowded|packed|full/i.test(text) ? "crowded"
    : null;

  if (kind) {
    const where = text.replace(/\b(the|is|are|was|totally|completely|again|broken|out of order|not working|down|blocked|closed|construction|crowded|packed)\b/gi, " ").trim();
    if (!resolve_location({ phrase: where }).candidates.length) {
      return "Thanks for flagging that. Where exactly is it? (e.g. \"library ramp\" or \"JSOM curb cut\")";
    }
    const r: any = await submit_report({ place: where, kind }, ctx);
    if (!r.ok) return "I couldn't place that on my map. Can you name the building and the spot (ramp, elevator, door)?";
    return `Got it, ${r.where} is now on the live map as unverified${r.has_photo ? " with your photo" : ""}. ` +
      "Once someone nearby confirms it, I reroute everyone around it. Thank you 💛";
  }

  const m = text.match(/from\s+(.+?)\s+to\s+(.+)/i) ?? text.match(/^(.+?)\s+to\s+(.+)$/i);
  if (!m) return HELP;
  const r: any = await find_accessible_route({ from: m[1], to: m[2].replace(/[?.!]+$/, "") });
  if (r.error) return `I couldn't find "${r.from}" or "${r.to}" on my map yet. Try a building name like "library" or "JSOM".`;
  if (!r.ok) return `I don't see a step-free way from ${r.from} to ${r.to} right now. Every known path needs stairs or is blocked by a verified report.`;
  const extra = r.penalty_seconds > 0 ? ` (${r.penalty_seconds}s longer than the stairs route)` : "";
  const avoid = r.avoiding_reports?.length ? `\nAvoiding: ${r.avoiding_reports.join(", ")}.` : "";
  return `${r.from} → ${r.to}: about ${r.minutes} min, ${r.meters} m${extra}.\n` +
    r.directions.map((d: string, i: number) => `${i + 1}. ${d}`).join("\n") + avoid +
    "\nCampus data is still being verified, so tell me if anything's off.";
}

async function think(key: string, text: string, ctx: ToolContext): Promise<string> {
  if (!HAS_MODEL) return fallbackReply(text, ctx);
  try {
    const { reply, steps, history } = await runBeau(text, histories.get(key) ?? [], ctx);
    histories.set(key, history.slice(-16));
    if (steps.length) console.log(`[beau]   tools: ${steps.join(" → ")}`);
    return reply || (await fallbackReply(text, ctx));
  } catch (err) {
    console.error("[beau] model failed, using fallback:", (err as Error).message);
    return fallbackReply(text, ctx);
  }
}

/** Pull text and image attachments out of any message shape. */
/** Loop 1's core: decide Beau's reply to one message. */
export async function respond(inc: Incoming): Promise<string> {
  const text = inc.text.trim();
  // Remember who this is, so alerts and verification questions can reach them later.
  const subscriber = await store
    .upsertSubscriber({ platform: inc.platform, handle: inc.handle, space_id: inc.spaceId, agent_user_id: inc.agentUserId })
    .catch((err) => { console.error("[beau] subscriber save failed:", err.message); return undefined; });
  const key = subscriber?.id ?? inc.spaceId;
  const ctx: ToolContext = {
    subscriber,
    source: inc.platform === "sms" || inc.platform === "email" ? inc.platform : "imessage",
    pendingPhotoUrl: pendingPhotos.get(key),
  };

  let reply: string;
  const word = text.toLowerCase().replace(/[^a-z]/g, "");

  // 1. A photo: keep it until we know where it is.
  for (const load of inc.photos) {
    const url = await savePhoto(load);
    if (url) { pendingPhotos.set(key, url); ctx.pendingPhotoUrl = url; }
  }

  if (word === "stop" || word === "start") {
    // 2. Opt out / back in. Always honoured, no model in the loop.
    const on = word === "start";
    if (subscriber) await store.updateSubscriber(subscriber.id, { alerts: on });
    reply = on
      ? "Alerts are back on. I'll text you if something breaks on your route ✨"
      : "Done, no more alerts or questions from me. Text START anytime to turn them back on.";
  } else if (subscriber && /^(yes|yeah|yep|y|stillthere|no|nope|n|clear|gone|itsgone)$/.test(word)) {
    // 3. An answer to "is it still there?" — the human-in-the-loop check.
    const ask = await store.pendingAsk(subscriber.id);
    if (!ask) {
      reply = await think(key, text, ctx);
    } else {
      const agrees = /^(yes|yeah|yep|y|stillthere)$/.test(word);
      await store.answerAsk(ask.id, agrees ? "yes" : "no");
      const r = await store.voteReport(ask.report_id, agrees);
      reply = !r ? "Thanks! That report was already cleared."
        : r.verified ? "Thanks, that makes it verified ✅ I'm rerouting everyone around it now."
        : r.resolved ? "Thanks! Enough people say it's clear, so I've taken it off the map."
        : agrees ? "Thanks for confirming. One more check and it's verified."
        : "Thanks, noted as possibly cleared. I'll keep asking around.";
    }
  } else if (!text && ctx.pendingPhotoUrl) {
    // 4. Photo with no words.
    reply = "Got your photo 📸 Where is this, and what's wrong? (e.g. \"library ramp, blocked\")";
  } else if (!text) {
    reply = HELP;
  } else if (/^(hi|hey|hello|help|start over|menu)\b/i.test(text) && text.length < 24) {
    reply = HELP;
  } else {
    // 5. Everything else goes to Beau (Nemotron + tools), with a rule-based net.
    reply = await think(key, text, ctx);
  }

  if (ctx.usedPhoto) pendingPhotos.delete(key);
  return reply;
}


/** Unsolicited texts are rate-limited per person; Photon also refuses them on
 *  a shared line until that person has texted Beau, which is our opt-in. */
async function nudge(deliver: Deliver, s: store.Subscriber, text: string, key: string) {
  const last = lastNudge.get(s.id) ?? 0;
  if (Date.now() - last < NUDGE_GAP_MS) return false;
  try {
    await deliver(s, text, key);
    lastNudge.set(s.id, Date.now());
    console.log(`[beau] ⇢ ${s.handle}: ${text.split("\n")[0]}`);
    return true;
  } catch (err) {
    console.error(`[beau] couldn't reach ${s.handle}:`, describe(err));
    return false;
  }
}

async function onNewReport(deliver: Deliver, r: Obstacle & { reportedBy?: string }) {
  const subs = await store.alertSubscribers();
  const open = await store.openReports();
  const without = open.filter((x) => x.id !== r.id);
  const where = `${place(r.edgeFrom)} → ${place(r.edgeTo)}`;
  const touched = new Set<string>();

  // a) People whose watched route this report changes get a reroute.
  for (const s of subs) {
    if (!s.saved_from || !s.saved_to || s.id === r.reportedBy) continue;
    const before = compareRoutes(UTD_DEMO, s.saved_from, s.saved_to, DEFAULT_PREFS, without).accessible;
    const after = compareRoutes(UTD_DEMO, s.saved_from, s.saved_to, DEFAULT_PREFS, open).accessible;
    if (before?.path.join() === after?.path.join()) continue;
    const msg = after
      ? `Heads up: ${KIND_TEXT[r.kind]} was just reported at ${where}, on your route to ${place(s.saved_to)}.\n` +
        `New step-free route: about ${(after.totalSeconds / 60).toFixed(1)} min via ${after.steps.map((x) => x.to.name).slice(-2).join(" → ")}.`
      : `Heads up: ${KIND_TEXT[r.kind]} was just reported at ${where}, and I can't find another step-free way to ${place(s.saved_to)} right now. Want me to look for the nearest alternative entrance?`;
    if (await nudge(deliver, s, msg, `alert:${r.id}:${s.id}`)) touched.add(s.id);
  }

  // b) Ask up to two other people to verify. Humans check what the community
  //    reported; two confirmations make it authoritative.
  const askable = subs.filter((s) => s.id !== r.reportedBy && !touched.has(s.id)).slice(0, 2);
  for (const s of askable) {
    const msg =
      `Quick check from Beau: someone reported ${KIND_TEXT[r.kind]} at ${where}` +
      `${r.photoUrl ? " (with a photo)" : ""}. If you're nearby, is it still there? Reply YES or NO.\n` +
      "(Text STOP to pause these.)";
    if (await nudge(deliver, s, msg, `ask:${r.id}:${s.id}`)) await store.createAsk(r.id, s.id);
  }
}

/** Loop 2: when a report lands (text OR web), alert and ask for verification. */
export async function watchReports(deliver: Deliver): Promise<never> {
  let since = new Date().toISOString();
  while (true) {
    try {
      for (const r of await store.reportsSince(since)) {
        since = new Date(r.reportedAt).toISOString();
        console.log(`[beau] new report (${r.source}): ${r.kind} at ${place(r.edgeTo)}`);
        await onNewReport(deliver, r).catch((err) => console.error("[beau] alert pass failed:", describe(err)));
      }
    } catch (err) {
      console.error("[beau] watcher failed:", describe(err));
    }
    await sleep(WATCH_MS);
  }
}
