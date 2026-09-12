"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Teacher = {
  id: string;
  department: string;
  subjects: string[];
  bio: string | null;
  user: { name: string; photoUrl: string | null };
};

async function getJson(url: string) {
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.error ?? "Request failed");
  return json.data;
}

export function BookSessionTeacherList() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await getJson("/api/doubt-booking/teachers");
        setTeachers(data.teachers || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load teachers");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">Book a Session</h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Pick a teacher and grab a 1:1 doubt-solving slot.
          </p>
        </div>
        <Link
          href="/book-session/bookings"
          className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
        >
          My Bookings
          <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </Link>
      </header>

      {loading ? (
        <p className="text-xs text-slate-400 text-center py-12">Loading…</p>
      ) : error ? (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs font-semibold text-amber-700 dark:text-amber-300 text-center">
          {error}
        </div>
      ) : teachers.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 p-12 text-center text-slate-500 text-xs md:text-sm">
          No teachers have open doubt-session slots right now — check back soon.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {teachers.map((t) => (
            <Link
              key={t.id}
              href={`/book-session/${t.id}`}
              className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-blue-400 transition flex items-center gap-3"
            >
              {t.user.photoUrl ? (
                <img
                  src={t.user.photoUrl}
                  alt={t.user.name}
                  className="w-12 h-12 rounded-full object-cover shrink-0"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center font-bold shrink-0">
                  {t.user.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{t.user.name}</p>
                <p className="text-[11px] text-slate-500 truncate">
                  {t.subjects.join(", ") || t.department}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
