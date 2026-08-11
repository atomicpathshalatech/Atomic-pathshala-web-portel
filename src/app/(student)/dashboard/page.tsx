import Link from "next/link";
import { requireStudentSession } from "@/lib/auth/session";

export default async function DashboardPage() {
  const { student } = await requireStudentSession();

  return (
    <div className="space-y-stack-lg">
      <div>
        <h1 className="font-display-lg-mobile md:font-display-lg text-display-lg-mobile md:text-display-lg">
          Welcome back, <span className="text-primary">{student.user.name.split(" ")[0]}</span>
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">
          Here&apos;s where things stand today.
        </p>
      </div>

      {/* Profile summary card */}
      <div className="glass-card rounded-2xl p-6 md:p-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
        <SummaryItem label="Enrollment Number" value={student.enrollmentNumber} highlight />
        <SummaryItem label="Student ID" value={student.studentIdCode} highlight />
        <SummaryItem label="Class" value={student.class} />
        <SummaryItem label="Target Exam" value={student.targetExam} />
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
        <QuickLinkCard
          href="/courses"
          icon="video_library"
          title="My Courses"
          description="Live classes and recorded lectures"
          status="Coming soon"
        />
        <QuickLinkCard
          href="/tests"
          icon="quiz"
          title="Test Series"
          description="Mock tests and performance analytics"
          status="Coming soon"
        />
        <QuickLinkCard
          href="/id-card"
          icon="badge"
          title="Digital ID Card"
          description="Your enrollment QR code"
          status="Available"
        />
      </div>

      {/* Honest placeholder — no invented numbers */}
      <div className="glass-card rounded-2xl p-6 md:p-8 text-center space-y-2">
        <span className="material-symbols-outlined text-primary/40" style={{ fontSize: 40 }}>
          insights
        </span>
        <p className="font-label-md text-label-md text-on-surface-variant">
          Attendance, course progress, and test analytics will appear here once the Course
          and Test modules are live.
        </p>
      </div>
    </div>
  );
}

function SummaryItem({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <p className="font-label-sm text-label-sm text-on-surface-variant mb-1">{label}</p>
      <p
        className={
          highlight
            ? "font-headline-md text-headline-md text-primary"
            : "font-label-md text-label-md text-on-surface"
        }
      >
        {value}
      </p>
    </div>
  );
}

function QuickLinkCard({
  href,
  icon,
  title,
  description,
  status,
}: {
  href: string;
  icon: string;
  title: string;
  description: string;
  status: "Available" | "Coming soon";
}) {
  return (
    <Link
      href={href}
      className="glass-card rounded-2xl p-6 flex flex-col gap-3 hover:-translate-y-1 transition-transform"
    >
      <div className="flex items-center justify-between">
        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary">
          <span className="material-symbols-outlined">{icon}</span>
        </div>
        <span
          className={
            status === "Available"
              ? "text-label-sm font-label-sm px-2.5 py-1 rounded-full bg-tertiary-container/10 text-tertiary"
              : "text-label-sm font-label-sm px-2.5 py-1 rounded-full bg-outline-variant/20 text-on-surface-variant"
          }
        >
          {status}
        </span>
      </div>
      <div>
        <h3 className="font-headline-md text-headline-md">{title}</h3>
        <p className="text-label-sm font-label-sm text-on-surface-variant">{description}</p>
      </div>
    </Link>
  );
}
