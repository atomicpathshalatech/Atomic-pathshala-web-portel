"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Icon, Section } from "./ui";

// The app's real search (notes, PYQs, tests, classes …) — only for signed-in users, loaded on demand.
const GlobalSearchBar = dynamic(() => import("@/components/search/GlobalSearchBar").then((m) => m.GlobalSearchBar), { ssr: false });

const QUICK = [
  { label: "PYQs", href: "/practice" },
  { label: "Notes", href: "/study-material" },
  { label: "Mind Maps", href: "/study-material" },
  { label: "Formula Sheets", href: "/study-material" },
  { label: "Tests", href: "/tests" },
  { label: "DPP", href: "/dpp" },
];

/**
 * "What are you looking for?" — signed-in students get the app's real search;
 * visitors type a topic and are asked to log in (free) to see results, since
 * the search only covers content their account can open.
 */
export function HomeSearch() {
  const { status } = useSession();
  const router = useRouter();
  const [q, setQ] = useState("");

  return (
    <Section id="search" tone="tint">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">What are you looking for?</h2>
        <p className="mt-2 text-sm sm:text-base text-slate-600">Find notes, PYQs, DPPs, tests and classes for any chapter or topic.</p>

        <div className="mt-5 text-left">
          {status === "authenticated" ? (
            <div className="rounded-2xl bg-white p-2 shadow-sm ring-1 ring-slate-200">
              <GlobalSearchBar />
            </div>
          ) : (
            <form
              role="search"
              onSubmit={(e) => {
                e.preventDefault();
                router.push(`/login?callbackUrl=${encodeURIComponent("/dashboard")}`);
              }}
              className="flex items-center gap-2 rounded-2xl bg-white p-2 shadow-sm ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-blue-500"
            >
              <Icon name="search" className="ml-2 text-[22px] text-slate-400" />
              <label htmlFor="home-search" className="sr-only">
                Search topics
              </label>
              <input
                id="home-search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search Physics, Chemistry, Biology, Maths, PYQs, Notes, Tests..."
                className="min-h-[44px] w-full min-w-0 bg-transparent text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none"
              />
              <button type="submit" className="min-h-[44px] shrink-0 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">
                Search
              </button>
            </form>
          )}
          {status !== "authenticated" && (
            <p className="mt-2 px-1 text-xs text-slate-500">
              Search covers notes, PYQs, DPPs, tests and classes — <Link href="/register" className="font-semibold text-blue-700 hover:underline">create a free account</Link> or log in to see results.
            </p>
          )}
        </div>

        <ul className="mt-5 flex flex-wrap justify-center gap-2" aria-label="Popular">
          {QUICK.map((c) => (
            <li key={c.label}>
              <Link href={c.href} className="inline-flex min-h-[36px] items-center rounded-full bg-white px-3.5 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:text-blue-700 hover:ring-blue-300">
                {c.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
