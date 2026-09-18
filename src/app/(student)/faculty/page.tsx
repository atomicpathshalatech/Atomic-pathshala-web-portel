import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { CheckCircle, Award, Briefcase, GraduationCap } from "lucide-react";

export const metadata: Metadata = {
  title: "Our Expert Faculty — Atomic Pathshala",
  description: "Meet the top educators and subject matter experts at Atomic Pathshala.",
};

export default async function FacultyDirectoryPage() {
  const teachers = await prisma.teacher.findMany({
    where: { user: { status: "ACTIVE" } },
    include: { user: { select: { id: true, name: true, photoUrl: true } } },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-black text-slate-900">Our Expert Faculty</h1>
        <p className="text-xs text-slate-500 mt-1">
          Learn from India&apos;s leading educators with proven track records of top ranks in NEET and JEE.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {teachers.map((t) => {
          const name = t.displayName || t.user.name || "Faculty";
          const subjects = t.subjects.length > 0 ? t.subjects.join(" • ") : t.department;
          let qual: string | null = null;
          if (Array.isArray(t.qualifications) && t.qualifications.length > 0) {
            const first = t.qualifications[0];
            qual = typeof first === "string" ? first : (first as any)?.degree || null;
          }

          return (
            <Link
              key={t.id}
              href={`/faculty/${t.id}`}
              className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm hover:shadow-md hover:border-blue-300 transition flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center gap-3">
                  <div className="h-16 w-16 rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                    {t.user.photoUrl ? (
                      <img src={t.user.photoUrl} alt={name} className="h-full w-full object-cover object-top" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center bg-blue-600 text-white font-bold text-xl">
                        {name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <h3 className="font-bold text-sm text-slate-900 truncate">{name}</h3>
                      <CheckCircle className="w-3.5 h-3.5 text-blue-600 fill-blue-100 shrink-0" />
                    </div>
                    <p className="text-xs font-semibold text-blue-600 truncate">{subjects}</p>
                    {t.experienceYears && (
                      <p className="text-[11px] text-slate-500 mt-0.5">{t.experienceYears}+ yrs exp</p>
                    )}
                  </div>
                </div>

                {qual && (
                  <div className="mt-3 flex items-center gap-1.5 text-[11px] text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg">
                    <GraduationCap className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{qual}</span>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                  <Award className="w-3 h-3" />
                  Verified
                </span>
                <span className="text-xs font-bold text-blue-600">View Profile →</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
