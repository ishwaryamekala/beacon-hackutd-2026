// Beau on Photon's Spectrum SDK (spectrum-ts).
// Dashboard: app.photon.codes (the one the HackUTD guidelines link). Run: npm run imessage
//
// Env: SPECTRUM_PROJECT_ID, SPECTRUM_PROJECT_SECRET (dashboard → Get started → Add your credentials).
// All of Beau's behaviour lives in core.ts; this file only moves messages.

import { Spectrum } from "spectrum-ts";
import { imessage } from "spectrum-ts/providers/imessage";
import { brainLabel, dataLabel, describe, respond, watchReports, type Deliver } from "./core";

const PROJECT_ID = process.env.SPECTRUM_PROJECT_ID;
const PROJECT_SECRET = process.env.SPECTRUM_PROJECT_SECRET;

/** Live conversations, so the watcher can text people back later. Spectrum
 *  spaces are objects from the live connection; after a restart someone has
 *  to text Beau once before alerts can reach them again. */
const spaces = new Map<string, { send(text: string): Promise<unknown> }>();

const deliver: Deliver = async (s, text) => {
  const space = spaces.get(s.space_id);
  if (!space) throw new Error("no live conversation since restart; they need to text Beau first");
  await space.send(text);
};

async function main() {
  if (!PROJECT_ID || !PROJECT_SECRET) {
    console.error(
      "Set SPECTRUM_PROJECT_ID and SPECTRUM_PROJECT_SECRET in .env, from the Photon dashboard\n" +
      "(app.photon.codes → Get started → Add your credentials → Reveal)."
    );
    process.exit(1);
  }

  const app = await Spectrum({
    projectId: PROJECT_ID,
    projectSecret: PROJECT_SECRET,
    providers: [imessage.config()],
    signal: AbortSignal.timeout(30_000),
  });
  console.log(`[beau] Photon Spectrum, project ${PROJECT_ID}\n[beau] brain: ${brainLabel}\n[beau] data:  ${dataLabel}`);
  void watchReports(deliver);

  // One queue per conversation: replies stay in order without blocking others.
  const queues = new Map<string, Promise<void>>();

  for await (const [space, message] of app.messages) {
    if (message.direction !== "inbound") continue;
    const c: any = message.content;
    const list: any[] = c?.type === "group" ? (c.items ?? []).map((m: any) => m.content) : [c];
    const text = list.filter((p) => p?.type === "text").map((p) => p.text).join("\n");
    const photos = list
      .filter((p) => p?.type === "attachment")
      .map((p) => async () => {
        if (!String(p.mimeType).startsWith("image/")) return undefined;
        const buf: Buffer = await p.read();
        return { bytes: new Blob([new Uint8Array(buf)], { type: p.mimeType }), contentType: p.mimeType as string };
      });
    if (!text && !photos.length) continue; // reactions, typing, read receipts

    const handle = message.sender?.id ?? space.id;
    spaces.set(space.id, space as any);
    console.log(`[beau] ← ${message.platform} ${handle}: ${text || `(${photos.length} attachment)`}`);

    const job = async () => {
      await message.read().catch(() => undefined);
      // responding() shows the typing bubble while Beau thinks.
      const reply = await space.responding(() =>
        respond({ platform: message.platform, handle, spaceId: space.id, agentUserId: "spectrum", text, photos })
      );
      await message.reply(reply);
      console.log(`[beau] → ${handle}: ${reply.split("\n")[0]}`);
    };
    queues.set(space.id, (queues.get(space.id) ?? Promise.resolve())
      .then(job)
      .catch((err) => console.error("[beau] reply failed:", describe(err))));
  }
}

main().catch((err) => { console.error("[beau] fatal:", describe(err)); process.exit(1); });
