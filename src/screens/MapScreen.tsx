import { useState, type ReactNode } from "react";
import MapView from "../components/MapView";
import type { GraphEdge, GraphNode, Obstacle } from "../lib/graph";
import type { Route, RouteStep, Preferences } from "../lib/routing";
import type { ScreenProps } from "./types";

type BoolPref = "avoidStairs" | "avoidElevators" | "preferRamps";

const CHIPS: { key: BoolPref; label: string }[] = [
  { key: "avoidStairs", label: "Avoid stairs" },
  { key: "avoidElevators", label: "Avoid elevators" },
  { key: "preferRamps", label: "Prefer ramps" },
];

// Every edge in the demo data is approximate and unreviewed. Keep this false
// until a surveyed edge is marked as verified in the data.
const EDGE_VERIFIED = false;

const formatClock = (seconds: number) => {
  const total = Math.max(0, Math.round(seconds));
  const m = Math.floor(total / 60);
  const s = String(total % 60).padStart(2, "0");
  return `${m}:${s}`;
};

const formatMetres = (m: number) => `${Math.round(m)} m`;

const STEP_COPY: Record<GraphEdge["kind"], { icon: string; verb: string }> = {
  path: { icon: "→", verb: "Continue along the path to" },
  ramp: { icon: "↗", verb: "Take the ramp to" },
  elevator: { icon: "⇅", verb: "Take the elevator to" },
  stairs: { icon: "≡", verb: "Take the stairs to" },
  door: { icon: "▭", verb: "Go through the door to" },
  auto_door: { icon: "◫", verb: "Go through the automatic door to" },
  curb_cut: { icon: "⌒", verb: "Use the curb cut to" },
};

const sameEdge = (o: Obstacle, a: GraphNode, b: GraphNode) =>
  (o.edgeFrom === a.id && o.edgeTo === b.id) || (o.edgeFrom === b.id && o.edgeTo === a.id);

const hasStairs = (route: Route) => route.steps.some((s) => s.edge.kind === "stairs");

