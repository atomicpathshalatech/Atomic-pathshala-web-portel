import Link from "next/link";
import { Icon, Section, SectionHeader, hd, type Head } from "./ui";

const GOALS = [
  { title: "Class 10", text: "Board PYQs & model papers", href: "/practice/board-exam", icon: "menu_book", tone: "bg-orange-50 text-orange-600" },
  { title: "Class 11", text: "Physics • Chemistry • Biology • Maths", href: "/study-material", icon: "science", tone: "bg-cyan-50 text-cyan-700" },
  { title: "Class 12", text: "Notes, NCERT & board practice", href: "/study-material", icon: "auto_stories", tone: "bg-violet-50 text-violet-700" },
  { title: "NEET", text: "Physics • Chemistry • Biology", href: "/practice", icon: "biotech", tone: "bg-emerald-50 text-emerald-700" },
  { title: "JEE", text: "Physics • Chemistry • Mathematics", href: "/practice", icon: "functions", tone: "bg-blue-50 text-blue-700" },
];

export type GoalCard = { title: string; text?: string; href: string; icon?: string };
const GOAL_TONES = ["bg-orange-50 text-orange-600", "bg-cyan-50 text-cyan-700", "bg-violet-50 text-violet-700", "bg-emerald-50 text-emerald-700", "bg-blue-50 text-blue-700"];

export function ExamSelector({ head, items }: { head?: Head; items?: GoalCard[] } = {}) {
  const goals = items?.length ? items.map((g, i) => ({ ...g, text: g.text || "", icon: g.icon || "school", tone: GOAL_TONES[i % GOAL_TONES.length]! })) : GOALS;
  return (
    <Section id="goals" className="!pt-6 sm:!pt-8">
      <SectionHeader {...hd(head, { eyebrow: "Start here", title: "What are you preparing for?" })} />
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {goals.map((g, i) => (
          <li key={`${g.title}-${i}`} className={goals.length % 2 === 1 && i === 0 ? "col-span-2 sm:col-span-1" : ""}>
            <Link
              href={g.href}
              className="group flex h-full items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_8px_24px_-12px_rgba(30,64,175,0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 motion-reduce:transform-none lg:flex-col lg:items-start"
            >
              <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${g.tone}`}>
                <Icon name={g.icon} className="text-[22px]" />
              </span>
              <span className="min-w-0">
                <span className="block text-base font-bold text-slate-900">{g.title}</span>
                <span className="block text-xs leading-snug text-slate-500">{g.text}</span>
                <span className="mt-1 hidden items-center gap-0.5 text-xs font-semibold text-blue-700 lg:inline-flex">
                  Start free <Icon name="arrow_forward" className="text-[14px]" />
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}
