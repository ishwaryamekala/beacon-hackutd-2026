import { useState } from "react";
import type { CampusGraph, Obstacle } from "../lib/graph";

interface Props {
  graph: CampusGraph;
  reports: Obstacle[];
  onSubmit: (from: string, to: string, kind: Obstacle["kind"], note?: string) => void;
  onVote: (id: string, agrees: boolean) => void;
}

const KINDS: Obstacle["kind"][] = ["broken", "blocked", "construction", "crowded"];
const VERIFY_THRESHOLD = 2;

export default function ReportPanel({ graph, reports, onSubmit, onVote }: Props) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [kind, setKind] = useState<Obstacle["kind"]>("blocked");
  const [note, setNote] = useState("");

  // Only offer edges that exist, so a report can never point at nothing.
  const edges = graph.edges;

  return (
    <section className="space-y-4">
      <h2 className="text-violet-neon neon-text">Report an obstacle</h2>

      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!from || !to) return;
          onSubmit(from, to, kind, note || undefined);
          setNote("");
        }}
      >
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="text-slate-400">Which stretch?</span>
          <select
            className="bg-panel border border-slate-700 rounded p-2"
            value={from && to ? `${from}|${to}` : ""}
            onChange={(e) => {
              const [f, t] = e.target.value.split("|");
              setFrom(f ?? "");
              setTo(t ?? "");
            }}
          >
            <option value="">Select…</option>
            {edges.map((e) => (
              <option key={`${e.from}|${e.to}`} value={`${e.from}|${e.to}`}>
                {graph.nodes[e.from].name} → {graph.nodes[e.to].name} ({e.kind})
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-400">What's wrong?</span>
          <select className="bg-panel border border-slate-700 rounded p-2"
            value={kind} onChange={(e) => setKind(e.target.value as Obstacle["kind"])}>
            {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-slate-400">Note (optional)</span>
          <input className="bg-panel border border-slate-700 rounded p-2"
            value={note} onChange={(e) => setNote(e.target.value)} placeholder="out of service since Tuesday" />
        </label>

        <button type="submit"
          className="sm:col-span-2 px-4 py-2 border border-violet-neon neon-edge rounded disabled:opacity-40"
          disabled={!from || !to}>
          Submit report
        </button>
      </form>

      <h3 className="text-slate-400 text-sm pt-2">Active reports</h3>
      <ul className="space-y-2">
        {reports.filter((r) => !r.resolved).map((r) => {
          const net = r.confirmations - r.disputes;
          const verified = net >= VERIFY_THRESHOLD;
          return (
            <li key={r.id} className="border border-slate-800 rounded p-3 text-sm">
              <div className="flex justify-between gap-3 flex-wrap">
                <span>
                  {graph.nodes[r.edgeFrom]?.name} → {graph.nodes[r.edgeTo]?.name}
                  <span className="text-slate-500"> · {r.kind}</span>
                </span>
                <span className={verified ? "text-pink-neon" : "text-slate-500"}>
                  {verified ? "VERIFIED — path closed" : `${net}/${VERIFY_THRESHOLD} to verify`}
                </span>
              </div>
              <div className="flex gap-2 mt-2">
                <button onClick={() => onVote(r.id, true)}
                  className="px-2 py-1 border border-slate-700 rounded text-xs">
                  Still a problem ({r.confirmations})
                </button>
                <button onClick={() => onVote(r.id, false)}
                  className="px-2 py-1 border border-slate-700 rounded text-xs">
                  It's fixed ({r.disputes})
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
