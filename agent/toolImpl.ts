// What the tools actually do.
//
// The model picks the tool and the arguments. Everything numeric happens here,
// deterministically, so a hallucinated distance can never reach a user.

import { UTD_DEMO } from "../src/lib/campus";
import { compareRoutes, DEFAULT_PREFS, type Preferences } from "../src/lib/routing";
import type { Obstacle } from "../src/lib/graph";
import * as store from "./store";

/** Words that carry no location meaning. Without this, "the ramp by the
 *  library" matches "The Plinth" as strongly as "Library — Ramp", because
 *  "the" is in both. */
const STOPWORDS = new Set([
  "the", "and", "for", "near", "next", "beside", "around", "from", "into",
  "get", "got", "can", "you", "that", "this", "with", "but", "its", "it's",
  "please", "where", "what", "how", "take", "one", "any", "out",
]);

/** What people actually call these places. Without this, "the business school"
 *  matches nothing, because the node is named JSOM. Every one of these is a
 *  question a judge might type. */
const ALIASES: Record<string, string[]> = {
  jsom_door:  ["business", "school", "management", "naveen"],
  jsom_curb:  ["business", "school", "management"],
  lib_door:   ["mcdermott", "books", "study"],
  lib_stair:  ["mcdermott", "steps"],
  lib_ramp:   ["mcdermott"],
  lib_l2:     ["mcdermott", "elevator", "lift", "upstairs", "floor", "level"],
  su_north:   ["food", "dining", "comet", "cafeteria", "eat", "hungry", "lunch"],
  su_plaza:   ["food", "dining", "eat", "lunch"],
  ecsw_door:  ["engineering", "computer", "science", "ecs"],
  ecsw_plaza: ["engineering", "ecs"],
  plinth_w:   ["plinth", "quad"],
  plinth_e:   ["plinth", "quad"],
  mall_mid:   ["mall", "walkway"],
};

/** Fuzzy phrase -> node ids.
 *
 *  Rare words count for more than common ones: "ramp" appears in one node name
 *  and should outweigh "library", which appears in four. Returns ALL plausible
 *  candidates so the model asks rather than guesses which ramp someone meant --
 *  guessing wrong here sends a wheelchair user to a dead end. */
export function resolve_location({ phrase }: { phrase: string }) {
  const words = phrase
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));

  const all = Object.values(UTD_DEMO.nodes);
  const hayFor = (n: (typeof all)[number]) =>
    `${n.name} ${n.id} ${(ALIASES[n.id] ?? []).join(" ")}`.toLowerCase();

  // Inverse frequency: a word matching fewer nodes is more informative.
  const weight = new Map<string, number>();
  for (const w of words) {
    const hits = all.filter((n) => hayFor(n).includes(w)).length;
    weight.set(w, hits === 0 ? 0 : 1 / hits);
  }

  const scored = all
    .map((n) => {
      const hay = hayFor(n);
      const score = words.reduce((s, w) => s + (hay.includes(w) ? weight.get(w)! : 0), 0);
      return { id: n.id, name: n.name, score: +score.toFixed(3) };
    })
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score);

  // Only ambiguous when the runner-up is genuinely close.
  const ambiguous =
    scored.length > 1 && scored[1].score >= scored[0].score * 0.85;

  return { candidates: scored.slice(0, 4), ambiguous };
}

/** Who Beau is talking to, so tools can act on that person's behalf. */
export interface ToolContext {
  subscriber?: store.Subscriber;
  source: store.Source;
  /** A photo the user texted that hasn't been attached to a report yet. */
  pendingPhotoUrl?: string;
  /** Set by submit_report so the bridge knows the photo was used. */
  usedPhoto?: boolean;
}

/** Natural phrase or node id -> node id. Destinations prefer doors. */
function pickNode(phrase: string): string | null {
  if (UTD_DEMO.nodes[phrase]) return phrase;
  const { candidates } = resolve_location({ phrase });
  if (!candidates.length) return null;
  // "the library" ties between Steps, Ramp and Entrance. A destination is a
  // door, never a staircase, so among near-ties prefer an actual entrance.
  const close = candidates.filter((c) => c.score >= candidates[0].score * 0.85);
  return (close.find((c) => c.id.endsWith("_door")) ?? candidates[0]).id;
}

