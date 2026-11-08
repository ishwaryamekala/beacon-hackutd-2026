import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { CampusGraph, Obstacle } from "../lib/graph";

interface Props {
  graph: CampusGraph;
  reports: Obstacle[];
  onSubmit: (from: string, to: string, kind: Obstacle["kind"], note?: string) => void;
  onVote: (id: string, agrees: boolean) => void;
}

type Kind = Obstacle["kind"];

const VERIFY_THRESHOLD = 2;

/** "Broken elevator" etc. are the user-facing names for the four Obstacle kinds. */
export const CATEGORIES: { kind: Kind; label: string; icon: ReactNode }[] = [
  {
    kind: "broken",
    label: "Broken elevator",
    icon: (
      <path d="M6 3h12v18H6zM12 3v18M9 10l3-3 3 3M9 14l3 3 3-3" />
    ),
  },
  {
    kind: "blocked",
    label: "Blocked ramp / pathway",
    icon: <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM5.6 5.6l12.8 12.8" />,
  },
  {
    kind: "construction",
    label: "Construction",
    icon: <path d="M12 3l10 18H2zM12 10v5M12 18v.01" />,
  },
  {
    kind: "crowded",
    label: "Crowded / temporary",
    icon: (
      <path d="M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM16 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M14.5 14.2c2.9.3 6.5 1.8 6.5 5.8" />
    ),
  },
];

const categoryLabel = (kind: Kind) =>
  CATEGORIES.find((c) => c.kind === kind)?.label ?? kind;

