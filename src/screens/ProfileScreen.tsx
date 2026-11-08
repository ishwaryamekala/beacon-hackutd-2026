import { useId, type ReactNode } from "react";
import Beau from "../components/Beau";
import { timeAgo, CATEGORIES } from "../components/ReportPanel";
import type { Preferences } from "../lib/routing";
import type { ScreenProps } from "./types";

const ADA_MAX_GRADE = 0.083;

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint?: string;
}) {
  const labelId = useId();
  const hintId = useId();
  return (
    <div className="flex items-center justify-between gap-4 min-h-[44px] py-2">
      <div className="min-w-0">
        <span id={labelId} className="block text-sm text-slate-100">
          {label}
        </span>
        {hint && (
          <span id={hintId} className="block text-xs text-slate-400">
            {hint}
          </span>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        aria-describedby={hint ? hintId : undefined}
        onClick={() => onChange(!checked)}
        className={[
          "relative shrink-0 h-7 w-12 rounded-full border transition-colors",
          checked ? "bg-firefly border-firefly neon-edge" : "bg-slate-800 border-slate-600",
        ].join(" ")}
      >
        <span
          aria-hidden="true"
          className={[
            "absolute top-0.5 left-0.5 h-5 w-5 rounded-full transition-transform",
            checked ? "translate-x-5 bg-void" : "translate-x-0 bg-slate-400",
          ].join(" ")}
        />
      </button>
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="bg-panel border border-slate-800 rounded-xl p-4 space-y-3">
      <h2 className="text-xs uppercase tracking-widest text-slate-400">{title}</h2>
      {children}
    </section>
  );
}

export default function ProfileScreen({ app }: ScreenProps) {
  const { prefs } = app;
  const set = (patch: Partial<Preferences>) => app.setPrefs({ ...prefs, ...patch });
  const gradeId = useId();
  const speedId = useId();

  const nameOf = (id: string) => app.graph.nodes[id]?.name ?? id;

  return (
    <div className="px-4 py-6 space-y-6">
      <header className="flex items-center gap-4">
        <Beau size={56} />
        <h1 className="text-2xl text-firefly neon-text">Your Beacon</h1>
      </header>

      <Card title="Accessibility preferences">
        <div className="divide-y divide-slate-800">
          <Toggle
            label="Step-free navigation"
            hint="Never route over stairs"
            checked={prefs.avoidStairs}
            onChange={(v) => set({ avoidStairs: v })}
          />
          <Toggle
            label="Avoid elevators"
            hint="Use ramps and paths instead"
            checked={prefs.avoidElevators}
            onChange={(v) => set({ avoidElevators: v })}
          />
          <Toggle
            label="Prefer ramps"
            hint="Pick a ramp when two routes are similar"
            checked={prefs.preferRamps}
            onChange={(v) => set({ preferRamps: v })}
          />
        </div>

        <div className="space-y-2 pt-2">
          <div className="flex items-baseline justify-between">
            <label htmlFor={gradeId} className="text-sm text-slate-100">
              Max ramp grade
            </label>
            <output htmlFor={gradeId} className="text-sm text-firefly">
              {(prefs.maxGrade * 100).toFixed(1)}%
            </output>
          </div>
          <input
            id={gradeId}
            type="range"
            min={0.04}
            max={0.12}
            step={0.005}
            value={prefs.maxGrade}
            onChange={(e) => set({ maxGrade: Number(e.target.value) })}
            className="w-full h-11 accent-firefly"
          />
          <p className="text-xs text-slate-400">ADA max {(ADA_MAX_GRADE * 100).toFixed(1)}%</p>
        </div>

        <div className="space-y-2 pt-2">
          <div className="flex items-baseline justify-between">
            <label htmlFor={speedId} className="text-sm text-slate-100">
              Rolling speed
            </label>
            <output htmlFor={speedId} className="text-sm text-firefly">
              {prefs.speed.toFixed(2)} m/s
            </output>
          </div>
          <input
            id={speedId}
            type="range"
            min={0.6}
            max={1.6}
            step={0.05}
            value={prefs.speed}
            onChange={(e) => set({ speed: Number(e.target.value) })}
            className="w-full h-11 accent-firefly"
          />
        </div>

        <div className="flex flex-col gap-3 pt-2">
          <p className="text-xs text-slate-400">
            Saved on this device and applied to every route.
          </p>
          <button
            type="button"
            onClick={() => {
              if (confirm("Reset all accessibility preferences to their defaults?")) {
                app.resetPrefs();
              }
            }}
            className="min-h-[44px] rounded-lg border border-slate-700 text-sm text-slate-200 hover:border-violet-neon hover:text-violet-neon"
          >
            Reset preferences
          </button>
        </div>
      </Card>

      <Card title="Display">
        <Toggle
          label="Clarity Mode"
          hint="Removes glow and raises contrast."
          checked={app.clarity}
          onChange={(v) => app.setClarity(v)}
        />
      </Card>

      <Card title="Your reports">
        {app.myReports.length === 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-300">You haven't reported anything yet.</p>
            <button
              type="button"
              onClick={() => app.goTo("report")}
              className="min-h-[44px] px-4 rounded-lg bg-firefly text-void text-sm font-semibold"
            >
              Report an obstacle
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-slate-800">
            {app.myReports.map((r) => {
              const kind = CATEGORIES.find((c) => c.kind === r.kind)?.label ?? r.kind;
              return (
                <li key={`${r.at}-${r.from}-${r.to}`} className="py-3 space-y-1">
                  <p className="text-sm text-slate-100">{kind}</p>
                  <p className="text-sm text-slate-400 break-words">
                    {`${nameOf(r.from)} → ${nameOf(r.to)}`}
                  </p>
                  <time dateTime={new Date(r.at).toISOString()} className="text-xs text-slate-500">
                    {timeAgo(r.at)}
                  </time>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
