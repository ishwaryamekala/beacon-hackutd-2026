import { useMemo, useState } from "react";
import { UTD_DEMO, DEMO_OBSTACLES } from "./lib/campus";
import { compareRoutes, DEFAULT_PREFS, type Preferences } from "./lib/routing";

const NODE_IDS = Object.keys(UTD_DEMO.nodes);

export default function App() {
  const [from, setFrom] = useState("su_north");
  const [to, setTo] = useState("lib_door");
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS);
  const [clarity, setClarity] = useState(false);

  const result = useMemo(
    () => compareRoutes(UTD_DEMO, from, to, prefs, DEMO_OBSTACLES),
    [from, to, prefs]
  );

  function toggleClarity() {
    const next = !clarity;
    setClarity(next);
    document.documentElement.dataset.clarity = next ? "on" : "off";
  }

  const mins = (s: number) => `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;

  return (
    <main className="min-h-screen p-6 max-w-3xl mx-auto">
      <header className="flex items-baseline justify-between flex-wrap gap-3 mb-6">
        <h1 className="text-3xl neon-text text-cyan-neon tracking-tight">PATH//ZERO</h1>
        <button
          onClick={toggleClarity}
          aria-pressed={clarity}
          className="px-3 py-2 border border-cyan-neon neon-edge rounded text-sm"
        >
          Clarity Mode: {clarity ? "ON" : "OFF"}
        </button>
      </header>
      <p className="text-slate-400 text-sm mb-6">The city wasn't built for everyone. We're changing the map.</p>

      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-400">From</span>
          <select value={from} onChange={(e) => setFrom(e.target.value)}
            className="bg-panel border border-slate-700 rounded p-2">
            {NODE_IDS.map((id) => <option key={id} value={id}>{UTD_DEMO.nodes[id].name}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-400">To</span>
          <select value={to} onChange={(e) => setTo(e.target.value)}
            className="bg-panel border border-slate-700 rounded p-2">
            {NODE_IDS.map((id) => <option key={id} value={id}>{UTD_DEMO.nodes[id].name}</option>)}
          </select>
        </label>
      </div>

      <fieldset className="mb-6 border border-slate-800 rounded p-4">
        <legend className="px-2 text-sm text-slate-400">Accessibility needs</legend>
        <div className="flex flex-wrap gap-4 text-sm">
          {([
            ["avoidStairs", "Avoid stairs"],
            ["avoidElevators", "Avoid elevators"],
            ["preferRamps", "Prefer ramps"],
          ] as const).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2">
              <input type="checkbox" checked={prefs[key] as boolean}
                onChange={(e) => setPrefs({ ...prefs, [key]: e.target.checked })} />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <section aria-live="polite" className="space-y-4">
        {result.accessible ? (
          <article className="border border-cyan-neon neon-edge rounded p-4">
            <h2 className="text-cyan-neon mb-1">Accessible route</h2>
            <p className="text-2xl">{mins(result.accessible.totalSeconds)}</p>
            <p className="text-slate-400 text-sm">
              {Math.round(result.accessible.totalMeters)} m ·{" "}
              {result.accessible.steps.map((s) => s.edge.kind).join(" → ")}
            </p>
          </article>
        ) : (
          // The most important state in an accessibility app, and the one most
          // teams forget to design. Never dead-end the user.
          <article className="border border-pink-neon rounded p-4">
            <h2 className="text-pink-neon mb-1">No step-free route found</h2>
            <p className="text-sm text-slate-300">
              Every known path needs something you've ruled out, or is blocked by a
              verified report. Try relaxing a filter, or report what you find so the
              next person knows.
            </p>
          </article>
        )}

        {result.penaltySeconds !== null && result.penaltySeconds > 0 && (
          <p className="text-sm text-violet-neon">
            The accessible route costs {Math.round(result.penaltySeconds)}s more than the
            shortest one. That gap is what we're trying to close.
          </p>
        )}
      </section>

      <p className="mt-10 text-xs text-slate-500">
        Demo data only — coordinates, grades and ramp locations on this slice of campus are
        approximate and unverified.
      </p>
    </main>
  );
}
