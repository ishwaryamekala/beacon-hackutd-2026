import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { DEMO_OBSTACLES } from "../lib/campus";
import type { Obstacle } from "../lib/graph";

type RowShape = {
  id: string;
  edge_from: string;
  edge_to: string;
  kind: Obstacle["kind"];
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
});

/**
 * Reports live in Supabase when it's configured, and in memory when it isn't.
 * The offline path is not a fallback for emergencies -- it's how you demo at a
 * table with bad conference wifi, which is the likeliest failure on the day.
 */
export function useReports() {
  const [reports, setReports] = useState<Obstacle[]>(DEMO_OBSTACLES);
  const [live, setLive] = useState(false);

  const refresh = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from("reports").select("*").eq("resolved", false);
    if (!error && data) {
      setReports((data as RowShape[]).map(fromRow));
      setLive(true);
    }
  }, []);

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
        confirmations: 1, // the reporter counts as the first voice
        disputes: 0,
        resolved: false,
      };
      setReports((r) => [...r, optimistic]);
      if (supabase) {
        await supabase.from("reports").insert({
          edge_from: edgeFrom, edge_to: edgeTo, kind, note, confirmations: 1,
        });
        refresh();
      }
    },
    [refresh]
  );

  const vote = useCallback(
    async (id: string, agrees: boolean) => {
      setReports((rs) =>
        rs.map((r) =>
          r.id === id
            ? { ...r, confirmations: r.confirmations + (agrees ? 1 : 0), disputes: r.disputes + (agrees ? 0 : 1) }
            : r
        )
      );
      if (supabase && !id.startsWith("local_")) {
        const current = reports.find((r) => r.id === id);
        if (current) {
          await supabase
            .from("reports")
            .update({
              confirmations: current.confirmations + (agrees ? 1 : 0),
              disputes: current.disputes + (agrees ? 0 : 1),
            })
            .eq("id", id);
          refresh();
        }
      }
    },
    [reports, refresh]
  );

  return { reports, submit, vote, live };
}
