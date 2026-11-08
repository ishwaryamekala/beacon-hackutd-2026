// Photon 2.0 webhook -> Beau -> reply.
//
// Photon handles iMessage delivery; this is only the bridge. Keep it dumb:
// everything interesting happens in beau.ts and toolImpl.ts, which means the
// same brain can sit behind a voice call (Photon's separate prize) with no
// changes beyond swapping this file.

import { runBeau, type Msg } from "./beau";

/** Conversation memory, per sender. Swap for Supabase before you ship. */
const sessions = new Map<string, Msg[]>();

export async function handlePhotonWebhook(body: {
  from: string;
  text: string;
}): Promise<{ reply: string }> {
  const history = sessions.get(body.from) ?? [];
  const { reply, steps, history: next } = await runBeau(body.text, history);

  // Keep the tail only — long histories get expensive and add nothing here.
  sessions.set(body.from, next.slice(-12));
  console.log(`[beau] ${body.from}: ${steps.join(" -> ") || "(no tools)"}`);
  return { reply };
}
