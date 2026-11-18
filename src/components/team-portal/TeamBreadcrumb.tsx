"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { getBreadcrumbsForPath } from "@/lib/navigation/breadcrumb-helper";

export function TeamBreadcrumb() {
  const pathname = usePathname();
  const crumbs = getBreadcrumbsForPath(pathname || "/team");

  if (crumbs.length <= 1) return null;

  return (
    <nav aria-label="Breadcrumb" className="hidden lg:flex items-center text-xs font-medium text-[#64748B]">
      <ol className="flex items-center gap-1.5 flex-wrap">
        {crumbs.map((crumb, idx) => {
          const isLast = idx === crumbs.length - 1;
          return (
            <li key={idx} className="flex items-center gap-1.5">
              {idx > 0 && <ChevronRight className="w-3 h-3 text-slate-400 select-none shrink-0" />}
              {crumb.href && !isLast ? (
                <Link
                  href={crumb.href}
                  className="hover:text-[#0F172A] transition-colors text-[#64748B] font-medium"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span
                  className={
                    isLast
                      ? "text-[#0F172A] font-semibold"
                      : "text-[#64748B]"
                  }
                  aria-current={isLast ? "page" : undefined}
                >
                  {crumb.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
