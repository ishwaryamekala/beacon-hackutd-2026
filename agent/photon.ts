// Photon 2.0 → Beau → iMessage.
//
// Uses Photon's Spectrum SDK (spectrum-ts). It holds a live connection to
// Photon's cloud, so there is no webhook to expose and no ngrok tunnel to
// babysit on demo day — run this process and text the project's number.
//
//   npm run imessage
//
// Needs PHOTON_PROJECT_ID + PHOTON_PROJECT_SECRET (app.photon.codes).
// NVIDIA_API_KEY is optional: without it Beau falls back to a rule-based
// router so the iMessage demo still works if the model endpoint is down.

import { Spectrum } from "spectrum-ts";
import { imessage } from "spectrum-ts/providers/imessage";
import { runBeau, type Msg } from "./beau";
import { find_accessible_route } from "./toolImpl";

const PROJECT_ID = process.env.PHOTON_PROJECT_ID;
const PROJECT_SECRET = process.env.PHOTON_PROJECT_SECRET;
const HAS_MODEL = Boolean(process.env.NVIDIA_API_KEY);

/** Conversation memory per iMessage chat. Swap for Supabase before you ship. */
const sessions = new Map<string, Msg[]>();

const HELP =
  "Hi, I'm Beau ✨ I light up accessible routes around UTD.\n" +
  'Try: "accessible route from the Student Union to the library", ' +
  'or tell me about a problem: "the library ramp is blocked".';

/**
 * Model-free fallback. Handles the one request that matters most mid-journey
 * — "get me from A to B" — straight off the A* router, so a missing API key
 * or a flaky model endpoint never leaves someone without directions.
 */
function fallbackReply(text: string): string {
  const m = text.match(/from\s+(.+?)\s+to\s+(.+)/i) ?? text.match(/(.+?)\s+to\s+(.+)/i);
  if (!m) return HELP;
  const r = find_accessible_route({ from: m[1], to: m[2].replace(/[?.!]+$/, "") }) as any;
  if (r.error) return `I couldn't find "${r.error === "unknown_location" ? `${r.from}" or "${r.to}` : text}" on my map yet. Try a building name like "library" or "JSOM".`;
  if (!r.ok) return `I don't see a step-free way from ${r.from} to ${r.to} right now. Every known path needs stairs or is blocked by a verified report. 💛`;
  const extra = r.penalty_seconds > 0 ? ` (${r.penalty_seconds}s longer than the stairs route)` : "";
  return (
    `${r.from} → ${r.to}: about ${r.minutes} min, ${r.meters} m${extra}.\n` +
    r.directions.map((d: string, i: number) => `${i + 1}. ${d.replace(/_/g, " ")}`).join("\n") +
    "\nHeads up: campus data is still being verified."
  );
}

async function answer(chatId: string, text: string): Promise<string> {
  if (/^(hi|hey|hello|help|start)\b/i.test(text.trim()) && text.length < 20) return HELP;
  if (!HAS_MODEL) return fallbackReply(text);
  try {
    const history = sessions.get(chatId) ?? [];
    const { reply, steps, history: next } = await runBeau(text, history);
    sessions.set(chatId, next.slice(-12)); // keep the tail; long histories add cost, not value
    console.log(`[beau] ${chatId}: ${steps.join(" -> ") || "(no tools)"}`);
    return reply;
  } catch (err) {
    console.error("[beau] model failed, using fallback:", (err as Error).message);
    return fallbackReply(text);
  }
}

async function main() {
  if (!PROJECT_ID || !PROJECT_SECRET) {
    console.error("Set PHOTON_PROJECT_ID and PHOTON_PROJECT_SECRET in .env (from app.photon.codes).");
    process.exit(1);
  }

  const app = await Spectrum({
    projectId: PROJECT_ID,
    projectSecret: PROJECT_SECRET,
    providers: [imessage.config()],
    signal: AbortSignal.timeout(20_000),
  });
  console.log(`[beau] connected to Photon. Model: ${HAS_MODEL ? "Nemotron" : "fallback router (no NVIDIA_API_KEY)"}`);

  for await (const [space, message] of app.messages) {
    if (message.direction !== "inbound" || message.content.type !== "text") continue;
    const text = message.content.text;
    console.log(`[beau] <- ${space.id}: ${text}`);

    // Don't await: one slow model call shouldn't hold up everyone else's texts.
    void (async () => {
      try {
        await message.read();
        // responding() shows the typing bubble while Beau thinks.
        const reply = await space.responding(() => answer(space.id, text));
        await message.reply(reply);
        console.log(`[beau] -> ${space.id}: ${reply.split("\n")[0]}`);
      } catch (err) {
        console.error("[beau] failed to reply:", err);
      }
    })();
  }
}

main().catch((err) => {
  console.error("[beau] fatal:", err);
  process.exit(1);
});