/** Human-scale relative time: "just now", "12 min ago", "3 h ago", "2 d ago". */
export function timeAgo(ts: number, now: number = Date.now()): string {
  const min = Math.round((now - ts) / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

function statusOf(r: Obstacle): { label: string; className: string } {
  if (r.resolved)
    return { label: "Resolved", className: "bg-slate-800 text-slate-300 border-slate-600" };
  if (r.disputes > r.confirmations)
    return { label: "Disputed", className: "bg-violet-neon/15 text-violet-neon border-violet-neon" };
  if (r.confirmations >= VERIFY_THRESHOLD)
    return { label: "Confirmed", className: "bg-firefly/15 text-firefly border-firefly" };
  return { label: "Unverified", className: "bg-transparent text-pink-neon border-pink-neon" };
}

export default function ReportPanel({ graph, reports, onSubmit, onVote }: Props) {
  // Single select value "from|to", matching the original behaviour.
  const [stretch, setStretch] = useState("");
  const [kind, setKind] = useState<Kind | null>(null);
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // Success message disappears after ~3 s.
  useEffect(() => {
    if (!sent) return;
    const t = window.setTimeout(() => setSent(false), 3000);
    return () => window.clearTimeout(t);
  }, [sent]);

  // "Link copied" disappears after ~2 s.
  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(null), 2000);
    return () => window.clearTimeout(t);
  }, [copied]);

  const nameOf = (id: string) => graph.nodes[id]?.name ?? id;
  const canSubmit = Boolean(stretch && kind);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!stretch || !kind) return;
    const [from, to] = stretch.split("|");
    onSubmit(from, to, kind, note.trim() || undefined);
    setNote("");
    setKind(null);
    setStretch("");
    setSent(true);
  };

  const share = async (id: string) => {
    try {
      await navigator.clipboard.writeText(`${location.origin}/?report=${id}`);
      setCopied(id);
    } catch {
      // Clipboard can be blocked (insecure context, permissions). Fail quietly.
    }
  };

  const sorted = [...reports].sort((a, b) => b.reportedAt - a.reportedAt);

  return (
    <div className="space-y-6">
      <form onSubmit={submit} className="bg-panel border border-slate-800 rounded-xl p-4 space-y-5">
        <fieldset className="space-y-3">
          <legend className="text-xs uppercase tracking-widest text-slate-400 mb-3">
            What's the problem?
          </legend>
          <div className="grid grid-cols-2 gap-3">
            {CATEGORIES.map((c) => {
              const pressed = kind === c.kind;
              return (
                <button
                  key={c.kind}
                  type="button"
                  aria-pressed={pressed}
                  onClick={() => setKind(c.kind)}
                  className={[
                    "min-h-[104px] rounded-xl border p-3 flex flex-col items-start justify-between gap-2 text-left text-sm transition-colors",
                    pressed
                      ? "border-firefly text-firefly bg-firefly/10 neon-edge"
                      : "border-slate-700 text-slate-200 bg-void hover:border-slate-500",
                  ].join(" ")}
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-7 w-7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.75}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    {c.icon}
                  </svg>
                  <span>{c.label}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <label className="flex flex-col gap-2 text-sm">
          <span className="text-xs uppercase tracking-widest text-slate-400">Which stretch?</span>
          <select
            className="bg-void border border-slate-700 rounded-lg px-3 min-h-[44px] text-slate-100"
            value={stretch}
            onChange={(e) => setStretch(e.target.value)}
          >
            <option value="">Select a stretch…</option>
            {graph.edges.map((e) => (
              <option key={`${e.from}|${e.to}`} value={`${e.from}|${e.to}`}>
                {`${nameOf(e.from)} → ${nameOf(e.to)}`}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm">
          <span className="text-xs uppercase tracking-widest text-slate-400">
            Description (optional)
          </span>
          <textarea
            className="bg-void border border-slate-700 rounded-lg p-3 min-h-[88px] text-slate-100 resize-y"
            maxLength={200}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Out of service since Tuesday"
          />
        </label>

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full min-h-[48px] rounded-xl bg-firefly text-void font-semibold neon-edge disabled:opacity-40 disabled:shadow-none"
        >
          Submit report
        </button>

        <p role="status" aria-live="polite" className="text-sm text-firefly min-h-[1.25rem]">
          {sent ? "Reported. Thanks — Beau is rerouting everyone." : ""}
        </p>
      </form>

      <section className="space-y-3">
        <h2 className="text-xs uppercase tracking-widest text-slate-400">Community reports</h2>
        {sorted.length === 0 && (
          <p className="text-sm text-slate-400">No reports yet. Be the first to flag something.</p>
        )}
        <ul className="space-y-3">
          {sorted.map((r) => {
            const status = statusOf(r);
            return (
              <li key={r.id} className="bg-panel border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-100">{categoryLabel(r.kind)}</p>
                    <p className="text-sm text-slate-300 break-words">
                      {`${nameOf(r.edgeFrom)} → ${nameOf(r.edgeTo)}`}
                    </p>
                    <time dateTime={new Date(r.reportedAt).toISOString()} className="text-xs text-slate-500">
                      {timeAgo(r.reportedAt)}
                    </time>
                  </div>
                  <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full border ${status.className}`}>
                    {status.label}
                  </span>
                </div>

                <p className="text-xs text-slate-400" aria-label="Verification counts">
                  <span className="text-slate-200">✓ {r.confirmations}</span>
                  <span className="mx-2 text-slate-600">·</span>
                  <span className="text-slate-200">✗ {r.disputes}</span>
                </p>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onVote(r.id, true)}
                    className="min-h-[44px] px-3 rounded-lg border border-slate-700 text-sm hover:border-firefly hover:text-firefly"
                  >
                    Still there
                  </button>
                  <button
                    type="button"
                    onClick={() => onVote(r.id, false)}
                    className="min-h-[44px] px-3 rounded-lg border border-slate-700 text-sm hover:border-violet-neon hover:text-violet-neon"
                  >
                    Not there
                  </button>
                  <button
                    type="button"
                    onClick={() => share(r.id)}
                    className="min-h-[44px] px-3 rounded-lg border border-slate-700 text-sm text-slate-300 hover:border-cyan-neon hover:text-cyan-neon"
                  >
                    {copied === r.id ? "Link copied" : "Share"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
