// The campus as a graph. Nodes are decision points (doors, landings, path
// junctions); edges are the physical ways between them.
//
// The important idea: accessibility is a property of EDGES, not places. A
// building isn't "inaccessible" — the specific stair edge into it is, while the
// ramp edge beside it isn't. That's what lets one graph serve every preference
// set without maintaining separate maps.

export type EdgeKind =
  | "path"      // open walkway
  | "ramp"
  | "stairs"
  | "elevator"
  | "door"      // manual door (heavier for some users)
  | "auto_door"
  | "curb_cut";

export interface GraphNode {
  id: string;
  name: string;
  lat: number;
  lng: number;
  floor: number;
}

export interface GraphEdge {
  from: string;
  to: string;
  kind: EdgeKind;
  meters: number;
  /** Rise over run, 0..1. Only meaningful on ramps and sloped paths. */
  grade?: number;
  /** Narrowest point in cm. Wheelchairs typically need >= 80. */
  widthCm?: number;
  /** Traversable both ways. False for one-way things like a down-only escalator. */
  bidirectional?: boolean;
}

/**
 * A community report that temporarily changes an edge's cost.
 * `confirmations` is what separates "someone said" from "it's true".
 */
export interface Obstacle {
  id: string;
  edgeFrom: string;
  edgeTo: string;
  kind: "broken" | "blocked" | "construction" | "crowded";
  reportedAt: number;
  confirmations: number;
  disputes: number;
  resolved: boolean;
  note?: string;
  source?: "web" | "imessage" | "sms" | "email";
  photoUrl?: string;
}

export interface CampusGraph {
  nodes: Record<string, GraphNode>;
  edges: GraphEdge[];
}

/** Metres between two lat/lngs. Used as the A* heuristic and for edge lengths. */
export function haversine(a: GraphNode, b: GraphNode): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function buildAdjacency(graph: CampusGraph): Map<string, GraphEdge[]> {
  const adj = new Map<string, GraphEdge[]>();
  const push = (k: string, e: GraphEdge) => {
    const list = adj.get(k);
    if (list) list.push(e);
    else adj.set(k, [e]);
  };
  for (const e of graph.edges) {
    push(e.from, e);
    if (e.bidirectional !== false) {
      push(e.to, { ...e, from: e.to, to: e.from });
    }
  }
  return adj;
}
