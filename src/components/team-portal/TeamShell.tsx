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
      <div className="fixed inset-0 w-screen h-screen overflow-hidden bg-[#10131b]">
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-container-low/30">
      <header className="sticky top-0 z-50 bg-surface/90 backdrop-blur-md border-b border-outline-variant/20">
        <div className="px-margin-mobile md:px-margin-desktop py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="lg:hidden text-on-surface-variant hover:text-primary transition-colors"
              aria-label="Open menu"
            >
              <span className="material-symbols-outlined text-2xl">menu</span>
            </button>
            <Link href="/team" className="flex items-center gap-2.5 font-headline-md text-headline-md font-bold text-primary shrink-0">
              <img src="/brand/logo.png" alt="Atomic Logo" className="w-8 h-8 rounded-lg object-contain" />
              <span>Atomic Pathshala <span className="text-on-surface-variant font-body-md text-body-md">Team</span></span>
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
        {/* Desktop sidebar */}
        <aside className="hidden lg:block w-64 shrink-0 border-r border-outline-variant/20 bg-surface/60 sticky top-[65px] h-[calc(100vh-65px)] overflow-y-auto">
          <SidebarNav sections={sections} />
        </aside>

        {/* Mobile drawer */}
        {drawerOpen && (
          <div className="lg:hidden fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
            <aside className="absolute inset-y-0 left-0 w-72 bg-surface shadow-xl overflow-y-auto">
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

        <main className="flex-1 min-w-0 px-margin-mobile md:px-margin-desktop py-stack-lg space-y-4">
          {!isRootTeam && (
            <div className="sm:hidden pb-1">
              <OpsBackButton label="Back" fallbackHref="/team" />
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}

function SidebarNav({ sections, onNavigate }: { sections: TeamNavSection[]; onNavigate?: () => void }) {
  const pathname = usePathname();

  const isActive = (href: string) => (href === "/team" ? pathname === "/team" : pathname === href || pathname.startsWith(`${href}/`));

  return (
    <nav className="py-4 px-3 space-y-5">
      {sections.map((section, i) => (
        <div key={section.title ?? i}>
          {section.title && (
            <p className="px-3 mb-1.5 text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">
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
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg font-label-md text-label-md transition-colors ${
                    active
                      ? "bg-primary/10 text-primary font-bold"
                      : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
                  }`}
                >
                  <span className="material-symbols-outlined text-lg">{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      ))}

      <div className="lg:hidden px-3 pt-3 border-t border-outline-variant/20">
        <LogoutButton />
      </div>
    </nav>
  );
}
