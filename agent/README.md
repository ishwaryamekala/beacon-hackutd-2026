# Beau — the agent layer

Two surfaces, one brain:

- **Photon 2.0** delivers it over iMessage.
- **NVIDIA Nemotron** does the reasoning and tool selection.

They are not competing choices — Photon is transport, Nemotron is the model.
Using both is what makes you eligible for both tracks with one build.

## The loop

```
iMessage ──Photon──▶ agent ──▶ Nemotron (tool calling)
                       │           │
                       │           ├─ resolve_location
                       │           ├─ find_accessible_route ──▶ src/lib/routing.ts (A*)
                       │           ├─ submit_report ──────────▶ Supabase
                       │           └─ save_preference
                       ▼
              reply ──Photon──▶ iMessage
```

The model never does arithmetic on the graph. It decides *which* tool, with
*what* arguments, and how to explain the result. The A* in `src/lib/routing.ts`
is the source of truth for every number the user sees.

## Why this clears NVIDIA's "beyond a chatbot" bar

| Their requirement | Where it shows up |
|---|---|
| Not just responding to prompts | Every answer comes from a tool call, not from the model's own knowledge |
| Multi-step workflows | "the ramp by the library is blocked" → `resolve_location` → clarifying question → `submit_report` → re-route affected users |
| Tool integration | Supabase, the router, and the campus graph |
| Real-world applicability | Wheelchair users on a campus that has actual broken elevators |

## Setup

Nemotron speaks the OpenAI format, so any OpenAI client works:

```ts
const res = await fetch(`${process.env.NVIDIA_BASE_URL}/chat/completions`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.NVIDIA_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: process.env.NEMOTRON_MODEL,
    messages: [{ role: "system", content: SYSTEM_PROMPT }, ...history],
    tools: TOOLS,
  }),
});
```

Get a key at build.nvidia.com. Keep it server-side — never prefix it with `VITE_`.

## Running Beau on iMessage (Photon 2.0 beta API)

Beau is built on the **Photon 2.0 beta HTTP API** via the official client
`@photon-ai/api`. One process runs two loops:

| Loop | Photon 2.0 calls | What it does |
|---|---|---|
| Inbox | `listMessages`, `sendMessage` (text, `message.read`, `space.typing.update`), `getAttachment`, `downloadAttachment` | Answers texts and photos; files reports; YES/NO verification answers; STOP/START |
| Watcher | `sendMessage` into existing spaces | When a report lands (text **or** web), texts people whose watched route it breaks, and asks up to two others to verify it |

Every send uses an idempotency key, so retries never double-text anyone.
Unsolicited texts are rate-limited (one per person per 10 minutes) and only go
to people who texted Beau first, which is their opt-in. STOP always works.

Setup:
1. Photon 2.0 dashboard → create a project → **Settings** → copy the Project ID (`pho_prj_…`).
2. **API keys** → New key with `project:read` + `project:write`.
3. **iMessage** → add each tester's own number → assign a shared-pool number (that's Beau's number).
4. Put `PHOTON_PROJECT_ID` and `PHOTON_API_KEY` in `.env` (plus Supabase + `NVIDIA_API_KEY` if you have them).
5. `npm run imessage`, then text Beau's number from an assigned phone.

Without `NVIDIA_API_KEY`, Beau still handles routes and reports with a
rule-based parser. Without Supabase, state lives in memory and the web map
won't see texted reports.
