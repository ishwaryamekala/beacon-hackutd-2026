// Tool surface for Beau.
//
// This is the file that decides whether the NVIDIA track takes you seriously.
// Their bar is "beyond a chatbot": the model must PLAN and CALL THINGS, not
// answer in prose. So the model never computes a route itself — it picks tools,
// and the deterministic router does the maths. The model handles the messy
// human part: "the ramp by the library is blocked again" -> which edge is that?
//
// Wire these to Nemotron via OpenAI-compatible tool calling at
// https://integrate.api.nvidia.com/v1 — the same JSON schema format.

export const TOOLS = [
  {
    type: "function",
    function: {
      name: "find_accessible_route",
      description:
        "Compute the fastest route between two campus locations that respects the user's mobility needs. Returns both the accessible route and the shortest route so the time cost of accessibility is visible.",
      parameters: {
        type: "object",
        properties: {
          from: { type: "string", description: "Start location, natural language ('the union')" },
          to: { type: "string", description: "Destination, natural language ('the library')" },
          avoid_stairs: { type: "boolean" },
          avoid_elevators: { type: "boolean" },
          max_grade: { type: "number", description: "Steepest acceptable slope, 0..1. ADA max is 0.083." },
          min_width_cm: { type: "number" },
        },
        required: ["from", "to"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "resolve_location",
      description:
        "Turn a vague phrase into a specific graph node. Call this FIRST when the user is ambiguous ('the ramp near the library'), and ask a follow-up if it returns several candidates.",
      parameters: {
        type: "object",
        properties: { phrase: { type: "string" } },
        required: ["phrase"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "submit_report",
      description:
        "File an accessibility obstacle report to the shared live map. Give either `place` (a specific spot the user confirmed, e.g. 'McDermott Library ramp') or edge_from+edge_to node ids. If the user texted a photo it is attached automatically. Only call after the user confirmed the exact spot.",
      parameters: {
        type: "object",
        properties: {
          place: { type: "string", description: "The confirmed specific spot, natural language" },
          edge_from: { type: "string" },
          edge_to: { type: "string" },
          kind: { type: "string", enum: ["broken", "blocked", "construction", "crowded"] },
          note: { type: "string", description: "Short description in the user's words" },
        },
        required: ["kind"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "confirm_report",
      description: "Confirm or dispute an existing report. Two net confirmations make it authoritative enough to close a path.",
      parameters: {
        type: "object",
        properties: {
          report_id: { type: "string" },
          agrees: { type: "boolean" },
        },
        required: ["report_id", "agrees"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_route",
      description: "Watch a route for this person: if a new report breaks it, Beau texts them a reroute. Only call after they said yes to being alerted.",
      parameters: {
        type: "object",
        properties: { from: { type: "string" }, to: { type: "string" } },
        required: ["from", "to"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_alerts",
      description: "Turn this person's route alerts and verification questions on or off (e.g. when they text STOP).",
      parameters: {
        type: "object",
        properties: { on: { type: "boolean" } },
        required: ["on"],
      },
    },
  },
] as const;

export const SYSTEM_PROMPT = `You are Beau, a friendly firefly who helps wheelchair users and people with mobility limitations find accessible routes on the UT Dallas campus over iMessage. You light the way.

You do not calculate routes yourself. You call tools and explain what comes back.

Rules:
- When a location is vague, call resolve_location before anything else. If it returns
  more than one candidate, ask ONE short clarifying question. Never guess which ramp.
- When you report an obstacle, confirm the specific edge with the user before submitting.
  A wrong report can send a wheelchair user down a dead end.
- Always state the time cost of the accessible route against the shortest one.
- If no accessible route exists, say so plainly and suggest the nearest alternative
  entrance. Never invent a path.
- After giving a route someone uses regularly, offer once: "Want me to watch this route
  and text you if something breaks?" Only call save_route after they say yes.
- If the user sent a photo, ask where it is (one short question) before submit_report.
- New reports start unverified. Tell the reporter it's on the live map and that one more
  person confirming it reroutes everyone. Thank them; they just helped the next person.
- Campus data is partly unverified. Say so when it matters. Never promise a path is
  accessible unless the data says it is.

Voice: warm, upbeat, concise. Replies are plain text sized for iMessage, one short
paragraph or a few short lines. Use at most one emoji, and only when it fits.
People are messaging you mid-journey, often one-handed.`;
