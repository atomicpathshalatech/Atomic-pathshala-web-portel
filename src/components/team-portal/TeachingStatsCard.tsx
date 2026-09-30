import Link from "next/link";
import { formatTeachingTime, type TeacherTeachingStats } from "@/lib/teaching/stats";

/**
 * Actual teaching time + views (server-rendered). Used on a teacher's own
 * profile, and — summed over everyone — on the Super Admin's profile.
 */
export function TeachingStatsCard({
  title,
  allTime,
  thisMonth,
  footerLink,
}: {
  title: string;
  allTime: TeacherTeachingStats;
  thisMonth?: TeacherTeachingStats;
  footerLink?: { href: string; label: string };
}) {
  const n = (v: number) => v.toLocaleString("en-IN");
  const tiles = [
    { label: "Total teaching", value: formatTeachingTime(allTime.totalMinutes), strong: true },
    { label: "This month", value: thisMonth ? formatTeachingTime(thisMonth.totalMinutes) : "—" },
    { label: "App classes", value: `${formatTeachingTime(allTime.appMinutes)} · ${n(allTime.appClasses)}` },
    { label: "YouTube classes", value: `${formatTeachingTime(allTime.youtubeMinutes)} · ${n(allTime.youtubeClasses)}` },
    { label: "Total views", value: n(allTime.totalViews), strong: true },
    { label: "YouTube / app views", value: `${n(allTime.youtubeViews)} / ${n(allTime.appViews)}` },
  ];
  return (
    <section className="glass-card rounded-xl p-6 space-y-4">
      <div>
        <h2 className="font-bold text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">timer</span>
          {title}
        </h2>
        <p className="text-[11px] text-on-surface-variant mt-1">
          Time actually taught — app classes from real start to real end, recorded YouTube classes by the video&apos;s length. Not the scheduled time.
          {allTime.youtubePending > 0 && ` ${allTime.youtubePending} YouTube class(es) will be added once YouTube reports their length.`}
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">{t.label}</p>
            <p className={`tabular-nums mt-1 ${t.strong ? "text-xl font-black text-primary" : "text-sm font-bold text-on-surface"}`}>{t.value}</p>
          </div>
        ))}
      </div>
      {footerLink && (
        <Link href={footerLink.href} className="inline-flex items-center gap-1 text-xs font-bold text-primary">
          {footerLink.label} <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </Link>
      )}
    </section>
  );
}

/** Adds up several teachers' stats (the Super Admin's whole-team card). */
export function sumTeachingStats(all: TeacherTeachingStats[]): TeacherTeachingStats {
  const total: TeacherTeachingStats = { teacherId: "all", appMinutes: 0, youtubeMinutes: 0, totalMinutes: 0, appClasses: 0, youtubeClasses: 0, youtubePending: 0, youtubeViews: 0, appViews: 0, totalViews: 0, videoCount: 0 };
  for (const s of all) {
    for (const k of Object.keys(total) as (keyof TeacherTeachingStats)[]) {
      if (k !== "teacherId") (total[k] as number) += s[k] as number;
    }
  }
  return total;
}
