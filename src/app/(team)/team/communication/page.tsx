import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";

export const metadata: Metadata = {
  title: "Communication Center — Atomic Pathshala",
  description: "Registration/enrollment emails, birthday automation, and delivery logs.",
};

async function getStats() {
  const [sent, failed, queued, templates] = await Promise.all([
    prisma.emailLog.count({ where: { status: "SENT" } }),
    prisma.emailLog.count({ where: { status: "FAILED" } }),
    prisma.emailLog.count({ where: { status: { in: ["QUEUED", "SENDING"] } } }),
    prisma.emailTemplate.count({ where: { isActive: true } }),
  ]);
  return { sent, failed, queued, templates };
}

const CARDS = [
  {
    href: "/team/communication/students",
    icon: "school",
    label: "Students",
    description: "Search, filter, and select students as a recipient group.",
  },
  {
    href: "/team/communication/staff",
    icon: "badge",
    label: "Staff",
    description: "Kept separate from students — search, filter, select.",
  },
  {
    href: "/team/communication/compose",
    icon: "edit_note",
    label: "Compose Email",
    description: "Recipients → compose → confirm → send. Queued, never a frontend loop.",
  },
  {
    href: "/team/communication/templates",
    icon: "description",
    label: "Templates",
    description: "Edit the 10 default templates or create your own — admin-editable, no deploy needed.",
  },
  {
    href: "/team/communication/campaigns",
    icon: "campaign",
    label: "Campaigns",
    description: "Every bulk send, draft to completed, with delivery stats.",
  },
  {
    href: "/team/communication/logs",
    icon: "receipt_long",
    label: "Email Logs",
    description: "Every outgoing email — registration, enrollment, invitations, campaigns — with status and failure reason.",
  },
  {
    href: "/team/communication/birthday",
    icon: "cake",
    label: "Birthday Automation",
    description: "Today's birthdays, send status, manual/force send.",
  },
  {
    href: "/team/communication/today-special",
    icon: "celebration",
    label: "Today Special",
    description: "Recurring date-based content, combined into birthday messages when it targets the subject.",
  },
];

export default async function CommunicationCenterPage() {
  const stats = await getStats();

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Communication Center</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Centralized transactional and campaign email, plus birthday automation. Admin-only.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile label="Sent" value={stats.sent} tone="emerald" />
        <StatTile label="Failed" value={stats.failed} tone="rose" />
        <StatTile label="Queued" value={stats.queued} tone="amber" />
        <StatTile label="Active templates" value={stats.templates} tone="indigo" />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {CARDS.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="group rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 hover:border-primary hover:shadow-md transition"
          >
            <span className="material-symbols-outlined text-2xl text-primary">{c.icon}</span>
            <h2 className="mt-2 font-bold text-slate-900 dark:text-white">{c.label}</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{c.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}

function StatTile({ label, value, tone }: { label: string; value: number; tone: "emerald" | "rose" | "amber" | "indigo" }) {
  const toneClass = {
    emerald: "text-emerald-600 dark:text-emerald-400",
    rose: "text-rose-600 dark:text-rose-400",
    amber: "text-amber-600 dark:text-amber-400",
    indigo: "text-indigo-600 dark:text-indigo-400",
  }[tone];
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
      <div className={`text-2xl font-bold ${toneClass}`}>{value}</div>
      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{label}</div>
    </div>
  );
}
