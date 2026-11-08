// Beau on the Photon 2.0 beta HTTP API (@photon-ai/api).
// Dashboard: app.beta.photon.codes. Run: npm run imessage:beta
//
// Env: PHOTON_PROJECT_ID (pho_prj_…), PHOTON_API_KEY (project:read + write).
// All of Beau's behaviour lives in core.ts; this file only moves messages.

import { Photon } from "@photon-ai/api";
import { setTimeout as sleep } from "node:timers/promises";
import { brainLabel, dataLabel, describe, respond, watchReports, type Deliver } from "./core";

const PROJECT = process.env.PHOTON_PROJECT_ID ?? "";
const API_KEY = process.env.PHOTON_API_KEY ?? "";
const POLL_MS = 2_000;

const photon = new Photon({ headers: { Authorization: `Bearer ${API_KEY}` } });

type Inbound = Awaited<ReturnType<Photon["projects"]["listMessages"]>>["items"][number];
type SendContent = Parameters<Photon["projects"]["sendMessage"]>[0]["body"]["content"];
interface Thread { spaceId: string; agentId: string }

/** Every send carries a stable idempotency key, so a retry never double-texts. */
function send(t: Thread, content: SendContent, key: string, parentMessageId?: string) {
  return photon.projects.sendMessage({
    path: { id: PROJECT },
    headers: { "idempotency-key": key },
    body: { spaceId: t.spaceId, senderId: t.agentId, content, ...(parentMessageId ? { parentMessageId } : {}) },
  });
}
const sendText = (t: Thread, text: string, key: string, parent?: string) =>
  send(t, { type: "text", format: "plain", text }, key, parent);
/** Read receipts and typing bubbles must never break a reply. */
const soft = (p: Promise<unknown>) => p.catch(() => undefined);

function unwrap(m: Inbound) {
  const c: any = (m as any).content;
  const list: any[] = c?.type === "group" ? c.parts ?? [] : [c];
  return {
    text: list.filter((p) => p?.type === "text").map((p) => p.text).join("\n"),
    photos: list.filter((p) => p?.type === "attachment").map((p) => async () => {
      const meta = await photon.projects.getAttachment({ path: { id: PROJECT, attachmentId: p.attachmentId } });
      if (!meta.contentType.startsWith("image/")) return undefined;
      const bytes = await photon.projects.downloadAttachment({ path: { id: PROJECT, attachmentId: p.attachmentId } });
      return { bytes, contentType: meta.contentType };
    }),
  };
}

async function handle(m: Inbound) {
  const a = m as any;
  const id: string = a.id;
  const thread: Thread = { spaceId: a.space.id, agentId: a.receivedBy.id };
  const { text, photos } = unwrap(m);
  console.log(`[beau] ← ${a.platform} ${a.sentBy.handle}: ${text || `(${photos.length} attachment)`}`);

  await soft(send(thread, { type: "message.read" }, `read:${id}`, id));
  await soft(send(thread, { type: "space.typing.update", typing: true }, `typing:${id}`));
  const reply = await respond({
    platform: a.platform, handle: a.sentBy.handle, spaceId: thread.spaceId, agentUserId: thread.agentId, text, photos,
  });
  await soft(send(thread, { type: "space.typing.update", typing: false }, `typing-off:${id}`));
  await sendText(thread, reply, `reply:${id}`, id);
  console.log(`[beau] → ${a.sentBy.handle}: ${reply.split("\n")[0]}`);
}

async function inbox(): Promise<never> {
  const seen = new Set<string>();
  let since = new Date(Date.now() - 5_000).toISOString();
  // One queue per conversation: replies stay in order, but one slow model call
  // never holds up someone else's text.
  const queues = new Map<string, Promise<void>>();
  while (true) {
    try {
      let pageToken: string | undefined;
      do {
        const page = await photon.projects.listMessages({
          path: { id: PROJECT },
          query: { createdSince: since, direction: "received", order: "asc", pageSize: 100, ...(pageToken ? { pageToken } : {}) },
        });
        for (const m of page.items) {
          const a = m as any;
          if (seen.has(a.id) || a.status !== "received" || a.sentBy?.kind !== "human" || a.receivedBy?.kind !== "agent") continue;
          seen.add(a.id);
          if (Date.parse(a.createdAt) > Date.parse(since)) since = new Date(Date.parse(a.createdAt) - 1_000).toISOString();
          queues.set(a.space.id, (queues.get(a.space.id) ?? Promise.resolve())
            .then(() => handle(m))
            .catch((err) => console.error("[beau] reply failed:", describe(err))));
        }
        pageToken = page.nextPageToken ?? undefined;
      } while (pageToken);
      if (seen.size > 5_000) seen.clear(); // `since` still prevents replays
    } catch (err) {
      console.error("[beau] inbox poll failed:", describe(err));
    }
    await sleep(POLL_MS);
  }
}

/** Unsolicited texts go into the person's existing conversation. Photon
 *  refuses them on a shared line until that person has texted Beau. */
const deliver: Deliver = (s, text, key) =>
  sendText({ spaceId: s.space_id, agentId: s.agent_user_id }, text, key).then(() => undefined);

async function main() {
  if (!PROJECT.startsWith("pho_prj_") || !API_KEY) {
    console.error(
      "Set PHOTON_PROJECT_ID (starts with pho_prj_) and PHOTON_API_KEY in .env, from the Photon 2.0\n" +
      "beta dashboard (app.beta.photon.codes). Using the Spectrum dashboard instead? Run: npm run imessage"
    );
    process.exit(1);
  }
  console.log(`[beau] Photon 2.0 beta API, project ${PROJECT}\n[beau] brain: ${brainLabel}\n[beau] data:  ${dataLabel}`);
  await Promise.all([inbox(), watchReports(deliver)]);
}

main().catch((err) => { console.error("[beau] fatal:", describe(err)); process.exit(1); });
