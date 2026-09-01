"use client";

import React from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";

const NAV_LINKS = [
  { label: "Explore Courses", href: "/courses" },
  { label: "Batches", href: "#batches" },
  { label: "Faculty", href: "#faculty" },
  { label: "Results", href: "#results" },
];

export function Navbar() {
  const { data: session, status } = useSession();
  const user = session?.user;

  // Determine Dashboard destination based on role
  let dashboardHref = "/dashboard";
  if (user?.role === "TEACHER" || user?.role === "FACULTY" || user?.role === "STAFF") {
    dashboardHref = "/team";
  } else if (user?.role === "SUPER_ADMIN" || user?.role === "ADMIN") {
    dashboardHref = "/founder-dashboard";
  } else if (user?.role === "PARENT") {
    dashboardHref = "/parent/dashboard";
  }

  const initial = user?.name ? user.name.trim().charAt(0).toUpperCase() : "A";

  return (
    <nav className="fixed top-0 w-full z-50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 shadow-sm">
      <div className="flex justify-between items-center w-full px-4 sm:px-6 lg:px-8 py-3.5 max-w-7xl mx-auto">
        <Link href="/" className="font-extrabold text-lg sm:text-xl tracking-tight text-[#031635] dark:text-white flex items-center gap-2">
          <span className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center text-sm font-black shadow-sm">
            A
          </span>
          <span>Atomic Pathshala</span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/guru"
            className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1"
          >
            <span>Guru AI</span>
            <span className="px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-950 text-orange-600 text-[10px] font-black uppercase">
              24/7
            </span>
          </Link>
        </div>

        <div className="flex items-center gap-3">
          {status === "loading" ? (
            <div className="w-24 h-9 bg-slate-100 dark:bg-slate-800 rounded-full animate-pulse" />
          ) : user ? (
            // LOGGED-IN STATE
            <div className="flex items-center gap-2.5">
              <Link
                href={dashboardHref}
                className="bg-[#031635] dark:bg-purple-600 text-white font-bold text-xs px-4 sm:px-5 py-2.5 rounded-full hover:opacity-90 active:scale-95 transition-all shadow-sm flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-base">dashboard</span>
                <span>My Study Dashboard</span>
              </Link>

              <Link
                href={dashboardHref}
                className="w-9 h-9 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-bold flex items-center justify-center text-xs ring-2 ring-purple-400/50"
                title={user.name || "Student Account"}
              >
                {initial}
              </Link>
            </div>
          ) : (
            // GUEST / LOGGED-OUT STATE
            <>
              <Link
                href="/login"
                className="font-bold text-xs text-[#031635] dark:text-slate-200 px-3 py-2 hover:text-purple-600 transition-all"
              >
                Login / Sign Up
              </Link>
              <Link
                href="/register"
                className="bg-[#6b46c1] hover:bg-[#5b3da5] text-white font-bold text-xs px-5 py-2.5 rounded-full hover:opacity-95 active:scale-95 transition-all shadow-md shadow-purple-500/20"
              >
                Start Learning
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
