// A* over the campus graph, where accessibility is expressed as EDGE COST
// rather than as a post-hoc filter.
//
// Why cost and not a filter: a filter gives you two states, "route exists" or
// "no route". A cost function lets the router say "there is a way, it's 90
// seconds longer, here it is" — which is the answer a wheelchair user actually
// needs. Hard blockers (stairs when you can't use stairs) are the one case that
// really is infinite cost, and those stay infinite.

import {
  type CampusGraph,
  type GraphEdge,
  type GraphNode,
  type Obstacle,
  buildAdjacency,
  haversine,
} from "./graph";

export interface Preferences {
  avoidStairs: boolean;
  avoidElevators: boolean;
  preferRamps: boolean;
  /** Steepest grade the user is comfortable with. ADA max is 1:12 ≈ 0.083. */
  maxGrade: number;
  /** Narrowest passage the user can fit through, in cm. */
  minWidthCm: number;
  /** Metres per second. Default is a conservative manual-wheelchair pace. */
  speed: number;
}

export const DEFAULT_PREFS: Preferences = {
  avoidStairs: true,
  avoidElevators: false,
  preferRamps: true,
  maxGrade: 0.083,
  minWidthCm: 80,
  speed: 1.1,
};

/** Cost in seconds, or Infinity when the edge is genuinely impassable. */
export const IMPASSABLE = Infinity;

/** Fixed time penalties in seconds, on top of travel time. */
const FIXED_COST: Partial<Record<GraphEdge["kind"], number>> = {
  elevator: 45,   // call + wait + ride, measured generously
  door: 8,        // manual door
  auto_door: 2,
  ramp: 4,        // approach and turn
  curb_cut: 2,
  stairs: 10,
};

/**
 * A verified obstacle removes the edge. An unverified one only makes it
 * expensive, so a single bad-faith or mistaken report can't strand someone.
 */
const VERIFY_THRESHOLD = 2;

function obstacleCost(obs: Obstacle[], edge: GraphEdge): number {
  let penalty = 0;
  for (const o of obs) {
    if (o.resolved) continue;
    const matches =
      (o.edgeFrom === edge.from && o.edgeTo === edge.to) ||
      (o.edgeFrom === edge.to && o.edgeTo === edge.from);
    if (!matches) continue;

    const net = o.confirmations - o.disputes;
    if (o.kind === "broken" || o.kind === "blocked") {
      if (net >= VERIFY_THRESHOLD) return IMPASSABLE;
      penalty += 120; // unverified: route around it if there's any alternative
    } else if (o.kind === "construction") {
      penalty += net >= VERIFY_THRESHOLD ? 180 : 60;
    } else if (o.kind === "crowded") {
      penalty += 20;
    }
  }
  return penalty;
}

export function edgeCost(
  edge: GraphEdge,
  prefs: Preferences,
  obstacles: Obstacle[] = []
): number {
  // Hard blockers first — these are not preferences, they're physics.
  if (edge.kind === "stairs" && prefs.avoidStairs) return IMPASSABLE;
  if (edge.kind === "elevator" && prefs.avoidElevators) return IMPASSABLE;
  if (edge.widthCm !== undefined && edge.widthCm < prefs.minWidthCm) return IMPASSABLE;
  if (edge.grade !== undefined && edge.grade > prefs.maxGrade) return IMPASSABLE;

  const obstacle = obstacleCost(obstacles, edge);
  if (obstacle === IMPASSABLE) return IMPASSABLE;

  let seconds = edge.meters / prefs.speed;
  seconds += FIXED_COST[edge.kind] ?? 0;

  // Climbing a grade is slower even when it's within tolerance.
  if (edge.grade && edge.grade > 0) {
    seconds *= 1 + edge.grade * 6;
  }
  // A soft nudge, not a hard rule: given two legal options, take the ramp.
  if (prefs.preferRamps && edge.kind === "ramp") {
    seconds *= 0.9;
  }
  return seconds + obstacle;
}

export interface RouteStep {
  from: GraphNode;
  to: GraphNode;
  edge: GraphEdge;
  seconds: number;
}

