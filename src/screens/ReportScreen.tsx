import type { ScreenProps } from "./types";
import ReportPanel from "../components/ReportPanel";

export default function ReportScreen({ app }: ScreenProps) {
  return (
    <div className="px-4 py-6 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl text-violet-neon neon-text">Report an obstacle</h1>
        <p className="text-sm text-slate-400">
          Your report reroutes everyone in real time. Two confirmations make it verified.
        </p>
      </header>

      <ReportPanel
        graph={app.graph}
        reports={app.reports}
        onSubmit={app.submitReport}
        onVote={app.vote}
      />
    </div>
  );
}
