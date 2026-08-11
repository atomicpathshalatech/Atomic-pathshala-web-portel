import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Test Analysis",
};

// Sample data — the real Test Engine (Phase 3) will populate this from actual
// mock-test attempts. Shown now so the UI/UX is ready to wire up later;
// numbers below are illustrative, not a real student's results.
const RECENT_TESTS = [
  { title: "Physics: Rotation & Kinematics", date: "Oct 24, 2024", score: "162/180", timeSpent: "42m" },
  { title: "Organic Chemistry: Basic GOC", date: "Oct 20, 2024", score: "175/180", timeSpent: "35m" },
  { title: "Biology: Genetics & Evolution", date: "Oct 15, 2024", score: "348/360", timeSpent: "58m" },
  { title: "Complete Syllabus Mock 07", date: "Oct 08, 2024", score: "645/720", timeSpent: "98.4th percentile" },
  { title: "Maths: Integration & Series", date: "Oct 01, 2024", score: "155/180", timeSpent: "88% accuracy" },
];

export default function TestsPage() {
  return (
    <div className="space-y-stack-lg max-w-5xl">
      <div className="rounded-xl bg-primary-container/10 border border-primary/20 px-4 py-3 text-label-sm font-label-sm text-on-surface-variant">
        Sample layout — real scores will appear here once the Test Engine (Phase 3) goes live.
      </div>

      {/* Hero: latest test report */}
      <section>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-stack-md mb-6">
          <div>
            <h1 className="font-headline-lg text-headline-lg text-primary">Performance Analysis</h1>
            <p className="text-on-surface-variant font-body-md">Breakdown of your latest mock attempt</p>
          </div>
          <button className="w-full md:w-auto flex items-center justify-center gap-2 bg-primary text-on-primary px-6 py-3 rounded-xl font-label-md hover:shadow-lg transition-all active:scale-95" disabled>
            <span className="material-symbols-outlined">download</span>
            Download PDF Report
          </button>
        </div>

        <div className="glass-card rounded-2xl p-5 sm:p-8 border border-primary/10 shadow-xl overflow-hidden relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -mr-32 -mt-32 blur-3xl" />
          <div className="relative z-10 grid grid-cols-1 md:grid-cols-4 gap-gutter">
            <div className="md:col-span-1 border-b md:border-b-0 md:border-r border-outline-variant/20 pb-stack-md md:pb-0">
              <span className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider">Most Recent Test</span>
              <h2 className="text-headline-md font-headline-md text-on-surface mt-1 mb-4">NEET Full Syllabus Mock 08</h2>
              <div className="flex items-baseline gap-1">
                <span className="text-4xl sm:text-5xl font-display-lg text-primary">685</span>
                <span className="text-on-surface-variant font-body-md">/ 720</span>
              </div>
            </div>
            <div className="md:col-span-3 grid grid-cols-3 gap-2 sm:gap-gutter">
              <div className="flex flex-col justify-center items-center p-2.5 sm:p-4 rounded-xl bg-surface-container-low border border-outline-variant/10">
                <span className="material-symbols-outlined text-primary mb-1 sm:mb-2 text-xl sm:text-2xl">leaderboard</span>
                <span className="text-[10px] sm:text-label-sm text-on-surface-variant text-center">All India Rank</span>
                <span className="text-label-md sm:text-headline-md font-headline-md text-on-surface">142</span>
              </div>
              <div className="flex flex-col justify-center items-center p-2.5 sm:p-4 rounded-xl bg-surface-container-low border border-outline-variant/10">
                <span className="material-symbols-outlined text-secondary mb-1 sm:mb-2 text-xl sm:text-2xl">percent</span>
                <span className="text-[10px] sm:text-label-sm text-on-surface-variant text-center">Percentile</span>
                <span className="text-label-md sm:text-headline-md font-headline-md text-on-surface">99.8th</span>
              </div>
              <div className="flex flex-col justify-center items-center p-2.5 sm:p-4 rounded-xl bg-surface-container-low border border-outline-variant/10">
                <span className="material-symbols-outlined text-tertiary mb-1 sm:mb-2 text-xl sm:text-2xl">check_circle</span>
                <span className="text-[10px] sm:text-label-sm text-on-surface-variant text-center">Accuracy</span>
                <span className="text-label-md sm:text-headline-md font-headline-md text-on-surface">94%</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Resource vault */}
      <section>
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-primary/10 p-2 rounded-lg">
            <span className="material-symbols-outlined text-primary">inventory_2</span>
          </div>
          <h2 className="font-headline-md text-headline-md">PDF Resource Vault</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-gutter">
          {RECENT_TESTS.map((test) => (
            <div
              key={test.title}
              className="glass-card rounded-2xl p-6 transition-all duration-300 hover:shadow-2xl hover:-translate-y-1"
            >
              <div className="flex justify-between items-start mb-4">
                <span className="text-label-sm font-label-sm text-on-surface-variant">{test.date}</span>
              </div>
              <h3 className="font-headline-md text-headline-md text-on-surface text-lg mb-2">{test.title}</h3>
              <div className="flex items-center gap-4 mb-6 py-3 border-y border-outline-variant/10">
                <div>
                  <span className="block text-[10px] uppercase text-on-surface-variant font-bold">Score</span>
                  <span className="text-body-lg font-bold text-primary">{test.score}</span>
                </div>
                <div className="h-8 w-px bg-outline-variant/20" />
                <div>
                  <span className="block text-[10px] uppercase text-on-surface-variant font-bold">Details</span>
                  <span className="text-body-lg font-bold text-on-surface">{test.timeSpent}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button
                  disabled
                  className="flex items-center justify-center gap-2 py-2.5 rounded-lg border border-primary/20 text-primary font-label-md opacity-60 cursor-not-allowed"
                >
                  <span className="material-symbols-outlined text-sm">description</span>
                  Paper
                </button>
                <button
                  disabled
                  className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary/10 text-primary font-label-md opacity-60 cursor-not-allowed"
                >
                  <span className="material-symbols-outlined text-sm">analytics</span>
                  Analysis
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