export interface Route {
  steps: RouteStep[];
  totalSeconds: number;
  totalMeters: number;
  /** Node ids, in order. */
  path: string[];
}

/** Tiny binary heap — enough for campus-sized graphs, no dependency needed. */
class MinHeap<T> {
  private items: { key: number; value: T }[] = [];
  get size() {
    return this.items.length;
  }
  push(key: number, value: T) {
    this.items.push({ key, value });
    let i = this.items.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.items[p].key <= this.items[i].key) break;
      [this.items[p], this.items[i]] = [this.items[i], this.items[p]];
      i = p;
    }
  }
  pop(): T | undefined {
    if (this.items.length === 0) return undefined;
    const top = this.items[0];
    const last = this.items.pop()!;
    if (this.items.length > 0) {
      this.items[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let s = i;
        if (l < this.items.length && this.items[l].key < this.items[s].key) s = l;
        if (r < this.items.length && this.items[r].key < this.items[s].key) s = r;
        if (s === i) break;
        [this.items[s], this.items[i]] = [this.items[i], this.items[s]];
        i = s;
      }
    }
    return top.value;
  }
}

export function findRoute(
  graph: CampusGraph,
  startId: string,
  goalId: string,
  prefs: Preferences = DEFAULT_PREFS,
  obstacles: Obstacle[] = []
): Route | null {
  const start = graph.nodes[startId];
  const goal = graph.nodes[goalId];
  if (!start || !goal) return null;

  const adj = buildAdjacency(graph);

  // Heuristic must never overestimate or A* can return a non-optimal path.
  // Straight-line metres at the user's top speed is always <= real cost.
  const h = (id: string) => haversine(graph.nodes[id], goal) / prefs.speed;

  const gScore = new Map<string, number>([[startId, 0]]);
  const cameFrom = new Map<string, { prev: string; edge: GraphEdge }>();
  const closed = new Set<string>();
  const open = new MinHeap<string>();
  open.push(h(startId), startId);

  while (open.size > 0) {
    const current = open.pop()!;
    if (current === goalId) break;
    if (closed.has(current)) continue;
    closed.add(current);

    for (const edge of adj.get(current) ?? []) {
      if (closed.has(edge.to)) continue;
      const cost = edgeCost(edge, prefs, obstacles);
      if (cost === IMPASSABLE) continue;

      const tentative = (gScore.get(current) ?? Infinity) + cost;
      if (tentative < (gScore.get(edge.to) ?? Infinity)) {
        gScore.set(edge.to, tentative);
        cameFrom.set(edge.to, { prev: current, edge });
        open.push(tentative + h(edge.to), edge.to);
      }
    }
  }

  if (!gScore.has(goalId)) return null;

  const steps: RouteStep[] = [];
  const path: string[] = [goalId];
  let cursor = goalId;
  while (cursor !== startId) {
    const link = cameFrom.get(cursor);
    if (!link) return null;
    steps.unshift({
      from: graph.nodes[link.prev],
      to: graph.nodes[cursor],
      edge: link.edge,
      seconds: edgeCost(link.edge, prefs, obstacles),
    });
    cursor = link.prev;
    path.unshift(cursor);
  }

  return {
    steps,
    path,
    totalSeconds: gScore.get(goalId)!,
    totalMeters: steps.reduce((sum, s) => sum + s.edge.meters, 0),
  };
}

/**
 * Both routes at once, so the UI can say "the step-free way is 90s longer"
 * instead of just refusing. This comparison IS the product.
 */
export function compareRoutes(
  graph: CampusGraph,
  startId: string,
  goalId: string,
  prefs: Preferences = DEFAULT_PREFS,
  obstacles: Obstacle[] = []
) {
  const accessible = findRoute(graph, startId, goalId, prefs, obstacles);
  const shortest = findRoute(
    graph,
    startId,
    goalId,
    { ...prefs, avoidStairs: false, avoidElevators: false, maxGrade: 1, minWidthCm: 0 },
    obstacles
  );
  const penaltySeconds =
    accessible && shortest ? accessible.totalSeconds - shortest.totalSeconds : null;
  return { accessible, shortest, penaltySeconds };
}
