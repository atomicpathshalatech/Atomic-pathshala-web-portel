import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTeacherProfileBySlug } from "@/lib/teacher/profile";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const profile = await getTeacherProfileBySlug(params.slug);
  if (!profile) return { title: "Teacher Not Found" };

  return {
    title: `${profile.name} — ${profile.headline} | Atomic Pathshala`,
    description: profile.bio.slice(0, 160),
  };
}

export default async function TeacherProfilePage({
  params,
}: {
  params: { slug: string };
}) {
  const profile = await getTeacherProfileBySlug(params.slug);
  if (!profile) notFound();

  return (
    <>
      <Navbar />
      <main className="pt-24 pb-16 px-margin-mobile md:px-margin-desktop max-w-5xl mx-auto space-y-8 font-sans">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-on-surface-variant">
          <Link href="/" className="hover:text-primary transition-colors">
            Home
          </Link>
          <span className="material-symbols-outlined text-xs">chevron_right</span>
          <Link href="/#faculty" className="hover:text-primary transition-colors">
            Faculty Directory
          </Link>
          <span className="material-symbols-outlined text-xs">chevron_right</span>
          <span className="text-primary font-semibold">{profile.name}</span>
        </div>

        {/* 1. Profile Hero Header */}
        <section className="glass-card rounded-3xl p-6 md:p-10 border border-outline-variant/30 relative overflow-hidden bg-gradient-to-br from-primary/10 via-surface to-surface shadow-xl space-y-6">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            {/* Circular Profile Avatar */}
            <div className="w-24 h-24 md:w-28 md:h-28 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-3xl md:text-4xl border-4 border-white dark:border-slate-800 shadow-xl shrink-0">
              {profile.name
                .split(" ")
                .map((p) => p[0])
                .slice(0, 2)
                .join("")}
            </div>

            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="font-headline-lg text-headline-lg md:text-3xl font-bold text-on-surface">
                  {profile.name}
                </h1>
                {profile.isVerified && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold border border-primary/20">
                    <span className="material-symbols-outlined text-sm">verified</span>
                    Verified Faculty
                  </span>
                )}
              </div>

              <p className="font-body-md text-body-md text-primary font-medium">
                {profile.headline}
              </p>

              {/* Expertise Tags */}
              <div className="flex flex-wrap gap-2 pt-1">
                {profile.targetExams.map((exam) => (
                  <span
                    key={exam}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-surface-container-high text-on-surface"
                  >
                    {exam}
                  </span>
                ))}
                {profile.subjects.map((sub) => (
                  <span
                    key={sub}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-primary/10 text-primary"
                  >
                    {sub}
                  </span>
                ))}
                <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-surface-container-high text-on-surface-variant">
                  {profile.languages.join(" + ")}
                </span>
              </div>
            </div>
          </div>

          {/* Social Proof Metric Tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-outline-variant/20">
            <div className="p-3 bg-surface-container-lowest rounded-2xl text-center border border-outline-variant/20">
              <span className="text-xs text-on-surface-variant block">Experience</span>
              <span className="font-bold text-on-surface text-base">{profile.experienceYears}</span>
            </div>
            <div className="p-3 bg-surface-container-lowest rounded-2xl text-center border border-outline-variant/20">
              <span className="text-xs text-on-surface-variant block">Student Rating</span>
              <span className="font-bold text-amber-500 text-base flex items-center justify-center gap-1">
                ★ {profile.rating ?? 4.9}
              </span>
            </div>
            <div className="p-3 bg-surface-container-lowest rounded-2xl text-center border border-outline-variant/20">
              <span className="text-xs text-on-surface-variant block">Active Batches</span>
              <span className="font-bold text-primary text-base">{profile.batches.length} Programs</span>
            </div>
            <div className="p-3 bg-surface-container-lowest rounded-2xl text-center border border-outline-variant/20">
              <span className="text-xs text-on-surface-variant block">Recorded Lectures</span>
              <span className="font-bold text-secondary text-base">{profile.lectures.length}+ Classes</span>
            </div>
          </div>
        </section>

        {/* Grid: Details & Content */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: About, Experience & Qualifications */}
          <div className="lg:col-span-7 space-y-8">
            {/* About */}
            <section className="glass-card rounded-3xl p-6 md:p-8 space-y-4">
              <h2 className="font-headline-md text-headline-md font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">person</span>
                About Educator
              </h2>
              <p className="text-body-md text-on-surface-variant leading-relaxed whitespace-pre-wrap">
                {profile.bio}
              </p>
            </section>

            {/* Experience Timeline */}
            <section className="glass-card rounded-3xl p-6 md:p-8 space-y-4">
              <h2 className="font-headline-md text-headline-md font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">work_history</span>
                Professional Experience
              </h2>
              <div className="space-y-4 border-l-2 border-primary/30 pl-4">
                {profile.experienceList.map((exp, idx) => (
                  <div key={idx} className="space-y-1">
                    <p className="font-bold text-sm text-on-surface">{exp.role}</p>
                    <p className="text-xs text-primary font-semibold">{exp.organization}</p>
                    {exp.duration && (
                      <p className="text-[11px] text-on-surface-variant">{exp.duration}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* Educational Qualification */}
            <section className="glass-card rounded-3xl p-6 md:p-8 space-y-4">
              <h2 className="font-headline-md text-headline-md font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">school</span>
                Educational Qualifications
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {profile.qualifications.map((q, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/20 space-y-1"
                  >
                    <p className="font-bold text-sm text-on-surface">{q.degree}</p>
                    <p className="text-xs text-on-surface-variant">{q.institution}</p>
                    {q.year && <p className="text-[11px] text-primary">{q.year}</p>}
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Right Column: Courses, Upcoming Classes & Lectures */}
          <div className="lg:col-span-5 space-y-8">
            {/* Active Batches */}
            <section className="glass-card rounded-3xl p-6 space-y-4">
              <h3 className="font-headline-md text-headline-md font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">menu_book</span>
                Courses &amp; Batches
              </h3>
              {profile.batches.length === 0 ? (
                <p className="text-xs text-on-surface-variant">No active batches assigned.</p>
              ) : (
                <div className="space-y-3">
                  {profile.batches.map((b) => (
                    <div
                      key={b.id}
                      className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/20 flex items-center justify-between gap-3"
                    >
                      <div>
                        <p className="font-bold text-sm text-on-surface">{b.name}</p>
                        <p className="text-xs text-on-surface-variant mt-0.5">{b.code}</p>
                      </div>
                      <Link
                        href="/register"
                        className="px-3.5 py-1.5 rounded-xl bg-primary text-on-primary text-xs font-semibold hover:opacity-90 transition-all shrink-0"
                      >
                        Enroll
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Upcoming Live Classes */}
            <section className="glass-card rounded-3xl p-6 space-y-4">
              <h3 className="font-headline-md text-headline-md font-bold text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary">videocam</span>
                Upcoming Live Classes
              </h3>
              {profile.upcomingClasses.length === 0 ? (
                <p className="text-xs text-on-surface-variant">No live classes scheduled today.</p>
              ) : (
                <div className="space-y-3">
                  {profile.upcomingClasses.map((c) => (
                    <div
                      key={c.id}
                      className="p-4 rounded-2xl bg-surface-container-lowest border border-outline-variant/20 space-y-2"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-on-surface">{c.title}</span>
                        <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                          {c.startsAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className="text-[11px] text-on-surface-variant">{c.batchName}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Recorded Lectures Preview */}
            {profile.lectures.length > 0 && (
              <section className="glass-card rounded-3xl p-6 space-y-4">
                <h3 className="font-headline-md text-headline-md font-bold text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">play_circle</span>
                  Recorded Lectures
                </h3>
                <div className="space-y-2.5">
                  {profile.lectures.map((lec) => (
                    <div
                      key={lec.id}
                      className="p-3 rounded-xl bg-surface-container-lowest border border-outline-variant/20 flex items-center justify-between text-xs"
                    >
                      <div>
                        <p className="font-semibold text-on-surface">{lec.title}</p>
                        <p className="text-[10px] text-on-surface-variant mt-0.5">
                          {lec.chapterTitle || "Course Lecture"}
                        </p>
                      </div>
                      <Link href="/login" className="text-primary font-bold text-xs hover:underline">
                        Watch &rarr;
                      </Link>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