function Chip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={[
        "shrink-0 min-h-[44px] rounded-full border px-4 text-sm transition-colors",
        pressed
          ? "border-firefly text-firefly bg-firefly/10"
          : "border-slate-700 text-slate-400 bg-transparent",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function StepRow({
  step,
  index,
  reported,
}: {
  step: RouteStep;
  index: number;
  reported: boolean;
}) {
  const copy = STEP_COPY[step.edge.kind];
  return (
    <li className="flex gap-3 border-t border-slate-800 py-3 first:border-t-0">
      <span
        aria-hidden
        className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-violet-neon/50 text-violet-neon"
      >
        {copy.icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-100">
          <span className="sr-only">Step {index + 1}: </span>
          {copy.verb} {step.to.name}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-400">{formatMetres(step.edge.meters)}</span>
          <span className="rounded border border-slate-700 px-1.5 py-0.5 text-slate-400">
            {EDGE_VERIFIED ? "verified" : "unverified"}
          </span>
          {reported && (
            <span className="rounded border border-pink-neon/60 px-1.5 py-0.5 text-pink-neon">
              ⚠ reported
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

export default function MapScreen({ app }: ScreenProps) {
  const nodes = Object.values(app.graph.nodes).sort((a, b) => a.name.localeCompare(b.name));
  const openReports = app.reports.filter((r) => !r.resolved);
  const [nextPick, setNextPick] = useState<"from" | "to">("from");
  const isSaved = app.favorites.includes(app.to);
  const { accessible, shortest, penaltySeconds } = app.result;

  const togglePref = (key: BoolPref) => {
    const next: Preferences = { ...app.prefs, [key]: !app.prefs[key] };
    app.setPrefs(next);
  };

  const onPick = (id: string) => {
    if (nextPick === "from") {
      app.setFrom(id);
      setNextPick("to");
    } else {
      app.setTo(id);
      setNextPick("from");
    }
  };

  const swap = () => {
    const f = app.from;
    app.setFrom(app.to);
    app.setTo(f);
  };

  const fromName = app.graph.nodes[app.from]?.name ?? app.from;
  const toName = app.graph.nodes[app.to]?.name ?? app.to;

  return (
    <div className="flex flex-col gap-4 px-4 pt-4">
      {/* From / To */}
      <section aria-label="Route endpoints" className="flex items-end gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <label htmlFor="map-from" className="text-xs uppercase tracking-wider text-slate-400">
            From
          </label>
          <select
            id="map-from"
            value={app.from}
            onChange={(e) => app.setFrom(e.target.value)}
            className="min-h-[44px] w-full truncate rounded-lg border border-slate-700 bg-panel px-3 text-sm text-slate-100 focus:border-cyan-neon"
          >
            {nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={swap}
          aria-label="Swap start and destination"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-slate-700 bg-panel text-lg text-firefly"
        >
          <span aria-hidden>⇅</span>
        </button>

        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <label htmlFor="map-to" className="text-xs uppercase tracking-wider text-slate-400">
            To
          </label>
          <select
            id="map-to"
            value={app.to}
            onChange={(e) => app.setTo(e.target.value)}
            className="min-h-[44px] w-full truncate rounded-lg border border-slate-700 bg-panel px-3 text-sm text-slate-100 focus:border-cyan-neon"
          >
            {nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Preference chips */}
      <div
        role="group"
        aria-label="Route preferences"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {CHIPS.map((c) => (
          <Chip key={c.key} pressed={!!app.prefs[c.key]} onClick={() => togglePref(c.key)}>
            {c.label}
          </Chip>
        ))}
      </div>

      {/* Map */}
      <div className="flex flex-col gap-2">
        <MapView
          graph={app.graph}
          accessible={accessible}
          shortest={shortest}
          obstacles={openReports}
          onPick={onPick}
          height="52vh"
        />
        <p className="text-xs text-slate-400">
          Tap a point to set your{" "}
          <span className="text-firefly">{nextPick === "from" ? "start" : "destination"}</span>.
        </p>
      </div>

      {/* Route comparison */}
      <div aria-live="polite" className="flex flex-col gap-3">
        {accessible ? (
          <section
            aria-label="Accessible route"
            className="neon-edge rounded-xl border border-firefly/60 bg-panel p-4"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-xs uppercase tracking-wider text-firefly">Accessible route</h2>
              <span className="text-xs text-slate-400">{fromName} to {toName}</span>
            </div>
            <div className="mt-2 flex items-baseline gap-4">
              <p className="neon-text text-4xl font-semibold tabular-nums text-firefly">
                {formatClock(accessible.totalSeconds)}
              </p>
              <p className="text-sm text-slate-300">{formatMetres(accessible.totalMeters)}</p>
            </div>
          </section>
        ) : (
          <section
            aria-label="No step-free route"
            className="rounded-xl border border-pink-neon/60 bg-panel p-4"
          >
            <h2 className="text-xs uppercase tracking-wider text-pink-neon">No step-free route</h2>
            <p className="mt-2 text-sm text-slate-300">
              Every known path needs something you've ruled out, or is closed by a verified report.
              Try relaxing a filter — or report what you find.
            </p>
            <button
              type="button"
              onClick={() => app.goTo("report")}
              className="mt-3 min-h-[44px] rounded-lg border border-pink-neon px-4 text-sm text-pink-neon hover:bg-pink-neon/10"
            >
              Report an obstacle
            </button>
          </section>
        )}

        {shortest && (
          <section
            aria-label="Shortest route"
            className="rounded-xl border border-slate-700 bg-panel/60 p-4"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-xs uppercase tracking-wider text-slate-400">Shortest route</h2>
              {hasStairs(shortest) && (
                <span className="rounded border border-pink-neon/60 px-1.5 py-0.5 text-xs text-pink-neon">
                  includes stairs
                </span>
              )}
            </div>
            <div className="mt-2 flex items-baseline gap-4">
              <p className="text-2xl font-semibold tabular-nums text-slate-400">
                {formatClock(shortest.totalSeconds)}
              </p>
              <p className="text-sm text-slate-500">{formatMetres(shortest.totalMeters)}</p>
            </div>
          </section>
        )}

        {penaltySeconds !== null && penaltySeconds > 0 && (
          <p className="text-sm text-violet-neon">
            This route costs {Math.round(penaltySeconds)}s more than the shortest path.
          </p>
        )}
      </div>

      {/* Save destination */}
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-sm text-slate-300">
          Destination: <span className="text-slate-100">{toName}</span>
        </p>
        <button
          type="button"
          aria-pressed={isSaved}
          aria-label={isSaved ? "Remove destination from saved places" : "Save destination"}
          onClick={() => app.toggleFavorite(app.to)}
          className={[
            "grid h-11 w-11 shrink-0 place-items-center rounded-full border text-xl",
            isSaved
              ? "border-firefly text-firefly bg-firefly/10"
              : "border-slate-700 text-slate-400",
          ].join(" ")}
        >
          <span aria-hidden>{isSaved ? "★" : "☆"}</span>
        </button>
      </div>

      {/* Step-by-step directions */}
      {accessible && (
        <section aria-labelledby="directions-heading" className="rounded-xl border border-slate-800 p-4">
          <h2 id="directions-heading" className="text-xs uppercase tracking-wider text-slate-400">
            Directions
          </h2>
          <ol className="mt-2">
            {accessible.steps.map((step, i) => {
              const reported = openReports.some((o) => sameEdge(o, step.from, step.to));
              return (
                <StepRow
                  key={`${step.from.id}-${step.to.id}-${i}`}
                  step={step}
                  index={i}
                  reported={reported}
                />
              );
            })}
          </ol>
        </section>
      )}

      <p className="pb-2 text-center text-xs text-slate-500">
        Demo data — coordinates and ramp locations are approximate.
      </p>
    </div>
  );
}
