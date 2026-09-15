import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTeacherProfileBySlug } from "@/lib/teacher/profile";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import {
  TeacherFollowButton,
  TeacherMessageButtonAndModal,
  WriteTestimonialButtonAndModal,
} from "@/components/teacher/FacultyProfileClient";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const profile = await getTeacherProfileBySlug(params.slug);
  if (!profile) return { title: "Faculty Not Found | Atomic Pathshala" };

  const subject = profile.subjects.length > 0 ? profile.subjects.join(", ") : profile.department;
  return {
    title: `${profile.name} — ${subject} Faculty | Atomic Pathshala`,
    description: profile.bio ? profile.bio.slice(0, 160) : `Learn with ${profile.name} at Atomic Pathshala.`,
  };
}

function formatScheduleTime(dateInput: Date | string) {
  const date = new Date(dateInput);
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const timeStr = date.toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  if (isToday) {
    return `Today · ${timeStr}`;
  }

  const dateStr = date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });

  return `${dateStr} · ${timeStr}`;
}

export default async function TeacherProfilePage({
  params,
}: {
  params: { slug: string };
}) {
  const profile = await getTeacherProfileBySlug(params.slug);
  if (!profile) notFound();

  const primarySubject =
    profile.subjects && profile.subjects.length > 0
      ? profile.subjects.join(", ")
      : profile.department || "Faculty Educator";

  const targetExamsText =
    profile.targetExams && profile.targetExams.length > 0
      ? profile.targetExams.join(" & ")
      : null;

  const classesText =
    profile.classes && profile.classes.length > 0
      ? profile.classes.join(", ")
      : null;

  const mediumText =
    profile.languages && profile.languages.length > 0
      ? profile.languages.join(" + ")
      : null;

  const hasBatches = profile.batches && profile.batches.length > 0;
  const hasUpcomingClasses = profile.upcomingClasses && profile.upcomingClasses.length > 0;
  const hasLectures = profile.lectures && profile.lectures.length > 0;
  const hasBio = Boolean(profile.bio && profile.bio.trim().length > 0);
  const hasBadges = profile.badges && profile.badges.length > 0;
  const hasTestimonials = profile.testimonials && profile.testimonials.length > 0;

  // Real Impact metrics: strictly non-zero and non-null values only (Zero fake metrics)
  const impactMetrics: Array<{ label: string; value: string | number; icon: string }> = [];
  if (profile.followerCount > 0) {
    impactMetrics.push({
      label: "Followers",
      value: profile.followerCount >= 1000 ? `${(profile.followerCount / 1000).toFixed(1)}k` : profile.followerCount,
      icon: "group",
    });
  }
  if (profile.studentsTaughtCount > 0) {
    impactMetrics.push({
      label: "Students Taught",
      value: profile.studentsTaughtCount >= 1000 ? `${(profile.studentsTaughtCount / 1000).toFixed(1)}k` : profile.studentsTaughtCount,
      icon: "school",
    });
  }
  if (profile.totalLecturesCount > 0) {
    impactMetrics.push({
      label: "Total Lectures",
      value: profile.totalLecturesCount,
      icon: "video_library",
    });
  }
  if (profile.badges.length > 0) {
    impactMetrics.push({
      label: "Honours & Badges",
      value: profile.badges.length,
      icon: "military_tech",
    });
  }
  if (profile.averageRating && profile.averageRating > 0) {
    impactMetrics.push({
      label: profile.reviewCount > 0 ? `Rating (${profile.reviewCount} reviews)` : "Rating",
      value: `${profile.averageRating} ★`,
      icon: "star",
    });
  }

  // Teacher Info attributes: only show if present
  const hasInfo = Boolean(
    profile.qualificationSummary ||
    profile.experienceYears ||
    profile.dobDayMonth
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc] dark:bg-[#0b0f19] text-slate-900 dark:text-slate-100 antialiased font-sans">
      <Navbar />

      <main className="flex-1 pt-24 pb-20 px-4 sm:px-6 max-w-4xl mx-auto w-full space-y-6 sm:space-y-8">
        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <Link href="/" className="hover:text-blue-600 transition-colors">
            Home
          </Link>
          <span className="material-symbols-outlined text-xs text-slate-400">chevron_right</span>
          <span className="hover:text-blue-600 transition-colors">
            Faculty
          </span>
          <span className="material-symbols-outlined text-xs text-slate-400">chevron_right</span>
          <span className="text-blue-600 dark:text-blue-400 font-semibold truncate">
            {profile.name}
          </span>
        </nav>

        {/* 1. Main Faculty Header Card */}
        <section className="bg-white dark:bg-[#111625] rounded-3xl p-6 sm:p-8 border border-slate-200/90 dark:border-slate-800 shadow-sm relative overflow-hidden">
          {/* Atomic blue ambient glow */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-5 sm:gap-6">
            {/* Faculty Photo with Initials fallback */}
            <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-2xl bg-gradient-to-br from-blue-500/10 to-blue-600/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-extrabold text-3xl sm:text-4xl border-2 border-blue-100 dark:border-blue-900/50 shadow-md shrink-0 overflow-hidden">
              {profile.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.photoUrl}
                  alt={profile.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                profile.name
                  .split(" ")
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()
              )}
            </div>

            {/* Name, Verified Badge, Subject & Medium */}
            <div className="space-y-3 flex-1 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                  {profile.name}
                </h1>
                {profile.isVerified && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 text-[11px] font-bold border border-blue-200 dark:border-blue-800">
                    <span className="material-symbols-outlined text-xs">verified</span>
                    Verified Faculty
                  </span>
                )}
              </div>

              {/* Subject Tag */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-sm shadow-blue-600/20">
                  <span className="material-symbols-outlined text-sm">school</span>
                  {primarySubject}
                </span>

                {mediumText && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 text-xs font-semibold">
                    <span className="material-symbols-outlined text-xs text-blue-600 dark:text-blue-400">
                      translate
                    </span>
                    <span>{mediumText} Medium</span>
                  </span>
                )}
              </div>

              {/* NEET / JEE / Class Tags */}
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                {targetExamsText && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700">
                    <span className="material-symbols-outlined text-xs text-blue-600 dark:text-blue-400">
                      flag
                    </span>
                    <span>{targetExamsText}</span>
                  </span>
                )}

                {classesText && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700">
                    <span className="material-symbols-outlined text-xs text-blue-600 dark:text-blue-400">
                      menu_book
                    </span>
                    <span>Class {classesText}</span>
                  </span>
                )}
              </div>

              {/* Interactive CTAs: Follow Button & Send Message Button */}
              <div className="pt-2 flex flex-wrap items-center gap-2.5">
                <TeacherFollowButton
                  teacherId={profile.id}
                  initialFollowerCount={profile.followerCount}
                />
                <TeacherMessageButtonAndModal
                  teacherId={profile.id}
                  teacherName={profile.name}
                  teacherPhoto={profile.photoUrl}
                  teacherSubject={primarySubject}
                />
              </div>
            </div>
          </div>
        </section>

        {/* 2. Faculty Verified Information (Qualification, Experience, DOB Day+Month strictly without Year) */}
        {hasInfo && (
          <section className="bg-white dark:bg-[#111625] rounded-3xl p-5 sm:p-6 border border-slate-200/90 dark:border-slate-800 shadow-sm">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-blue-600 dark:text-blue-400">
                badge
              </span>
              <span>Faculty Information</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {profile.qualificationSummary && (
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/80 space-y-1">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm text-blue-600 dark:text-blue-400">
                      history_edu
                    </span>
                    Qualification
                  </span>
                  <p className="text-sm font-extrabold text-slate-900 dark:text-white">
                    {profile.qualificationSummary}
                  </p>
                </div>
              )}

              {profile.experienceYears && (
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/80 space-y-1">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm text-blue-600 dark:text-blue-400">
                      work_history
                    </span>
                    Teaching Experience
                  </span>
                  <p className="text-sm font-extrabold text-slate-900 dark:text-white">
                    {profile.experienceYears} Years
                  </p>
                </div>
              )}

              {/* DOB: Day + Month ONLY (Year is strictly excluded for student privacy) */}
              {profile.dobDayMonth && (
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/80 space-y-1">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm text-rose-500">
                      cake
                    </span>
                    Birthday
                  </span>
                  <p className="text-sm font-extrabold text-slate-900 dark:text-white">
                    {profile.dobDayMonth}
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* 3. Teacher Impact Section (Strictly Real Metrics, zero fake data, hides if 0) */}
        {impactMetrics.length > 0 && (
          <section className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-3xl p-6 sm:p-7 shadow-lg shadow-blue-600/10 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm sm:text-base font-extrabold tracking-tight flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-300">
                  insights
                </span>
                <span>Educator Impact &amp; Reach</span>
              </h2>
              <span className="text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-white/20 text-white backdrop-blur-sm">
                Verified Metrics
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              {impactMetrics.map((metric, idx) => (
                <div
                  key={idx}
                  className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10 flex flex-col justify-between"
                >
                  <span className="material-symbols-outlined text-lg text-blue-200 mb-1">
                    {metric.icon}
                  </span>
                  <div>
                    <div className="text-xl sm:text-2xl font-black tracking-tight">
                      {metric.value}
                    </div>
                    <div className="text-[11px] text-blue-100 font-medium">
                      {metric.label}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 4. Teacher Badges Section (Only shown if admin awarded badges exist) */}
        {hasBadges && (
          <section className="bg-white dark:bg-[#111625] rounded-3xl p-6 sm:p-7 border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-500">
                  military_tech
                </span>
                <span>Official Teacher Badges</span>
              </h2>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                {profile.badges.length} Honours
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {profile.badges.map((badge) => (
                <div
                  key={badge.id}
                  className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40"
                >
                  <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-sm shadow-amber-500/20">
                    <span className="material-symbols-outlined text-xl">
                      {badge.icon || "stars"}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">
                      {badge.title}
                    </h3>
                    {badge.description && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-snug">
                        {badge.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 5. Short Teacher Introduction (Only shown if bio exists) */}
        {hasBio && (
          <section className="bg-white dark:bg-[#111625] rounded-3xl p-6 sm:p-7 border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-2.5">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-blue-600 dark:text-blue-400">
                person
              </span>
              <span>About Educator</span>
            </h2>
            <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300 whitespace-pre-wrap">
              {profile.bio}
            </p>
          </section>
        )}

        {/* 6. Available Courses / Batches (Only shown if data exists) */}
        {hasBatches && (
          <section className="space-y-3.5">
            <div className="flex items-center justify-between">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600 dark:text-blue-400">
                  library_books
                </span>
                <span>Available Courses &amp; Batches</span>
              </h2>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-900/60">
                {profile.batches.length} Available
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {profile.batches.map((batch) => (
                <div
                  key={batch.id}
                  className="bg-white dark:bg-[#111625] rounded-2xl p-5 border border-slate-200/90 dark:border-slate-800 shadow-sm hover:border-blue-400 dark:hover:border-blue-500/50 transition-all flex flex-col justify-between gap-4 group"
                >
                  <div className="space-y-1.5">
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 inline-block">
                      {batch.courseTitle || batch.code || "Academic Program"}
                    </span>
                    <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {batch.name}
                    </h3>
                  </div>

                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      Curated batch
                    </span>
                    <Link
                      href={`/courses/${batch.id}`}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold shadow-sm shadow-blue-600/20 transition-all"
                    >
                      <span>View Batch</span>
                      <span className="material-symbols-outlined text-sm">arrow_forward</span>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 7. Upcoming Live Classes (Only shown if data exists) */}
        {hasUpcomingClasses && (
          <section className="space-y-3.5">
            <div className="flex items-center justify-between">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-rose-500 animate-pulse">
                  sensors
                </span>
                <span>Upcoming Live Classes</span>
              </h2>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200/60 dark:border-rose-900/60">
                Live Studio
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {profile.upcomingClasses.map((cls) => {
                const isLive = cls.status === "ACTIVE" || cls.status === "LIVE";
                return (
                  <div
                    key={cls.id}
                    className="bg-white dark:bg-[#111625] rounded-2xl p-5 border border-slate-200/90 dark:border-slate-800 shadow-sm hover:border-blue-400 dark:hover:border-blue-500/50 transition-all flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs gap-2">
                        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 truncate">
                          {cls.batchName}
                        </span>
                        {isLive ? (
                          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500 text-white font-extrabold text-[10px] uppercase tracking-wider animate-pulse shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-white" />
                            Live Now
                          </span>
                        ) : (
                          <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md shrink-0">
                            {formatScheduleTime(cls.startsAt)}
                          </span>
                        )}
                      </div>

                      <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white leading-snug">
                        {cls.title}
                      </h3>
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                        Interactive session
                      </span>
                      <Link
                        href={`/live-class/${cls.id}`}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold shadow-sm shadow-emerald-600/20 transition-all"
                      >
                        <span className="material-symbols-outlined text-sm">video_call</span>
                        <span>Join Class</span>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* 8. Recorded Lectures (Only shown if data exists) */}
        {hasLectures && (
          <section className="space-y-3.5">
            <div className="flex items-center justify-between">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600 dark:text-blue-400">
                  smart_display
                </span>
                <span>Recorded Lectures</span>
              </h2>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {profile.lectures.length} Lectures
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {profile.lectures.map((lec) => {
                const lectureHref =
                  lec.batchId && lec.subjectId && lec.chapterId
                    ? `/courses/${lec.batchId}/subjects/${lec.subjectId}/chapters/${lec.chapterId}/lectures/${lec.id}`
                    : lec.batchId
                    ? `/courses/${lec.batchId}`
                    : "/courses";

                return (
                  <div
                    key={lec.id}
                    className="bg-white dark:bg-[#111625] rounded-2xl p-4 sm:p-5 border border-slate-200/90 dark:border-slate-800 shadow-sm hover:border-blue-400 dark:hover:border-blue-500/50 transition-all flex flex-col justify-between gap-3 group"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                        <span className="text-[11px] font-semibold truncate max-w-[200px]">
                          {lec.chapterTitle || lec.subjectName || "Subject Chapter"}
                        </span>
                        {lec.durationMin ? (
                          <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                            {lec.durationMin}m
                          </span>
                        ) : null}
                      </div>

                      <h3 className="font-extrabold text-sm text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2">
                        {lec.title}
                      </h3>
                    </div>

                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        On-demand replay
                      </span>
                      <Link
                        href={lectureHref}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-blue-600 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-xs font-bold transition-all"
                      >
                        <span className="material-symbols-outlined text-sm">play_arrow</span>
                        <span>View Lecture</span>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* 9. Student Testimonials / What Students Say */}
        <section className="bg-white dark:bg-[#111625] rounded-3xl p-6 sm:p-7 border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-500">
                  reviews
                </span>
                <span>What Students Say</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Verified reviews from enrolled batch students
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <WriteTestimonialButtonAndModal
                teacherId={profile.id}
                teacherName={profile.name}
              />
            </div>
          </div>

          {hasTestimonials ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {profile.testimonials.map((test) => (
                <div
                  key={test.id}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/80 space-y-2.5 flex flex-col justify-between"
                >
                  <p className="text-xs leading-relaxed text-slate-700 dark:text-slate-200 italic">
                    &ldquo;{test.content}&rdquo;
                  </p>

                  <div className="pt-2 border-t border-slate-200/50 dark:border-slate-800/60 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0 overflow-hidden">
                        {test.studentPhoto ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={test.studentPhoto} alt={test.studentName} className="w-full h-full object-cover" />
                        ) : (
                          (test.studentName[0] || "S").toUpperCase()
                        )}
                      </div>
                      <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                        {test.studentName}
                      </span>
                    </div>

                    <div className="flex items-center gap-0.5 text-amber-400">
                      {[...Array(test.rating)].map((_, i) => (
                        <span key={i} className="material-symbols-outlined text-sm">
                          star
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 rounded-2xl bg-slate-50/70 dark:bg-slate-900/30 border border-dashed border-slate-200 dark:border-slate-800 text-center space-y-2">
              <span className="material-symbols-outlined text-2xl text-slate-400">
                rate_review
              </span>
              <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                No reviews yet. Enrolled in {profile.name}&apos;s batch? Be the first to share your learning feedback!
              </p>
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
