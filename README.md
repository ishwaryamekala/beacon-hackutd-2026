# Beacon

**The city wasn't built for everyone. We're changing the map.**

AI-powered accessibility navigation for campuses. Most navigation apps answer
"what's the shortest way?" Beacon answers "what's the fastest way *I* can
actually take?" — accounting for stairs, ramp grade, door width, working
elevators, and obstacles that other students reported ten minutes ago.

HackUTD 2026.

---

## The one idea

**Accessibility is an edge cost, not a filter.**

A building isn't inaccessible — the stair edge into it is, while the ramp edge
beside it isn't. Model it that way and one graph serves every user. A filter
gives you two answers, "route" or "no route". A cost function gives you the
answer people actually need: *"there is a way, it's 29 seconds longer, here it
is."*

That 29 seconds is the product. It's the number nobody measures.

---

## Status

| Piece | State |
|---|---|
| A* router with accessibility costs | **Built, logic verified** |
| Demo campus graph (13 nodes, 15 edges) | Built — coordinates unverified |
| Community reports + verification | Built: submit, confirm/dispute, live reroute |
| Supabase wiring + realtime | Built, with offline fallback for bad wifi |
| Leaflet map, both routes drawn | Built |
| React UI + Clarity Mode | Built |
| Beau agent loop (Nemotron tool calling) | Built — needs an API key to run |
| Photon iMessage bridge | Built — needs Photon webhook pointed at it |

**Nothing has been run.** This machine has no Node, so the TypeScript has never
been compiled or executed. The routing and location-matching *logic* was ported
to Python and tested (see below), but expect to fix import paths and type errors
on first `npm run dev`.

## Quickstart

```bash
npm install
cp .env.example .env    # fill in keys, or skip — demo data works offline
npm run dev
```

**You need Node 18+ first.** It isn't installed on this machine:

```bash
curl -fsSL https://fnm.vercel.app/install | bash && exec $SHELL && fnm install 22
```

## Architecture

```
src/lib/graph.ts        nodes, edges, obstacles, haversine
src/lib/routing.ts      A* + the cost model          <- the core
src/lib/campus.ts       demo UTD slice (unverified)
src/lib/supabase.ts     reports table + schema
src/state/useReports.ts live reports, offline fallback
src/components/         MapView (Leaflet), ReportPanel
src/App.tsx             route comparison + Clarity Mode
agent/tools.ts          Beau's tool schema
agent/toolImpl.ts       what the tools actually do   <- all maths lives here
agent/beau.ts           Nemotron tool-calling loop
agent/photon.ts         iMessage bridge
agent/dev.ts            talk to Beau from the terminal
```

## The demo to rehearse

1. Website open, route Union → Library. Shows the step-free route and the
   **29-second gap**.
2. On your phone, text Beau: *"the elevator in the library is broken"*.
3. Beau resolves the location, asks to confirm, files the report.
4. The website reroutes **live** — the path turns, or goes red if nothing is left.

That loop hits Photon, Nemotron, Design and the community story in 40 seconds.
Rehearse it until it's boring.

### The cost model

Hard blockers return `Infinity` — stairs when you can't use stairs, a 95cm gap
when you need 100, a 7% grade when your limit is 5%. Everything else is seconds:
travel time, plus a fixed penalty per obstacle type (elevator 45s for call and
ride, manual door 8s), scaled by grade.

### Community reports change the graph

A report with **2+ net confirmations** makes an edge impassable. An unverified
one only adds 120s. One person having a bad day can't strand someone in a
wheelchair, but three people agreeing can close a path. That threshold is the
whole trust model.

### Verified behaviour

The algorithms were re-implemented in Python and run against the real graph and
alias table, because no JS runtime was available:

| Scenario | Result |
|---|---|
| Avoid stairs, Union → Library | 221s via ramp |
| Stairs allowed, same trip | 192s via steps — **29s accessibility gap** |
| Elevator with 3 confirmed reports | Floor 2 unreachable |
| Same report, 1 confirmation | Routes anyway, +120s |
| Need 100cm, curb cut is 95cm | Correctly refuses |
| Max grade 5%, ramp is 7% | Correctly refuses |
| *"the ramp by the library"* | resolves to Library — Ramp |
| *"the elevator in the library is broken"* | resolves to Library — Level 2 |
| *"get me to the business school"* | finds JSOM, asks which entrance |
| *"the library"* | ambiguous — asks instead of guessing |

## Tracks

Built for **NVIDIA (Nemotron)**, **Photon 2.0**, **Design**, and **Overall**.
See `docs/TRACKS.md` for the honest read on which are real and which are a stretch.

## Data honesty

The demo campus slice is **approximate and unverified**. Every surface that shows
it says so. An accessibility app that confidently shows a ramp that isn't there
is worse than one that admits it doesn't know — this is the one place where
polish must not outrun the data.
