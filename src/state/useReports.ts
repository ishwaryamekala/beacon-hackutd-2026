import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { DEMO_OBSTACLES } from "../lib/campus";
import type { Obstacle } from "../lib/graph";

type RowShape = {
  id: string;
  edge_from: string;
  edge_to: string;
  kind: Obstacle["kind"];
  note: string | null;
  source: Obstacle["source"] | null;
  photo_url: string | null;
  reported_at: string;
  confirmations: number;
  disputes: number;
  resolved: boolean;
};

const fromRow = (r: RowShape): Obstacle => ({
  id: r.id,
  edgeFrom: r.edge_from,
  edgeTo: r.edge_to,
  kind: r.kind,
  reportedAt: new Date(r.reported_at).getTime(),
  confirmations: r.confirmations,
  disputes: r.disputes,
  resolved: r.resolved,
  note: r.note ?? undefined,
  source: r.source ?? undefined,
  photoUrl: r.photo_url ?? undefined,
});

/** Two or more net disputes and the community considers the obstacle gone. */
const RESOLVE_THRESHOLD = -2;

/**
 * Reports live in Supabase when it's configured, and in memory when it isn't.
 * The offline path is not a fallback for emergencies -- it's how you demo at a
 * table with bad conference wifi, which is the likeliest failure on the day.
 */
export function useReports() {
  const [reports, setReports] = useState<Obstacle[]>(DEMO_OBSTACLES);
  const [live, setLive] = useState(false);

  // Always-current copy of the list. Event handlers read from here instead of
  // a closed-over `reports`, so back-to-back votes don't compute from stale counts.
  const reportsRef = useRef<Obstacle[]>(DEMO_OBSTACLES);
  const commit = useCallback((next: Obstacle[]) => {
    reportsRef.current = next;
    setReports(next);
  }, []);

  const refresh = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("reports")
      .select("*")
      .eq("resolved", false)
      .order("reported_at", { ascending: false });
    if (!error && data) {
      commit((data as RowShape[]).map(fromRow));
      setLive(true);
    }
  }, [commit]);

  useEffect(() => {
    refresh();
    const client = supabase;
    if (!client) return;
    // Realtime is what sells the demo: text ZERO, watch the website reroute.
    const channel = client
      .channel("reports-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "reports" }, refresh)
      .subscribe();
    return () => {
      client.removeChannel(channel);
    };
  }, [refresh]);

  const submit = useCallback(
    async (edgeFrom: string, edgeTo: string, kind: Obstacle["kind"], note?: string) => {
      const optimistic: Obstacle = {
        id: `local_${Date.now()}`,
        edgeFrom,
        edgeTo,
        kind,
        reportedAt: Date.now(),
        confirmations: 1, // the reporter counts as the first voice (DB default is also 1)
        disputes: 0,
        resolved: false,
        note,
        source: "web",
      };
      commit([...reportsRef.current, optimistic]);
      if (supabase) {
        const { error } = await supabase.from("reports").insert({
          edge_from: edgeFrom,
          edge_to: edgeTo,
          kind,
          note,
          source: "web",
        });
        if (error) console.warn("Beacon: report not saved", error.message);
        refresh();
      }
    },
    [commit, refresh]
  );

  const vote = useCallback(
    async (id: string, agrees: boolean) => {
      const current = reportsRef.current.find((r) => r.id === id);
      if (!current) return;

      const confirmations = current.confirmations + (agrees ? 1 : 0);
      const disputes = current.disputes + (agrees ? 0 : 1);
      const resolved = current.resolved || (!agrees && confirmations - disputes <= RESOLVE_THRESHOLD);

      commit(
        reportsRef.current.map((r) =>
          r.id === id ? { ...r, confirmations, disputes, resolved } : r
        )
      );

      if (supabase && !id.startsWith("local_")) {
        const { error } = await supabase
          .from("reports")
          .update({ confirmations, disputes, resolved })
          .eq("id", id);
        if (error) console.warn("Beacon: vote not saved", error.message);
        refresh();
      }
    },
    [commit, refresh]
  );

  return { reports, submit, vote, live };
}
