// Beau's reasoning loop against NVIDIA Nemotron.
//
// This is the multi-step part NVIDIA's track asks for: the model is allowed to
// call tools repeatedly before it answers, so "the ramp by the library is
// blocked" can become resolve_location -> clarifying question -> submit_report
// without the user ever naming a graph edge.

import { TOOLS, SYSTEM_PROMPT } from "./tools";
import { IMPL } from "./toolImpl";

const BASE = process.env.NVIDIA_BASE_URL ?? "https://integrate.api.nvidia.com/v1";
const MODEL = process.env.NEMOTRON_MODEL ?? "nvidia/llama-3.3-nemotron-super-49b-v1";
const KEY = process.env.NVIDIA_API_KEY;

export type Msg = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: any[];
  tool_call_id?: string;
};

/** Cap the loop so a confused model can't bill you forever. */
const MAX_TURNS = 6;

export async function runBeau(
  userText: string,
  history: Msg[] = []
): Promise<{ reply: string; steps: string[]; history: Msg[] }> {
  if (!KEY) throw new Error("NVIDIA_API_KEY is not set");

  const messages: Msg[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history,
    { role: "user", content: userText },
  ];
  const steps: string[] = [];

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, messages, tools: TOOLS, temperature: 0.2 }),
    });
    if (!res.ok) throw new Error(`Nemotron ${res.status}: ${await res.text()}`);

    const data = await res.json();
    const choice = data.choices?.[0]?.message;
    if (!choice) throw new Error("no completion returned");
    messages.push(choice);

    const calls = choice.tool_calls ?? [];
    if (calls.length === 0) {
      return { reply: choice.content ?? "", steps, history: messages.slice(1) };
    }

    // Run every tool the model asked for, then hand the results back.
    for (const call of calls) {
      const name = call.function?.name;
      let args: any = {};
      try {
        args = JSON.parse(call.function?.arguments ?? "{}");
      } catch {
        /* malformed args: let the tool reject them below */
      }
      const fn = IMPL[name];
      const result = fn ? fn(args) : { error: `unknown tool ${name}` };
      steps.push(`${name}(${JSON.stringify(args)})`);
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(result),
      });
    }
  }

  return {
    reply: "I got a little tangled up working that out. Can you rephrase?",
    steps,
    history: messages.slice(1),
  };
}
