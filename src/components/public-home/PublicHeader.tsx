"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { Icon } from "./ui";

const NAV = [
  { label: "Courses", href: "#courses" },
  { label: "Free Resources", href: "#free" },
  { label: "PYQs", href: "#pyq" },
  { label: "Tests", href: "#tests" },
  { label: "Study Material", href: "#material" },
];

/** Where a signed-in user's "Dashboard" goes (same rule as the site navbar). */
function dashboardFor(role?: string | null) {
  if (role === "TEACHER" || role === "FACULTY" || role === "STAFF") return "/team";
  if (role === "SUPER_ADMIN" || role === "ADMIN") return "/founder-dashboard";
  if (role === "PARENT") return "/parent/dashboard";
  return "/dashboard";
}

/** Compact sticky header for the public homepage only. */
export function PublicHeader() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const signedIn = status === "authenticated";
  const dashboard = dashboardFor((session?.user as { role?: string } | undefined)?.role);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header
      className={`sticky top-0 z-50 w-full bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/75 transition-shadow ${
        scrolled ? "shadow-[0_1px_0_rgba(15,23,42,0.08)]" : ""
      }`}
    >
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" aria-label="Atomic Pathshala home">
          <Image src="/brand/logo.png" alt="" width={32} height={32} priority className="h-8 w-8 rounded-lg object-contain" />
          <span className="text-[17px] font-bold tracking-tight text-[#0b1736]">
            Atomic <span className="text-blue-600">Pathshala</span>
          </span>
        </Link>

        <nav aria-label="Main" className="ml-6 hidden lg:flex items-center gap-1">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:text-blue-700 hover:bg-blue-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
              {n.label}
            </a>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <a href="#search" aria-label="Search" className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            <Icon name="search" className="text-[22px]" />
          </a>
          {signedIn ? (
            <Link href={dashboard} className="inline-flex min-h-[44px] items-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
              Dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" className="inline-flex min-h-[44px] items-center rounded-xl px-3 text-sm font-semibold text-slate-700 hover:text-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                Login
              </Link>
              <Link href="/register" className="hidden sm:inline-flex min-h-[44px] items-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
                Start Learning Free
              </Link>
            </>
          )}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="home-mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            className="lg:hidden flex h-11 w-11 items-center justify-center rounded-xl text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <Icon name={open ? "close" : "menu"} className="text-[24px]" />
          </button>
        </div>
      </div>

      {open && (
        <nav id="home-mobile-menu" aria-label="Mobile" className="lg:hidden border-t border-slate-100 bg-white px-4 pb-4 pt-2 shadow-lg">
          <ul className="flex flex-col">
            {NAV.map((n) => (
              <li key={n.href}>
                <a href={n.href} onClick={() => setOpen(false)} className="flex min-h-[44px] items-center rounded-lg px-2 text-[15px] font-medium text-slate-700 hover:bg-slate-50">
                  {n.label}
                </a>
              </li>
            ))}
            <li>
              <Link href="/teachers" onClick={() => setOpen(false)} className="flex min-h-[44px] items-center rounded-lg px-2 text-[15px] font-medium text-slate-700 hover:bg-slate-50">
                Faculty
              </Link>
            </li>
          </ul>
          {!signedIn && (
            <Link href="/register" onClick={() => setOpen(false)} className="mt-2 flex min-h-[44px] items-center justify-center rounded-xl bg-blue-600 text-sm font-semibold text-white">
              Start Learning Free
            </Link>
          )}
        </nav>
      )}
    </header>
  );
}
