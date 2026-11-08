import type { Tab } from "../screens/types";

const S = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const ICONS: Record<Tab, JSX.Element> = {
  // House
  home: (
    <svg viewBox="0 0 24 24" className="w-6 h-6" {...S}>
      <path d="M3 11 12 4l9 7" /><path d="M5 10v10h14V10" /><path d="M10 20v-5h4v5" />
    </svg>
  ),
  // Folded map with dotted path + pin (design 1B)
  map: (
    <svg viewBox="0 0 24 24" className="w-6 h-6" {...S}>
      <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z" />
      <path d="M6 16c2-1 3-4 6-4" strokeDasharray="1.5 2" />
      <path d="M16 7.5a2 2 0 1 1 4 0c0 1.6-2 3.5-2 3.5s-2-1.9-2-3.5z" />
    </svg>
  ),
  // Warning lightbulb
  report: (
    <svg viewBox="0 0 24 24" className="w-6 h-6" {...S}>
      <path d="M9 18h6" /><path d="M10 21h4" />
      <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z" />
      <path d="M12 7v3.5" /><path d="M12 12.6v.1" />
    </svg>
  ),
  // Firefly
  profile: (
    <svg viewBox="0 0 24 24" className="w-6 h-6" {...S}>
      <ellipse cx="12" cy="14" rx="3" ry="5" />
      <circle cx="12" cy="7" r="2" />
      <path d="M9.5 11C6 9 4 10 4 12s3 2 5.5 1" /><path d="M14.5 11C18 9 20 10 20 12s-3 2-5.5 1" />
      <path d="M11 5 9.5 2.5M13 5l1.5-2.5" />
    </svg>
  ),
};

const LABELS: Record<Tab, string> = { home: "Home", map: "Map", report: "Report", profile: "Profile" };

export default function BottomNav({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav
      aria-label="Main"
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[440px] z-[1000]
                 bg-panel/95 backdrop-blur border-t border-slate-800 pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="grid grid-cols-4">
        {(Object.keys(LABELS) as Tab[]).map((t) => {
          const active = t === tab;
          return (
            <li key={t}>
              <button
                onClick={() => onChange(t)}
                aria-current={active ? "page" : undefined}
                className={`w-full flex flex-col items-center gap-1 py-3 text-[11px] transition-colors
                  ${active ? "text-firefly neon-text" : "text-slate-500 hover:text-slate-300"}`}
              >
                {ICONS[t]}
                {LABELS[t]}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
