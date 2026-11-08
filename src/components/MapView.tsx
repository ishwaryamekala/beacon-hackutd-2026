import type { CSSProperties } from "react";
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
  /** CSS height of the map frame, e.g. "52vh". */
  height?: string;
}

const toLatLng = (route: Route, graph: CampusGraph): [number, number][] =>
  route.path.map((id) => [graph.nodes[id].lat, graph.nodes[id].lng]);

// Node ids that stand for accessible infrastructure get a cyan marker.
const isAccessibleInfra = (id: string) => /door|ramp|curb/i.test(id);

const frameStyle = (height: string): CSSProperties => ({ height });

export default function MapView({
  graph,
  accessible,
  shortest,
  obstacles,
  onPick,
  height = "420px",
}: Props) {
  const blockedNodes = new Set(obstacles.flatMap((o) => [o.edgeFrom, o.edgeTo]));

  return (
    // Frame: rounded, neon-edged, with a shadow beneath it so the map reads as a
    // slightly raised plate. `isolate` keeps Leaflet's controls above the vignette.
    <div
      className="neon-edge relative isolate w-full overflow-hidden rounded-2xl border border-firefly/30 shadow-[0_22px_28px_-18px_rgba(0,0,0,0.95)]"
      style={frameStyle(height)}
    >
      <MapContainer
        center={UTD_CENTER}
        zoom={17}
        scrollWheelZoom
        className="beacon-map h-full w-full bg-void"
        // Leaflet's own panes aren't reachable by keyboard; the selects above the
        // map are the accessible path to the same actions.
        aria-label="Campus accessibility map"
      >
        {/* Esri Dark Gray Canvas: free, no API key. (CARTO now needs a key and
            OSM's volunteer servers block apps.) Native tiles stop at z16, so
            Leaflet upscales them for the closer campus zoom levels. */}
        <TileLayer
          attribution="Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors"
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
          maxNativeZoom={16}
          maxZoom={19}
        />
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
          maxNativeZoom={16}
          maxZoom={19}
        />

        {/* Shortest route underneath, dimmed: the one you can't take. */}
        {shortest && (
          <Polyline
            positions={toLatLng(shortest, graph)}
            pathOptions={{
              color: "#64748b",
              weight: 4,
              opacity: 0.5,
              dashArray: "6 8",
            }}
          />
        )}

        {/* Accessible route: a wide faint glow, then a crisp flowing line on top. */}
        {accessible && (
          <>
            <Polyline
              positions={toLatLng(accessible, graph)}
              pathOptions={{ color: "#d4ff3a", weight: 14, opacity: 0.25, lineCap: "round" }}
            />
            <Polyline
              positions={toLatLng(accessible, graph)}
              pathOptions={{
                color: "#d4ff3a",
                weight: 5,
                opacity: 1,
                lineCap: "round",
                lineJoin: "round",
                dashArray: "10 6",
                className: "route-flow",
              }}
            />
          </>
        )}

        {Object.values(graph.nodes).map((n) => {
          const flagged = blockedNodes.has(n.id);
          const infra = !flagged && isAccessibleInfra(n.id);
          const color = flagged ? "#f472b6" : infra ? "#22d3ee" : "#a855f7";
          return (
            <CircleMarker
              key={n.id}
              center={[n.lat, n.lng]}
              radius={flagged ? 10 : infra ? 7 : 5.5}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: 0.85,
                weight: 1.5,
                className: flagged ? "pulse-marker" : undefined,
              }}
              eventHandlers={{ click: () => onPick(n.id) }}
            >
              <Tooltip direction="top">
                {n.name}
                {flagged ? " (reported obstacle)" : ""}
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>

      {/* Vignette: darkens the edges for depth. Purely decorative. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-[450] rounded-2xl"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 55%, rgba(5,6,10,0.7) 100%)",
          boxShadow: "inset 0 0 40px rgba(5,6,10,0.85)",
        }}
      />
    </div>
  );
}
