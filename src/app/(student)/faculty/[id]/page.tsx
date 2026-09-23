import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import {
  CheckCircle,
  GraduationCap,
  Briefcase,
  BookOpen,
  Calendar,
  Languages,
  Award,
  ArrowLeft,
  Video,
  ChevronRight,
} from "lucide-react";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const teacher = await prisma.teacher.findUnique({
    where: { id: params.id },
    include: { user: { select: { name: true } } },
  });
  if (!teacher) return { title: "Faculty Profile — Atomic Pathshala" };
  const name = teacher.displayName || teacher.user.name || "Faculty";
  return {
    title: `${name} — Verified Faculty | Atomic Pathshala`,
    description: `Learn from ${name} (${teacher.department}) on Atomic Pathshala.`,
  };
}

export default async function FacultyProfilePage({ params }: { params: { id: string } }) {
  const teacher = await prisma.teacher.findUnique({
    where: { id: params.id },
    include: {
      user: { select: { id: true, name: true, photoUrl: true, email: true } },
      batchAssignments: {
        include: {
          batch: {
            select: { id: true, name: true, code: true, targetExam: true, status: true },
          },
        },
      },
      scheduleSessions: {
        where: { startsAt: { gte: new Date() } },
        orderBy: { startsAt: "asc" },
        take: 5,
        select: { id: true, title: true, type: true, startsAt: true, endsAt: true, status: true },
      },
    },
  });

  if (!teacher) {
    notFound();
  }

  const name = teacher.displayName || teacher.user.name || "Atomic Faculty";
  const subjects = teacher.subjects.length > 0 ? teacher.subjects : [teacher.department];
  const targetExams = teacher.targetExams.length > 0 ? teacher.targetExams : ["NEET", "JEE"];
  const languages = teacher.languages.length > 0 ? teacher.languages : ["Hindi", "English"];

  // Qualifications parser
  let qualifications: Array<{ degree: string; college?: string; year?: string }> = [];
  if (Array.isArray(teacher.qualifications)) {
    qualifications = (teacher.qualifications as any[]).map((q) =>
      typeof q === "string" ? { degree: q } : { degree: q.degree || "Degree", college: q.college, year: q.year }
    );
  }

  // Experience parser
  let experienceList: Array<{ role: string; institute?: string; years?: string }> = [];
  if (Array.isArray(teacher.experienceList)) {
    experienceList = (teacher.experienceList as any[]).map((e) => {
      if (typeof e === "string") return { role: e };
      const role = e.designation || e.role || "Faculty";
      const institute = e.organization || e.institute || "";
      let years = e.years;
      if (e.totalMonths) {
        const y = Math.floor(Number(e.totalMonths) / 12);
        const m = Number(e.totalMonths) % 12;
        years = `${y > 0 ? `${y} yr${y > 1 ? "s" : ""} ` : ""}${m > 0 ? `${m} mo${m > 1 ? "s" : ""}` : ""}`.trim() || `${e.totalMonths} mos`;
      } else if (e.startYear && e.endYear) {
        years = `${e.startYear} – ${e.endYear}`;
      }
      return { role, institute, years };
    });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-12">
      {/* Back button */}
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
      </div>

      {/* Hero Faculty Header Card */}
      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
        <div className="h-28 sm:h-36 bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 relative">
          <div className="absolute top-4 right-4 flex items-center gap-1 rounded-full bg-white/20 backdrop-blur-md px-3 py-1 text-xs font-bold text-white">
            <Award className="w-4 h-4 text-amber-300" />
            Verified Faculty
          </div>
        </div>

        <div className="px-6 pb-6 pt-0 relative">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-14 sm:-mt-16 mb-4">
            <div className="relative h-24 w-24 sm:h-28 sm:w-28 rounded-2xl overflow-hidden border-4 border-white bg-slate-100 shadow-md">
              {teacher.user.photoUrl ? (
                <img
                  src={teacher.user.photoUrl}
                  alt={name}
                  className="h-full w-full object-cover object-top"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-600 to-indigo-700 text-3xl font-extrabold text-white">
                  {name.charAt(0)}
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0 sm:pb-2">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black text-slate-900">{name}</h1>
                <CheckCircle className="w-5 h-5 text-blue-600 fill-blue-100 shrink-0" />
              </div>
              <p className="text-sm font-semibold text-blue-600 mt-0.5">
                {subjects.join(" • ")} Specialist
              </p>
            </div>
          </div>

          {/* Quick Tags Bar */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
            {teacher.experienceYears && (
              <span className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                <Briefcase className="w-3.5 h-3.5" />
                {teacher.experienceYears}+ Years Teaching Experience
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
              <BookOpen className="w-3.5 h-3.5" />
              Target: {targetExams.join(", ")}
            </span>
            <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
              <Languages className="w-3.5 h-3.5" />
              Medium: {languages.join(" + ")}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left 2 Cols: Bio, Qualifications, Experience */}
        <div className="md:col-span-2 space-y-6">
          {/* Bio / About */}
          {teacher.bio && (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2">
                <Award className="w-4 h-4 text-blue-600" />
                About Faculty
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
                {teacher.bio}
              </p>
            </div>
          )}

          {/* Qualifications */}
          {qualifications.length > 0 && (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-indigo-600" />
                Academic Background &amp; Qualifications
              </h3>
              <div className="space-y-2.5">
                {qualifications.map((q, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-700 mt-0.5">
                      <GraduationCap className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">{q.degree}</p>
                      {q.college && <p className="text-[11px] text-slate-500">{q.college}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Experience */}
          {experienceList.length > 0 && (
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-amber-600" />
                Teaching Experience
              </h3>
              <div className="space-y-2.5">
                {experienceList.map((exp, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="p-1.5 rounded-lg bg-amber-100 text-amber-700 mt-0.5">
                      <Briefcase className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold text-slate-900 truncate">{exp.role}</p>
                        {exp.years && (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60 shrink-0">
                            {exp.years}
                          </span>
                        )}
                      </div>
                      {exp.institute && <p className="text-[11px] text-slate-500 mt-0.5">{exp.institute}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right 1 Col: Batches & Upcoming Live Classes */}
        <div className="space-y-6">
          {/* Batches Taught */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-blue-600" />
              Batches
            </h3>
            {teacher.batchAssignments.length === 0 ? (
              <p className="text-xs text-slate-400">No active batches assigned currently.</p>
            ) : (
              <div className="space-y-2">
                {teacher.batchAssignments.map(({ batch }) => (
                  <Link
                    key={batch.id}
                    href={`/courses/${batch.id}`}
                    className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50 hover:bg-blue-50/50 hover:border-blue-200 transition"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-900 truncate">{batch.name}</p>
                      <p className="text-[10px] text-slate-500 font-semibold">{batch.targetExam}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming Live Classes */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
              <Video className="w-4 h-4 text-rose-600" />
              Upcoming Live Classes
            </h3>
            {teacher.scheduleSessions.length === 0 ? (
              <p className="text-xs text-slate-400">No upcoming live classes scheduled.</p>
            ) : (
              <div className="space-y-2">
                {teacher.scheduleSessions.map((schedule) => (
                  <div
                    key={schedule.id}
                    className="p-3 rounded-xl border border-slate-100 bg-slate-50"
                  >
                    <p className="text-xs font-bold text-slate-900 truncate">{schedule.title}</p>
                    <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      {schedule.startsAt.toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
