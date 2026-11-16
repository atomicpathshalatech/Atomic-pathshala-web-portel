import React from "react";
import Link from "next/link";

export default function PublicPyqLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950">
      {/* Sub-Header Navigation */}
      <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link
              href="/pyq"
              className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2 hover:opacity-80 transition"
            >
              <span className="material-symbols-outlined text-blue-600 text-xl">history_edu</span>
              <span>PYQ Library</span>
            </Link>

            <nav className="hidden md:flex items-center gap-1 text-xs font-bold">
              <Link
                href="/pyq/neet"
                className="px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                NEET UG
              </Link>
              <Link
                href="/pyq/jee-main"
                className="px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                JEE Main
              </Link>
              <Link
                href="/pyq/jee-advanced"
                className="px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                JEE Advanced
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/pyq"
              className="flex items-center gap-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-blue-600 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 transition"
            >
              <span className="material-symbols-outlined text-sm">search</span>
              <span>Search PYQs</span>
            </Link>

            <Link
              href="/login"
              className="text-xs font-black text-white bg-blue-600 hover:bg-blue-700 px-3.5 py-1.5 rounded-lg transition shadow-sm"
            >
              Login for Solutions
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