export async function find_accessible_route(args: {
  from: string; to: string;
  avoid_stairs?: boolean; avoid_elevators?: boolean;
  max_grade?: number; min_width_cm?: number;
}) {
  const fromId = pickNode(args.from);
  const toId = pickNode(args.to);
  if (!fromId || !toId) {
    return { error: "unknown_location", from: args.from, to: args.to };
  }

  const prefs: Preferences = {
    ...DEFAULT_PREFS,
    avoidStairs: args.avoid_stairs ?? DEFAULT_PREFS.avoidStairs,
    avoidElevators: args.avoid_elevators ?? DEFAULT_PREFS.avoidElevators,
    maxGrade: args.max_grade ?? DEFAULT_PREFS.maxGrade,
    minWidthCm: args.min_width_cm ?? DEFAULT_PREFS.minWidthCm,
  };

  // Live community reports, the same ones the web map shows.
  const reports = await store.openReports().catch(() => [] as Obstacle[]);
  const { accessible, shortest, penaltySeconds } = compareRoutes(UTD_DEMO, fromId, toId, prefs, reports);

  if (!accessible) {
    return {
      ok: false,
      reason: "no_accessible_route",
      from: UTD_DEMO.nodes[fromId].name,
      to: UTD_DEMO.nodes[toId].name,
      shortest_exists: Boolean(shortest),
    };
  }

  const avoided = reports.filter((r) =>
    shortest?.steps.some((s) => sameEdge(s.edge, r)) && !accessible.steps.some((s) => sameEdge(s.edge, r))
  );

  return {
    ok: true,
    from_id: fromId,
    to_id: toId,
    from: UTD_DEMO.nodes[fromId].name,
    to: UTD_DEMO.nodes[toId].name,
    minutes: +(accessible.totalSeconds / 60).toFixed(1),
    meters: Math.round(accessible.totalMeters),
    penalty_seconds: penaltySeconds === null ? null : Math.round(penaltySeconds),
    directions: accessible.steps.map((s) => `${s.edge.kind.replace(/_/g, " ")} to ${s.to.name}`),
    avoiding_reports: avoided.map((r) => `${r.kind} at ${UTD_DEMO.nodes[r.edgeTo]?.name ?? r.edgeTo}`),
  };
}

const sameEdge = (e: { from: string; to: string }, r: { edgeFrom: string; edgeTo: string }) =>
  (e.from === r.edgeFrom && e.to === r.edgeTo) || (e.from === r.edgeTo && e.to === r.edgeFrom);

/** Which kinds of edge each report kind most plausibly refers to. */
const LIKELY: Record<Obstacle["kind"], string[]> = {
  broken: ["elevator", "auto_door", "door"],
  blocked: ["ramp", "curb_cut", "path", "door"],
  construction: ["path", "ramp", "curb_cut"],
  crowded: ["path", "elevator"],
};

/** A place ("the library ramp") -> the specific edge a report should attach to. */
function edgeForPlace(place: string, kind: Obstacle["kind"]) {
  const node = resolve_location({ phrase: place }).candidates[0]?.id;
  if (!node) return null;
  const touching = UTD_DEMO.edges.filter((e) => e.from === node || e.to === node);
  for (const k of LIKELY[kind]) {
    const hit = touching.find((e) => e.kind === k);
    if (hit) return hit;
  }
  return touching[0] ?? null;
}

export async function submit_report(
  args: { edge_from?: string; edge_to?: string; place?: string; kind: Obstacle["kind"]; note?: string },
  ctx?: ToolContext
) {
  const edge =
    args.edge_from && args.edge_to
      ? UTD_DEMO.edges.find((e) => sameEdge(e, { edgeFrom: args.edge_from!, edgeTo: args.edge_to! }))
      : args.place
        ? edgeForPlace(args.place, args.kind)
        : null;
  if (!edge) return { ok: false, reason: "no_such_place_or_edge" };

  const report = await store.insertReport({
    edgeFrom: edge.from,
    edgeTo: edge.to,
    kind: args.kind,
    note: args.note,
    source: ctx?.source ?? "imessage",
    photoUrl: ctx?.pendingPhotoUrl,
    reportedBy: ctx?.subscriber?.id,
  });
  if (ctx?.pendingPhotoUrl) ctx.usedPhoto = true;
  return {
    ok: true,
    report_id: report.id,
    where: `${UTD_DEMO.nodes[edge.from].name} → ${UTD_DEMO.nodes[edge.to].name} (${edge.kind.replace(/_/g, " ")})`,
    status: "unverified",
    has_photo: Boolean(ctx?.pendingPhotoUrl),
    note: "Shows on the live map now. One more confirmation from someone nearby makes it verified and reroutes everyone.",
  };
}

export async function confirm_report({ report_id, agrees }: { report_id: string; agrees: boolean }) {
  const r = await store.voteReport(report_id, agrees);
  if (!r) return { ok: false, reason: "no_such_report" };
  return { ok: true, ...r };
}

/** Watch a route: Beau texts this person if a new report breaks it. */
export async function save_route({ from, to }: { from: string; to: string }, ctx?: ToolContext) {
  if (!ctx?.subscriber) return { ok: false, reason: "not_available_on_this_channel" };
  const f = pickNode(from), t = pickNode(to);
  if (!f || !t) return { ok: false, reason: "unknown_location" };
  await store.updateSubscriber(ctx.subscriber.id, { saved_from: f, saved_to: t, alerts: true });
  ctx.subscriber.saved_from = f; ctx.subscriber.saved_to = t; ctx.subscriber.alerts = true;
  return { ok: true, watching: `${UTD_DEMO.nodes[f].name} → ${UTD_DEMO.nodes[t].name}` };
}

export async function set_alerts({ on }: { on: boolean }, ctx?: ToolContext) {
  if (!ctx?.subscriber) return { ok: false, reason: "not_available_on_this_channel" };
  await store.updateSubscriber(ctx.subscriber.id, { alerts: on });
  ctx.subscriber.alerts = on;
  return { ok: true, alerts: on };
}

export const IMPL: Record<string, (args: any, ctx?: ToolContext) => unknown> = {
  resolve_location,
  find_accessible_route,
  submit_report,
  confirm_report,
  save_route,
  set_alerts,
};
