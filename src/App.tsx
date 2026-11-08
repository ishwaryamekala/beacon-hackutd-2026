import { useEffect, useMemo, useState } from "react";
import { UTD_DEMO } from "./lib/campus";
import { compareRoutes, DEFAULT_PREFS, type Preferences } from "./lib/routing";
import type { Obstacle } from "./lib/graph";
import { useReports } from "./state/useReports";
import { useLocal } from "./state/useLocal";
import type { AppState, RecentRoute, Tab } from "./screens/types";
import BottomNav from "./components/BottomNav";
import HomeScreen from "./screens/HomeScreen";
import MapScreen from "./screens/MapScreen";
import ReportScreen from "./screens/ReportScreen";
import ProfileScreen from "./screens/ProfileScreen";

export default function App() {
  const [tab, setTab] = useState<Tab>("home");
  const [from, setFrom] = useState("su_north");
  const [to, setTo] = useState("lib_door");
  const [prefs, setPrefs] = useLocal<Preferences>("prefs", DEFAULT_PREFS);
  const [favorites, setFavorites] = useLocal<string[]>("favorites", ["lib_door"]);
  const [recents, setRecents] = useLocal<RecentRoute[]>("recents", []);
  const [myReports, setMyReports] = useLocal<AppState["myReports"]>("myReports", []);
  const [clarity, setClarity] = useLocal<boolean>("clarity", false);
  const { reports, submit, vote, live } = useReports();

  useEffect(() => {
    document.documentElement.dataset.clarity = clarity ? "on" : "off";
  }, [clarity]);

  const result = useMemo(
    () => compareRoutes(UTD_DEMO, from, to, prefs, reports),
    [from, to, prefs, reports]
  );

  const app: AppState = {
    graph: UTD_DEMO,
    reports,
    live,
    submitReport: (f: string, t: string, kind: Obstacle["kind"], note?: string) => {
      submit(f, t, kind, note);
      setMyReports((r) => [{ from: f, to: t, kind, at: Date.now() }, ...r].slice(0, 50));
    },
    vote,
    myReports,
    from,
    to,
    setFrom,
    setTo,
    result,
    startRoute: (dest: string) => {
      setTo(dest);
      setRecents((r) =>
        [{ from, to: dest, at: Date.now() }, ...r.filter((x) => x.to !== dest)].slice(0, 8)
      );
      setTab("map");
    },
    prefs,
    setPrefs,
    resetPrefs: () => setPrefs(DEFAULT_PREFS),
    favorites,
    toggleFavorite: (id: string) =>
      setFavorites((f) => (f.includes(id) ? f.filter((x) => x !== id) : [...f, id])),
    recents,
    clarity,
    setClarity,
    tab,
    goTo: setTab,
  };

  return (
    // Phone-width column, centred on desktop so the demo looks like a phone.
    <div className="min-h-[100dvh] bg-void flex justify-center">
      <div className="relative w-full max-w-[440px] min-h-[100dvh] flex flex-col bg-void sm:border-x sm:border-slate-800">
        <main className="flex-1 overflow-y-auto pb-24">
          {tab === "home" && <HomeScreen app={app} />}
          {tab === "map" && <MapScreen app={app} />}
          {tab === "report" && <ReportScreen app={app} />}
          {tab === "profile" && <ProfileScreen app={app} />}
        </main>
        <BottomNav tab={tab} onChange={setTab} />
      </div>
    </div>
  );
}
