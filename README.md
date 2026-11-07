# PATH//ZERO

**The city wasn't built for everyone. We're changing the map.**

AI-powered accessibility navigation for campuses. Most navigation apps answer
"what's the shortest way?" PATH//ZERO answers "what's the fastest way *I* can
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
| A* router with accessibility costs | **Built and verified** |
| Demo campus graph (13 nodes, 15 edges) | Built — coordinates unverified |
| Community reports + verification model | Built in the cost function; Supabase table pending |
| React UI with Clarity Mode | Scaffolded |
| Leaflet map | Not started |
| ZERO agent (Nemotron + Photon) | Tool schema + prompt written; not wired |

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
src/lib/graph.ts     nodes, edges, obstacles, haversine
src/lib/routing.ts   A* + the cost model      <- the core
src/lib/campus.ts    demo UTD slice (unverified)
src/lib/supabase.ts  reports table + schema
src/App.tsx          route comparison UI
agent/tools.ts       ZERO's tool surface for Nemotron
```

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

Checked against the real demo graph:

| Scenario | Result |
|---|---|
| Avoid stairs, Union → Library | 221s via ramp |
| Stairs allowed, same trip | 192s via steps — **29s accessibility gap** |
| Elevator with 3 confirmed reports | Floor 2 unreachable |
| Same report, 1 confirmation | Routes anyway, +120s |
| Need 100cm, curb cut is 95cm | Correctly refuses |
| Max grade 5%, ramp is 7% | Correctly refuses |

## Tracks

Built for **NVIDIA (Nemotron)**, **Photon 2.0**, **Design**, and **Overall**.
See `docs/TRACKS.md` for the honest read on which are real and which are a stretch.

## Data honesty

The demo campus slice is **approximate and unverified**. Every surface that shows
it says so. An accessibility app that confidently shows a ramp that isn't there
is worse than one that admits it doesn't know — this is the one place where
polish must not outrun the data.
