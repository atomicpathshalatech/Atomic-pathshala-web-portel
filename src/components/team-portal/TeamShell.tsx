"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/student/LogoutButton";
import { TeamProfileMenu } from "@/components/team-portal/TeamProfileMenu";
import { OpsBackButton } from "@/components/common/OpsBackButton";

export type TeamNavItem = { href: string; label: string; icon: string };
export type TeamNavSection = { title?: string; items: TeamNavItem[] };

/**
 * Team Portal shell — sidebar + top bar, replacing the old horizontal
 * scrolling top-nav. Structure follows the reference layout the user
 * pointed at (fixed left sidebar grouped into labeled sections, top bar
 * with logo + profile menu on the right) — rebuilt with this project's own
 * branding and design tokens, not the reference site's assets.
 *
 * Data-fetching (session, permissions, which nav items this role can see)
 * happens in the server layout; this component only renders what it's
 * handed and owns purely presentational state (mobile drawer open/closed,
 * active-link highlighting via usePathname).
 */
export function TeamShell({
  userName,
  userRoleLabel,
  hasTeacherProfile,
  sections,
  children,
}: {
  userName: string;
  userRoleLabel: string;
  hasTeacherProfile: boolean;
  sections: TeamNavSection[];
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();
  const isRootTeam = pathname === "/team";
  const isLiveStudio = pathname?.startsWith("/team/live-class") || pathname?.startsWith("/team/live-studio");

  if (isLiveStudio) {
    return (
      <div className="fixed inset-0 overflow-hidden bg-[#10131b]">
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen-safe bg-surface-container-low/30">
      <header className="sticky top-0 z-header bg-surface/90 backdrop-blur-md border-b border-outline-variant/20">
        <div className="h-[var(--header-h)] px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="md:hidden shrink-0 -ml-1 w-11 h-11 flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors"
              aria-label="Open menu"
            >
              <span className="material-symbols-outlined text-2xl">menu</span>
            </button>
            <Link href="/team" className="flex items-center gap-2.5 font-headline-md text-headline-md font-bold text-primary min-w-0">
              <img src="/brand/logo.png" alt="Atomic OPS Logo" className="w-8 h-8 rounded-lg object-contain shrink-0" />
              <span className="truncate flex items-center gap-1.5 font-black tracking-tight">
                <span>ATOMIC</span>
                <span className="px-1.5 py-0.5 rounded-md bg-orange-500 text-white text-xs font-black tracking-wider">OPS</span>
              </span>
            </Link>

            {!isRootTeam && (
              <div className="hidden sm:flex items-center pl-2 border-l border-outline-variant/30">
                <OpsBackButton label="Back" fallbackHref="/team" />
              </div>
            )}
          </div>

          <TeamProfileMenu userName={userName} userRoleLabel={userRoleLabel} hasTeacherProfile={hasTeacherProfile} />
        </div>
      </header>

      <div className="flex">
        {/* Tablet icon rail (md) -> full sidebar (lg+) */}
        <aside className="hidden md:block w-[4.5rem] lg:w-[var(--sidebar-w)] shrink-0 border-r border-outline-variant/20 bg-surface/60 sticky top-[var(--header-h)] h-below-header overflow-y-auto overflow-x-hidden transition-[width] duration-200">
          <SidebarNav sections={sections} collapsible />
        </aside>

        {/* Mobile drawer */}
        {drawerOpen && (
          <div className="md:hidden fixed inset-0 z-drawer">
            <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
            <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-surface shadow-xl overflow-y-auto">
              <div className="flex items-center justify-between px-4 py-3.5 border-b border-outline-variant/20">
                <span className="font-headline-md text-headline-md font-bold text-primary">Menu</span>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="text-on-surface-variant hover:text-primary transition-colors"
                  aria-label="Close menu"
                >
                  <span className="material-symbols-outlined text-2xl">close</span>
                </button>
              </div>
              <SidebarNav sections={sections} onNavigate={() => setDrawerOpen(false)} />
            </aside>
          </div>
        )}

        <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          <div className="mx-auto w-full min-w-0 max-w-screen-2xl space-y-4">
            {!isRootTeam && (
              <div className="sm:hidden pb-1">
                <OpsBackButton label="Back" fallbackHref="/team" />
              </div>
            )}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

function SidebarNav({
  sections,
  onNavigate,
  collapsible = false,
}: {
  sections: TeamNavSection[];
  onNavigate?: () => void;
  /**
   * Renders as an icon-only rail below `lg` and expands to the full labelled
   * sidebar at `lg` and above. Used by the persistent sidebar so tablets get
   * navigation instead of nothing; the mobile drawer always renders labels.
   */
  collapsible?: boolean;
}) {
  const pathname = usePathname();

  const isActive = (href: string) => (href === "/team" ? pathname === "/team" : pathname === href || pathname.startsWith(`${href}/`));

  return (
    <nav className={`py-4 space-y-5 ${collapsible ? "px-2 lg:px-3" : "px-3"}`}>
      {sections.map((section, i) => (
        <div key={section.title ?? i}>
          {section.title && (
            <p
              className={`px-3 mb-1.5 text-[11px] font-bold uppercase tracking-wide text-on-surface-variant ${
                collapsible ? "hidden lg:block" : ""
              }`}
            >
              {section.title}
            </p>
          )}
          <div className="space-y-0.5">
            {section.items.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  title={item.label}
                  className={`flex items-center gap-3 py-2 rounded-lg font-label-md text-label-md transition-colors ${
                    collapsible ? "justify-center lg:justify-start px-2 lg:px-3" : "px-3"
                  } ${
                    active
                      ? "bg-primary/10 text-primary font-bold"
                      : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                  }`}
                >
                  <span className="material-symbols-outlined text-lg shrink-0">{item.icon}</span>
                  <span className={collapsible ? "hidden lg:block truncate" : "truncate"}>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}

      <div className="md:hidden px-3 pt-3 border-t border-outline-variant/20">
        <LogoutButton />
      </div>
    </nav>
  );
}
