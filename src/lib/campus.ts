// Demo slice of the UT Dallas campus.
//
// EVERY COORDINATE AND GRADE HERE IS APPROXIMATE AND UNVERIFIED. It exists so
// the router has something to chew on before you survey the real thing. Label
// it clearly as demo data in the UI — an accessibility app that confidently
// shows a wrong ramp is worse than one that admits it doesn't know.

import type { CampusGraph, Obstacle } from "./graph";

export const UTD_DEMO: CampusGraph = {
  nodes: {
    su_north:    { id: "su_north",    name: "Student Union — North Door",   lat: 32.98678, lng: -96.74846, floor: 1 },
    su_plaza:    { id: "su_plaza",    name: "Union Plaza",                  lat: 32.98651, lng: -96.74851, floor: 1 },
    plinth_w:    { id: "plinth_w",    name: "The Plinth — West",            lat: 32.98620, lng: -96.74910, floor: 1 },
    plinth_e:    { id: "plinth_e",    name: "The Plinth — East",            lat: 32.98618, lng: -96.74820, floor: 1 },
    mall_mid:    { id: "mall_mid",    name: "Mall Walkway",                 lat: 32.98570, lng: -96.74880, floor: 1 },
    lib_stair:   { id: "lib_stair",   name: "McDermott Library — Steps",    lat: 32.98520, lng: -96.74870, floor: 1 },
    lib_ramp:    { id: "lib_ramp",    name: "McDermott Library — Ramp",     lat: 32.98524, lng: -96.74902, floor: 1 },
    lib_door:    { id: "lib_door",    name: "McDermott Library — Entrance", lat: 32.98512, lng: -96.74884, floor: 1 },
    lib_l2:      { id: "lib_l2",      name: "McDermott Library — Level 2",  lat: 32.98512, lng: -96.74884, floor: 2 },
    ecsw_plaza:  { id: "ecsw_plaza",  name: "ECSW Plaza",                   lat: 32.98601, lng: -96.75090, floor: 1 },
    ecsw_door:   { id: "ecsw_door",   name: "ECSW — South Entrance",        lat: 32.98585, lng: -96.75101, floor: 1 },
    jsom_door:   { id: "jsom_door",   name: "JSOM — North Entrance",        lat: 32.98545, lng: -96.74700, floor: 1 },
    jsom_curb:   { id: "jsom_curb",   name: "JSOM Curb Cut",                lat: 32.98558, lng: -96.74738, floor: 1 },
  },
  edges: [
    { from: "su_north",   to: "su_plaza",   kind: "auto_door", meters: 12,  widthCm: 150 },
    { from: "su_plaza",   to: "plinth_e",   kind: "path",      meters: 48,  widthCm: 300 },
    { from: "su_plaza",   to: "plinth_w",   kind: "path",      meters: 72,  widthCm: 300 },
    { from: "plinth_w",   to: "plinth_e",   kind: "path",      meters: 84,  widthCm: 400 },
    { from: "plinth_w",   to: "mall_mid",   kind: "path",      meters: 62,  widthCm: 250 },
    { from: "plinth_e",   to: "mall_mid",   kind: "path",      meters: 68,  widthCm: 250 },

    // Two ways into the library: steps (short) or ramp (longer, step-free).
    { from: "mall_mid",   to: "lib_stair",  kind: "path",      meters: 56,  widthCm: 200 },
    { from: "lib_stair",  to: "lib_door",   kind: "stairs",    meters: 14 },
    { from: "mall_mid",   to: "lib_ramp",   kind: "path",      meters: 64,  widthCm: 200 },
    { from: "lib_ramp",   to: "lib_door",   kind: "ramp",      meters: 34,  grade: 0.07, widthCm: 120 },
    { from: "lib_door",   to: "lib_l2",     kind: "elevator",  meters: 4,   widthCm: 110 },

    { from: "plinth_w",   to: "ecsw_plaza", kind: "path",      meters: 92,  widthCm: 250 },
    { from: "ecsw_plaza", to: "ecsw_door",  kind: "auto_door", meters: 18,  widthCm: 160 },

    { from: "plinth_e",   to: "jsom_curb",  kind: "path",      meters: 88,  widthCm: 220 },
    { from: "jsom_curb",  to: "jsom_door",  kind: "curb_cut",  meters: 36,  grade: 0.05, widthCm: 95 },
  ],
};

/** Demo reports. In production these come from Supabase. */
export const DEMO_OBSTACLES: Obstacle[] = [
  {
    id: "obs_lib_elevator",
    edgeFrom: "lib_door",
    edgeTo: "lib_l2",
    kind: "broken",
    reportedAt: Date.now() - 1000 * 60 * 90,
    confirmations: 3,
    disputes: 0,
    resolved: false,
  },
  {
    id: "obs_ramp_blocked",
    edgeFrom: "mall_mid",
    edgeTo: "lib_ramp",
    kind: "construction",
    reportedAt: Date.now() - 1000 * 60 * 20,
    confirmations: 1,
    disputes: 0,
    resolved: false,
  },
];
