import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { generateSlug, formatDobDayMonth } from "@/lib/teacher/profile";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";

export const metadata: Metadata = {
  title: "Expert Faculty Directory | Atomic Pathshala",
  description:
    "Explore Atomic Pathshala's verified faculty members, doctors, and engineers dedicated to NEET & JEE excellence.",
};

export default async function FacultyDirectoryPage() {
  const teachers = await prisma.teacher.findMany({
    where: {
      onboardingStatus: { not: "REJECTED" },
      user: { status: "ACTIVE" },
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          photoUrl: true,
          email: true,
        },
      },
      badges: {
        select: {
          id: true,
          title: true,
          icon: true,
        },
      },
      batchAssignments: {
        include: {
          batch: {
            select: { id: true, name: true },
          },
        },
      },
      followers: {
        select: { id: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc] dark:bg-[#0b0f19] text-slate-900 dark:text-slate-100 antialiased font-sans">
      <Navbar />

      <main className="flex-1 pt-24 pb-20 px-4 sm:px-6 max-w-6xl mx-auto w-full space-y-8">
        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <Link href="/" className="hover:text-blue-600 transition-colors">
            Home
          </Link>
          <span className="material-symbols-outlined text-xs text-slate-400">chevron_right</span>
          <span className="text-blue-600 dark:text-blue-400 font-semibold truncate">
            Faculty Directory
          </span>
        </nav>

        {/* Directory Hero Banner */}
        <section className="bg-white dark:bg-[#111625] rounded-3xl p-6 sm:p-10 border border-slate-200/90 dark:border-slate-800 shadow-sm relative overflow-hidden text-center space-y-3">
          <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 text-xs font-bold border border-blue-200 dark:border-blue-800">
            <span className="material-symbols-outlined text-sm">school</span>
            <span>Atomic Pathshala Educators</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
            Learn from <span className="text-blue-600 dark:text-blue-400">Top Academic Mentors</span>
          </h1>

          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Our educators are doctors, engineers, and veteran mentors with proven track records in producing top NEET and JEE ranks through concept-first learning.
          </p>
        </section>

        {/* Faculty Grid */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-600 dark:text-blue-400">
                group
              </span>
              <span>All Faculty Members</span>
            </h2>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {teachers.length} Verified Educators
            </span>
          </div>

          {teachers.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-[#111625] rounded-3xl border border-slate-200 dark:border-slate-800 space-y-2">
              <span className="material-symbols-outlined text-4xl text-slate-400">
                sentiment_dissatisfied
              </span>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                No faculty members found at this time.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {teachers.map((teacher) => {
                const name = teacher.user.name || "Faculty Member";
                const slug = generateSlug(name);
                const primarySubject =
                  teacher.subjects && teacher.subjects.length > 0
                    ? teacher.subjects.join(", ")
                    : teacher.department || "Faculty";
                const followerCount = teacher.followers.length;
                const badgesCount = teacher.badges.length;

                // Qualifications summary
                let qualSummary = "";
                if (Array.isArray(teacher.qualifications) && teacher.qualifications.length > 0) {
                  qualSummary = (teacher.qualifications as any[])
                    .map((q) => q.degree)
                    .filter(Boolean)
                    .join(", ");
                }

                return (
                  <Link
                    key={teacher.id}
                    href={`/teachers/${slug}`}
                    className="bg-white dark:bg-[#111625] rounded-3xl p-6 border border-slate-200/90 dark:border-slate-800 shadow-sm hover:border-blue-500/60 dark:hover:border-blue-500/60 transition-all hover:-translate-y-1 hover:shadow-md flex flex-col justify-between gap-5 group"
                  >
                    <div className="space-y-4">
                      {/* Top Header */}
                      <div className="flex items-start gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/10 to-blue-600/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-extrabold text-xl border border-blue-100 dark:border-blue-900/50 shadow-sm shrink-0 overflow-hidden">
                          {teacher.user.photoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={teacher.user.photoUrl}
                              alt={name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            name
                              .split(" ")
                              .map((p) => p[0])
                              .slice(0, 2)
                              .join("")
                              .toUpperCase()
                          )}
                        </div>

                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h3 className="font-extrabold text-base text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors truncate">
                              {name}
                            </h3>
                          </div>
                          <span className="inline-block text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md">
                            {primarySubject}
                          </span>
                        </div>
                      </div>

                      {/* Details & Tags */}
                      <div className="space-y-2 text-xs text-slate-600 dark:text-slate-300">
                        {qualSummary && (
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="material-symbols-outlined text-sm text-slate-400 shrink-0">
                              history_edu
                            </span>
                            <span className="truncate">{qualSummary}</span>
                          </div>
                        )}

                        {teacher.experienceYears && (
                          <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-sm text-slate-400 shrink-0">
                              work_history
                            </span>
                            <span>{teacher.experienceYears} Years Experience</span>
                          </div>
                        )}

                        {teacher.targetExams && teacher.targetExams.length > 0 && (
                          <div className="flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-sm text-slate-400 shrink-0">
                              flag
                            </span>
                            <span>{teacher.targetExams.join(" & ")}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bottom Action */}
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 font-semibold">
                        {followerCount > 0 && (
                          <span>{followerCount} Followers</span>
                        )}
                        {badgesCount > 0 && (
                          <span>• {badgesCount} Badges</span>
                        )}
                      </div>

                      <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 group-hover:translate-x-0.5 transition-transform">
                        <span>View Profile</span>
                        <span className="material-symbols-outlined text-sm">arrow_forward</span>
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <Footer />
    </div>
  );
}
