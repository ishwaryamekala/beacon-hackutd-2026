import { useMemo, useState } from "react";
import type { ScreenProps } from "./types";
import Beau from "../components/Beau";

const MAX_SUGGESTIONS = 6;
const MAX_REPORTS = 3;

function timeAgo(ts: number): string {
  const mins = Math.round((Date.now() - ts) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  return `${Math.round(hrs / 24)} d ago`;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function HomeScreen({ app }: ScreenProps) {
  const { graph, favorites, recents, reports, live, startRoute, toggleFavorite, goTo } = app;
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const nameOf = (id: string) => graph.nodes[id]?.name ?? id;

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return Object.values(graph.nodes)
      .filter((n) => n.name.toLowerCase().includes(q))
      .slice(0, MAX_SUGGESTIONS);
  }, [graph, query]);

  const favoriteNodes = favorites.filter((id) => graph.nodes[id]);

  const openReports = useMemo(
    () => reports.filter((r) => !r.resolved).sort((a, b) => b.reportedAt - a.reportedAt).slice(0, MAX_REPORTS),
    [reports]
  );

  return (
    <div className="px-4 pt-4 pb-6 flex flex-col gap-7">
      {/* Header */}
      <header className="flex items-center justify-between min-h-[44px]">
        <span className="text-firefly neon-text font-bold tracking-[0.25em] text-sm">BEACON</span>
        <span
          className={`text-xs rounded-full border px-3 py-1 ${
            live ? "border-firefly/50 text-firefly" : "border-slate-700 text-slate-400"
          }`}
        >
          {live ? "● live" : "○ demo data"}
        </span>
      </header>

      {/* Hero */}
      <section className="flex items-center gap-3" aria-labelledby="home-prompt">
        <Beau size={88} className="shrink-0" />
        <div className="flex flex-col gap-2">
          <p className="inline-block self-start text-xs text-cyan-neon border border-cyan-neon/40 rounded-2xl rounded-bl-sm px-3 py-1">
            Hi, I'm Beau.
          </p>
          <h1 id="home-prompt" className="text-xl font-bold leading-snug text-slate-100">
            Where do you want to go?
          </h1>
        </div>
      </section>

      {/* Destination search */}
      <section aria-labelledby="home-search" className="flex flex-col gap-3">
        <h2 id="home-search" className="text-xs uppercase tracking-widest text-slate-400">
          Destination
        </h2>
        <label htmlFor="dest-search" className="sr-only">
          Search destinations
        </label>
        <input
          id="dest-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search buildings and entrances"
          autoComplete="off"
          className="min-h-[44px] w-full rounded-xl bg-panel border border-slate-800 px-4 text-slate-100 placeholder:text-slate-500 focus:border-firefly focus:outline-none"
        />

        {suggestions.length > 0 && (
          <ul className="flex flex-col gap-2">
            {suggestions.map((n) => {
              const isFav = favorites.includes(n.id);
              const isSel = selected === n.id;
              return (
                <li key={n.id} className="flex items-stretch gap-2">
                  <button
                    type="button"
                    onClick={() => setSelected(n.id)}
                    aria-pressed={isSel}
                    className={`flex-1 min-h-[44px] text-left rounded-xl border px-4 py-2 text-sm ${
                      isSel
                        ? "border-firefly text-firefly bg-panel neon-edge"
                        : "border-slate-800 bg-panel text-slate-200"
                    }`}
                  >
                    {n.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleFavorite(n.id)}
                    aria-pressed={isFav}
                    aria-label={`${isFav ? "Remove" : "Add"} ${n.name} ${isFav ? "from" : "to"} favorites`}
                    className={`min-w-[44px] min-h-[44px] rounded-xl border border-slate-800 bg-panel text-lg ${
                      isFav ? "text-firefly" : "text-slate-500"
                    }`}
                  >
                    <span aria-hidden="true">{isFav ? "★" : "☆"}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {suggestions.length === 0 && (
          <p className="text-sm text-slate-500">No places match "{query.trim()}".</p>
        )}

        <p className="text-sm text-slate-400" aria-live="polite">
          {selected ? (
            <>Going to <span className="text-slate-100">{nameOf(selected)}</span></>
          ) : (
            "Pick a destination to see the accessible route."
          )}
        </p>

        <button
          type="button"
          disabled={!selected}
          onClick={() => selected && startRoute(selected)}
          className="min-h-[52px] w-full rounded-xl bg-firefly text-void font-bold text-base neon-edge disabled:bg-slate-800 disabled:text-slate-500 disabled:shadow-none disabled:cursor-not-allowed"
        >
          Find Route
        </button>
      </section>

      {/* Favorites */}
      <section aria-labelledby="home-favorites" className="flex flex-col gap-3">
        <h2 id="home-favorites" className="text-xs uppercase tracking-widest text-slate-400">
          Favorites
        </h2>
        {favoriteNodes.length > 0 ? (
          <ul className="flex gap-2 overflow-x-auto pb-1">
            {favoriteNodes.map((id) => (
              <li key={id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => startRoute(id)}
                  className="min-h-[44px] rounded-full border border-firefly/40 text-firefly px-4 text-sm whitespace-nowrap"
                >
                  <span aria-hidden="true">★ </span>
                  {nameOf(id)}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">No favorites yet. Tap ☆ on a place to save it.</p>
        )}
      </section>

      {/* Recent routes */}
      <section aria-labelledby="home-recents" className="flex flex-col gap-3">
        <h2 id="home-recents" className="text-xs uppercase tracking-widest text-slate-400">
          Recent routes
        </h2>
        {recents.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {recents.map((r) => (
              <li key={`${r.from}-${r.to}-${r.at}`}>
                <button
                  type="button"
                  onClick={() => startRoute(r.to)}
                  className="w-full min-h-[44px] text-left rounded-xl bg-panel border border-slate-800 px-4 py-3 flex items-center justify-between gap-3"
                >
                  <span className="text-sm text-slate-200">
                    {nameOf(r.from)} <span className="text-cyan-neon">→</span> {nameOf(r.to)}
                  </span>
                  <span className="text-xs text-slate-500 whitespace-nowrap">{timeAgo(r.at)}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">No recent routes yet.</p>
        )}
      </section>

      {/* Accessibility updates */}
      <section aria-labelledby="home-updates" className="flex flex-col gap-3">
        <h2 id="home-updates" className="text-xs uppercase tracking-widest text-slate-400">
          Accessibility updates
        </h2>
        {openReports.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {openReports.map((r) => (
              <li
                key={r.id}
                className="rounded-xl bg-panel border border-slate-800 border-l-4 border-l-pink-neon p-4 flex flex-col gap-2"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-bold text-pink-neon">{cap(r.kind)}</span>
                  <span className="text-xs text-slate-500">{timeAgo(r.reportedAt)}</span>
                </div>
                <p className="text-sm text-slate-200">
                  {nameOf(r.edgeFrom)} <span className="text-cyan-neon">→</span> {nameOf(r.edgeTo)}
                </p>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-slate-400">✓ {r.confirmations} confirmed</span>
                  <button
                    type="button"
                    onClick={() => goTo("map")}
                    className="min-h-[44px] px-3 text-sm text-firefly underline underline-offset-4"
                  >
                    View on map
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">No open accessibility reports nearby.</p>
        )}
      </section>
    </div>
  );
}
