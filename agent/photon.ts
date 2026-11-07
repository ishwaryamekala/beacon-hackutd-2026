// Photon 2.0 webhook -> ZERO -> reply.
//
// Photon handles iMessage delivery; this is only the bridge. Keep it dumb:
// everything interesting happens in zero.ts and toolImpl.ts, which means the
// same brain can sit behind a voice call (Photon's separate prize) with no
// changes beyond swapping this file.

import { runZero } from "./zero";

type Msg = Parameters<typeof runZero>[1] extends (infer T)[] ? T : never;

/** Conversation memory, per sender. Swap for Supabase before you ship. */
const sessions = new Map<string, Msg[]>();

export async function handlePhotonWebhook(body: {
  from: string;
  text: string;
}): Promise<{ reply: string }> {
  const history = sessions.get(body.from) ?? [];
  const { reply, steps, history: next } = await runZero(body.text, history);

  // Keep the tail only — long histories get expensive and add nothing here.
  sessions.set(body.from, next.slice(-12));
  console.log(`[zero] ${body.from}: ${steps.join(" -> ") || "(no tools)"}`);
  return { reply };
}
