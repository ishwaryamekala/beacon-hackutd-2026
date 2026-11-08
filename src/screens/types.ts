// The one contract every screen receives. App.tsx owns all state; screens
// only read it and call these functions. Do not add state to App from a screen
// file — add a field here and in App.tsx instead.

import type { CampusGraph, Obstacle } from "../lib/graph";
import type { Preferences, Route } from "../lib/routing";

export type Tab = "home" | "map" | "report" | "profile";

export interface RecentRoute {
  from: string; // node id
  to: string;   // node id
  at: number;   // epoch ms
}

export interface RouteResult {
  accessible: Route | null;
  shortest: Route | null;
  /** Extra seconds the accessible route costs vs. the shortest one. */
  penaltySeconds: number | null;
}

export interface AppState {
  graph: CampusGraph;

  // Community reports (Supabase or in-memory demo data)
  reports: Obstacle[];
  live: boolean;
  submitReport: (from: string, to: string, kind: Obstacle["kind"], note?: string) => void;
  vote: (id: string, agrees: boolean) => void;
  /** Ids of reports submitted from this device (for Profile → history). */
  myReports: { from: string; to: string; kind: Obstacle["kind"]; at: number }[];

  // Routing
  from: string;
  to: string;
  setFrom: (id: string) => void;
  setTo: (id: string) => void;
  result: RouteResult;
  /** Set destination, record it in recents, and switch to the Map tab. */
  startRoute: (to: string) => void;

  // Saved preferences (persisted)
  prefs: Preferences;
  setPrefs: (p: Preferences) => void;
  resetPrefs: () => void;

  // Favorites / recents (persisted)
  favorites: string[]; // node ids
  toggleFavorite: (id: string) => void;
  recents: RecentRoute[];

  // Display
  clarity: boolean;
  setClarity: (on: boolean) => void;

  // Navigation
  tab: Tab;
  goTo: (tab: Tab) => void;
}

export interface ScreenProps {
  app: AppState;
}
