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
