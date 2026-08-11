import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Batch Schedule",
};

const CALENDAR_DAYS = [
  ["29", "30", "1", "2", "3", "4", "5"],
  ["6", "7", "8", "9", "10", "11", "12"],
  ["13", "14", "15", "16", "17", "18", "19"],
  ["20", "21", "22", "23", "24", "25", "26"],
  ["27", "28", "29", "30", "31", "1", "2"],
];
const TODAY = "14";
const MARKED = ["17", "23"];
const OUTSIDE_MONTH = new Set(["29", "30", "31", "1", "2"]);

export default function SchedulePage() {
  return (
    <div className="space-y-stack-lg max-w-6xl">
      <div className="rounded-xl bg-primary-container/10 border border-primary/20 px-4 py-3 text-label-sm font-label-sm text-on-surface-variant">
        Sample layout — real class/test schedules will populate here once Academic Planning
        (Phase 3+) is wired up.
      </div>

      <header>
        <p className="flex items-center gap-2 text-label-sm text-on-surface-variant mb-2">
          <span>My Courses</span>
          <span className="material-symbols-outlined text-sm">chevron_right</span>
          <span className="text-primary">Target NEET 2025</span>
        </p>
        <h1 className="font-display-lg text-display-lg-mobile md:text-display-lg text-on-surface">
          Batch Roadmap &amp; Schedule
        </h1>
        <p className="text-body-lg text-on-surface-variant mt-2">
          Track your learning journey and upcoming milestones.
        </p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-stack-lg">
        {/* Sidebar: calendar + stats */}
        <aside className="lg:col-span-4 space-y-stack-lg">
          <div className="glass-card rounded-xl p-stack-md shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-headline-md text-headline-md text-on-surface">October 2024</h2>
            </div>
            <div className="grid grid-cols-7 text-center text-label-sm text-on-surface-variant font-bold mb-2">
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-y-2 text-center text-sm sm:text-body-md">
              {CALENDAR_DAYS.flat().map((day, i) => (
                <div
                  key={i}
                  className={`py-2 relative ${OUTSIDE_MONTH.has(day) ? "text-outline" : ""} ${
                    day === TODAY ? "bg-primary/10 rounded-full font-bold text-primary ring-1 ring-primary/30" : ""
                  }`}
                >
                  {day}
                  {MARKED.includes(day) && !OUTSIDE_MONTH.has(day) && (
                    <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-secondary rounded-full" />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card rounded-xl p-stack-md">
            <h3 className="font-headline-md text-headline-md mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">analytics</span>
              Batch Stats
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-on-surface-variant">Course Progress</span>
                <span className="font-bold">42%</span>
              </div>
              <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden">
                <div className="h-full bg-primary" style={{ width: "42%" }} />
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div className="bg-surface-container/50 p-3 rounded-lg">
                  <span className="text-label-sm block text-on-surface-variant">Classes Taken</span>
                  <span className="font-headline-md text-headline-md">128</span>
                </div>
                <div className="bg-surface-container/50 p-3 rounded-lg">
                  <span className="text-label-sm block text-on-surface-variant">Tests Completed</span>
                  <span className="font-headline-md text-headline-md">15</span>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Timeline */}
        <section className="lg:col-span-8">
          <div className="relative pl-8 md:pl-12 space-y-stack-lg pb-4">
            <div className="absolute left-4 md:left-6 top-0 bottom-0 w-1 bg-gradient-to-b from-primary to-secondary-container rounded-full opacity-20" />

            <div className="space-y-stack-md">
              <div className="relative">
                <div className="absolute -left-[22px] md:-left-[30px] top-1/2 -translate-y-1/2 w-4 h-4 bg-primary rounded-full ring-4 ring-primary-container/20 z-10" />
                <span className="text-label-sm font-bold text-primary uppercase tracking-wider">
                  Today, 14 Oct
                </span>
              </div>

              <div className="glass-card rounded-xl p-stack-md hover:shadow-lg transition-all border-l-4 border-l-error">
                <div className="flex flex-col md:flex-row justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 bg-error/10 text-error text-[10px] font-bold rounded uppercase">
                        Live Now
                      </span>
                      <span className="text-label-sm text-on-surface-variant">Biology • Unit 4</span>
                    </div>
                    <h3 className="font-headline-md text-headline-md text-on-surface mb-2">
                      Genetics and Evolution: The Molecular Basis of Inheritance
                    </h3>
                    <div className="flex flex-wrap gap-4 text-label-md text-on-surface-variant">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-lg">person</span>
                        Dr. S. K. Singh
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-lg">schedule</span>
                        90 Mins
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 w-full md:w-auto">
                    <button disabled className="w-full md:w-auto px-6 py-2 bg-primary text-on-primary font-label-md rounded-lg opacity-70 cursor-not-allowed">
                      Join Class
                    </button>
                  </div>
                </div>
              </div>

              <div className="glass-card rounded-xl p-stack-md hover:shadow-md transition-all">
                <div className="flex flex-col md:flex-row justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 bg-surface-container text-on-surface-variant text-[10px] font-bold rounded uppercase">
                        Starts at 4:00 PM
                      </span>
                      <span className="text-label-sm text-on-surface-variant">Chemistry • Physical</span>
                    </div>
                    <h3 className="font-headline-md text-headline-md text-on-surface mb-2">
                      Chemical Kinetics: Rate Laws &amp; Collision Theory
                    </h3>
                    <div className="flex flex-wrap gap-4 text-label-md text-on-surface-variant">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-lg">person</span>
                        Prof. Alok Gupta
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-lg">schedule</span>
                        120 Mins
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 w-full md:w-auto">
                    <button disabled className="w-full md:w-auto px-6 py-2 bg-surface-container-high text-on-surface font-label-md rounded-lg opacity-70 cursor-not-allowed">
                      Remind Me
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-stack-md pt-4">
              <div className="relative">
                <div className="absolute -left-[22px] md:-left-[30px] top-1/2 -translate-y-1/2 w-4 h-4 bg-outline-variant rounded-full z-10" />
                <span className="text-label-sm font-bold text-on-surface-variant uppercase tracking-wider">
                  Tomorrow, 15 Oct
                </span>
              </div>

              <div className="glass-card rounded-xl p-stack-md hover:shadow-md transition-all border-l-4 border-l-secondary">
                <div className="flex flex-col md:flex-row justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="px-2 py-0.5 bg-secondary/10 text-secondary text-[10px] font-bold rounded uppercase">
                        Upcoming Test
                      </span>
                      <span className="text-label-sm text-on-surface-variant">Fortnightly Assessment</span>
                    </div>
                    <h3 className="font-headline-md text-headline-md text-on-surface mb-2">
                      NEET Pattern Major Test - Physics &amp; Chemistry
                    </h3>
                    <div className="flex flex-wrap gap-4 text-label-md text-on-surface-variant">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-lg">assignment</span>
                        180 Questions
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-lg">timer</span>
                        3 Hours
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 w-full md:w-auto">
                    <button disabled className="w-full md:w-auto px-6 py-2 border-2 border-secondary text-secondary font-label-md rounded-lg opacity-70 cursor-not-allowed">
                      View Syllabus
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative py-6">
              <div className="absolute -left-[22px] md:-left-[30px] top-1/2 -translate-y-1/2 w-4 h-4 bg-primary-container rounded-full flex items-center justify-center z-10">
                <span className="w-2 h-2 bg-white rounded-full" />
              </div>
              <div className="p-4 bg-primary-container/10 rounded-xl border border-primary/20 flex items-center gap-4">
                <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center text-primary shrink-0">
                  <span className="material-symbols-outlined">flag</span>
                </div>
                <div>
                  <h4 className="font-bold text-on-surface">End of Part-1 Syllabus</h4>
                  <p className="text-label-md text-on-surface-variant">
                    Review sessions and doubt clearing will begin after this milestone.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
