import { useMemo, useState } from "react";
import { UTD_DEMO } from "./lib/campus";
import { compareRoutes, DEFAULT_PREFS, type Preferences } from "./lib/routing";
import { useReports } from "./state/useReports";
import MapView from "./components/MapView";
import ReportPanel from "./components/ReportPanel";

const NODE_IDS = Object.keys(UTD_DEMO.nodes);
const mins = (s: number) => `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;

export default function App() {
  const [from, setFrom] = useState("su_north");
  const [to, setTo] = useState("lib_door");
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS);
  const [clarity, setClarity] = useState(false);
  const { reports, submit, vote, live } = useReports();

  const result = useMemo(
    () => compareRoutes(UTD_DEMO, from, to, prefs, reports),
    [from, to, prefs, reports]
  );

  function toggleClarity() {
    const next = !clarity;
    setClarity(next);
    document.documentElement.dataset.clarity = next ? "on" : "off";
  }

  // Clicking the map fills whichever end you changed least recently.
  const [nextPick, setNextPick] = useState<"from" | "to">("to");
  function pick(id: string) {
    if (nextPick === "from") { setFrom(id); setNextPick("to"); }
    else { setTo(id); setNextPick("from"); }
  }

  return (
    <main className="min-h-screen p-5 sm:p-8 max-w-5xl mx-auto">
      <header className="flex items-baseline justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl neon-text text-cyan-neon tracking-tight">Beacon</h1>
          <p className="text-slate-400 text-sm mt-1">
            The city wasn't built for everyone. We're changing the map.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs ${live ? "text-cyan-neon" : "text-slate-500"}`}>
            {live ? "● live" : "○ demo data"}
          </span>
          <button onClick={toggleClarity} aria-pressed={clarity}
            className="px-3 py-2 border border-cyan-neon neon-edge rounded text-sm">
            Clarity Mode: {clarity ? "ON" : "OFF"}
          </button>
        </div>
      </header>

      <div className="grid lg:grid-cols-[1fr_340px] gap-6 mt-6">
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            {([["From", from, setFrom], ["To", to, setTo]] as const).map(([label, val, set]) => (
              <label key={label} className="flex flex-col gap-1 text-sm">
                <span className="text-slate-400">{label}</span>
                <select value={val} onChange={(e) => set(e.target.value)}
                  className="bg-panel border border-slate-700 rounded p-2">
                  {NODE_IDS.map((id) => (
                    <option key={id} value={id}>{UTD_DEMO.nodes[id].name}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          <MapView graph={UTD_DEMO} accessible={result.accessible}
            shortest={result.shortest} obstacles={reports} onPick={pick} />

          <fieldset className="border border-slate-800 rounded p-4">
            <legend className="px-2 text-sm text-slate-400">Accessibility needs</legend>
            <div className="flex flex-wrap gap-4 text-sm">
              {([["avoidStairs","Avoid stairs"],["avoidElevators","Avoid elevators"],["preferRamps","Prefer ramps"]] as const)
                .map(([key, label]) => (
                <label key={key} className="flex items-center gap-2">
                  <input type="checkbox" checked={prefs[key] as boolean}
                    onChange={(e) => setPrefs({ ...prefs, [key]: e.target.checked })} />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          <section aria-live="polite" className="space-y-3">
            {result.accessible ? (
              <article className="border border-cyan-neon neon-edge rounded p-4">
                <h2 className="text-cyan-neon mb-1 text-sm uppercase tracking-wide">Your route</h2>
                <p className="text-3xl">{mins(result.accessible.totalSeconds)}</p>
                <p className="text-slate-400 text-sm mt-1">
                  {Math.round(result.accessible.totalMeters)} m ·{" "}
                  {result.accessible.steps.map((s) => s.edge.kind).join(" → ")}
                </p>
              </article>
            ) : (
              // The most important state in an accessibility app, and the one
              // most teams never design. Never dead-end the user.
              <article className="border border-pink-neon rounded p-4">
                <h2 className="text-pink-neon mb-1">No step-free route</h2>
                <p className="text-sm text-slate-300">
                  Every known path needs something you've ruled out, or is closed by a
                  verified report. Try relaxing a filter — or report what you find, so the
                  next person isn't stuck too.
                </p>
              </article>
            )}

            {result.penaltySeconds !== null && result.penaltySeconds > 0 && (
              <p className="text-sm text-violet-neon border-l-2 border-violet-neon pl-3">
                This route costs <strong>{Math.round(result.penaltySeconds)}s more</strong> than
                the one someone without mobility needs would take. That gap is the thing
                we're measuring.
              </p>
            )}
          </section>
        </div>

        <aside className="lg:border-l lg:border-slate-800 lg:pl-6">
          <ReportPanel graph={UTD_DEMO} reports={reports} onSubmit={submit} onVote={vote} />
        </aside>
      </div>

      <p className="mt-10 text-xs text-slate-500">
        Demo data — coordinates, grades and ramp locations on this slice of campus are
        approximate and unverified.
      </p>
    </main>
  );
}
