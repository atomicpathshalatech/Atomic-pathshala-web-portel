"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getBreadcrumbsForPath } from "@/lib/navigation/breadcrumb-helper";

export function TeamBreadcrumb() {
  const pathname = usePathname();
  const crumbs = getBreadcrumbsForPath(pathname || "/team");

  if (crumbs.length <= 1) return null;

  return (
    <nav aria-label="Breadcrumb" className="hidden lg:flex items-center text-xs font-medium text-slate-500">
      <ol className="flex items-center gap-1.5 flex-wrap">
        {crumbs.map((crumb, idx) => {
          const isLast = idx === crumbs.length - 1;
          return (
            <li key={idx} className="flex items-center gap-1.5">
              {idx > 0 && (
                <span className="material-symbols-outlined text-[13px] text-slate-300 select-none">
                  chevron_right
                </span>
              )}
              {crumb.href && !isLast ? (
                <Link
                  href={crumb.href}
                  className="hover:text-slate-900 transition-colors text-slate-500 font-medium"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span
                  className={
                    isLast
                      ? "text-slate-900 font-semibold"
                      : "text-slate-500"
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
