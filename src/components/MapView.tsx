import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip } from "react-leaflet";
import type { CampusGraph, Obstacle } from "../lib/graph";
import type { Route } from "../lib/routing";

const UTD_CENTER: [number, number] = [32.9859, -96.7489];

interface Props {
  graph: CampusGraph;
  accessible: Route | null;
  shortest: Route | null;
  obstacles: Obstacle[];
  onPick: (nodeId: string) => void;
}

const toLatLng = (route: Route, graph: CampusGraph): [number, number][] =>
  route.path.map((id) => [graph.nodes[id].lat, graph.nodes[id].lng]);

export default function MapView({ graph, accessible, shortest, obstacles, onPick }: Props) {
  const blockedNodes = new Set(obstacles.flatMap((o) => [o.edgeFrom, o.edgeTo]));

  return (
    <MapContainer
      center={UTD_CENTER}
      zoom={17}
      scrollWheelZoom
      className="h-[420px] w-full rounded border border-slate-800"
      // Leaflet's own panes aren't reachable by keyboard; the selects above the
      // map are the accessible path to the same actions.
      aria-label="Campus accessibility map"
    >
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />

      {/* Shortest route underneath, dimmed — the thing you can't take. */}
      {shortest && (
        <Polyline
          positions={toLatLng(shortest, graph)}
          pathOptions={{ color: "#64748b", weight: 4, opacity: 0.5, dashArray: "6 8" }}
        />
      )}

      {/* The accessible route on top, in neon. */}
      {accessible && (
        <Polyline
          positions={toLatLng(accessible, graph)}
          pathOptions={{ color: "#22d3ee", weight: 6, opacity: 0.95 }}
        />
      )}

      {Object.values(graph.nodes).map((n) => {
        const flagged = blockedNodes.has(n.id);
        return (
          <CircleMarker
            key={n.id}
            center={[n.lat, n.lng]}
            radius={flagged ? 9 : 6}
            pathOptions={{
              color: flagged ? "#f472b6" : "#a855f7",
              fillColor: flagged ? "#f472b6" : "#a855f7",
              fillOpacity: 0.85,
            }}
            eventHandlers={{ click: () => onPick(n.id) }}
          >
            <Tooltip direction="top">
              {n.name}
              {flagged ? " — reported obstacle" : ""}
            </Tooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
