import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "DPP Portal",
};

// Sample data — real DPPs will be published by the Team Portal / Question
// Bank module (Phase 3+) and pulled from the database per student's batch.
const SUBJECTS = [
  {
    name: "Physics",
    icon: "bolt",
    color: "text-secondary",
    cards: [
      {
        status: "Pending" as const,
        meta: "45 Mins",
        title: "DPP 42: Rotational Dynamics",
        by: "Assigned by Prof. Verma • Today, 2:00 PM",
      },
      {
        status: "Completed" as const,
        meta: "Score: 84%",
        title: "DPP 41: Circular Motion",
        by: "Assigned by Prof. Verma • Yesterday",
      },
    ],
  },
  {
    name: "Chemistry",
    icon: "science",
    color: "text-primary",
    cards: [
      {
        status: "Overdue" as const,
        meta: "2 Days Late",
        title: "DPP 18: Redox Reactions",
        by: "Assigned by Dr. Sharma • 3 Days Ago",
      },
      {
        status: "Pending" as const,
        meta: "30 Mins",
        title: "DPP 19: Thermodynamics",
        by: "Assigned by Dr. Sharma • Today, 11:00 AM",
      },
    ],
  },
  {
    name: "Biology",
    icon: "biotech",
    color: "text-tertiary",
    cards: [
      {
        status: "Completed" as const,
        meta: "Score: 96%",
        title: "DPP 54: Genetics & DNA",
        by: "Assigned by Dr. Reddy • 2 Days Ago",
      },
      {
        status: "Completed" as const,
        meta: "Score: 78%",
        title: "DPP 53: Cell Structure",
        by: "Assigned by Dr. Reddy • 3 Days Ago",
      },
    ],
  },
];

const STATUS_STYLES: Record<string, string> = {
  Pending: "bg-primary-container text-on-primary-container",
  Completed: "bg-tertiary-container text-on-tertiary-container",
  Overdue: "bg-error text-on-error",
};

export default function DppPortalPage() {
  return (
    <div className="space-y-stack-lg max-w-6xl">
      <div className="rounded-xl bg-primary-container/10 border border-primary/20 px-4 py-3 text-label-sm font-label-sm text-on-surface-variant">
        Sample layout — real DPPs will appear here once Team Portal publishing tools go live.
      </div>

      <div className="flex flex-col md:flex-row md:items-end justify-between gap-stack-md">
        <div>
          <h1 className="font-display-lg text-display-lg-mobile md:text-display-lg text-on-surface mb-2">
            DPP Portal
          </h1>
          <p className="text-on-surface-variant max-w-2xl font-body-lg">
            Daily Practice Papers curated by your educators after every lecture to reinforce core
            concepts.
          </p>
        </div>
        <div className="w-full md:w-auto flex items-center gap-4 bg-primary-container/10 p-4 rounded-xl border border-primary/20">
          <span className="material-symbols-outlined text-primary text-4xl shrink-0">history_edu</span>
          <div>
            <div className="text-primary font-bold">Today&apos;s Goal</div>
            <div className="text-on-surface-variant text-label-md">3 DPPs Assigned • 1 Completed</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-gutter">
        {SUBJECTS.map((subject) => (
          <div key={subject.name} className="flex flex-col gap-stack-md">
            <div className="flex items-center gap-2 px-2">
              <span className={`material-symbols-outlined ${subject.color}`}>{subject.icon}</span>
              <h2 className="font-headline-md text-on-surface">{subject.name}</h2>
            </div>
            {subject.cards.map((card) => (
              <div
                key={card.title}
                className={`glass-card p-stack-md rounded-xl hover:shadow-md transition-all ${
                  card.status === "Overdue" ? "border-error/20 bg-error-container/5" : ""
                }`}
              >
                <div className="flex justify-between items-start mb-4">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${STATUS_STYLES[card.status]}`}>
                    {card.status}
                  </span>
                  <span
                    className={`text-label-sm font-bold ${
                      card.status === "Completed"
                        ? "text-tertiary"
                        : card.status === "Overdue"
                          ? "text-error"
                          : "text-on-surface-variant"
                    }`}
                  >
                    {card.meta}
                  </span>
                </div>
                <h3 className="font-headline-md text-headline-md mb-2">{card.title}</h3>
                <p className="text-on-surface-variant text-label-sm mb-6">{card.by}</p>
                <button
                  disabled
                  className={`w-full py-3 rounded-lg font-label-md flex items-center justify-center gap-2 opacity-70 cursor-not-allowed ${
                    card.status === "Completed"
                      ? "border border-primary text-primary"
                      : card.status === "Overdue"
                        ? "bg-error text-on-error"
                        : "bg-primary text-on-primary"
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">
                    {card.status === "Completed" ? "analytics" : "play_arrow"}
                  </span>
                  {card.status === "Completed" ? "Review Analysis" : "Start DPP Test"}
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
