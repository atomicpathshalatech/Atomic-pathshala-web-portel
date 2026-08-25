"use client";

import { useState } from "react";
import Link from "next/link";
import { LogoutButton } from "@/components/student/LogoutButton";

/**
 * Top-right avatar + dropdown, replacing the old always-visible
 * name/role/sign-out row. Only links to routes that actually exist in this
 * app — "My Profile" only shows for users with a Teacher record (same rule
 * the dashboard already used to decide whether /team/profile makes sense
 * for this user), and Sign Out reuses the existing LogoutButton rather than
 * reimplementing its sign-out call.
 */
export function TeamProfileMenu({
  userName,
  userRoleLabel,
  hasTeacherProfile,
}: {
  userName: string;
  userRoleLabel: string;
  hasTeacherProfile: boolean;
}) {
  const [open, setOpen] = useState(false);
  const initial = userName.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2.5 rounded-full pl-1 pr-2 py-1 hover:bg-surface-container-high transition-colors"
      >
        <span className="w-8 h-8 rounded-full bg-primary/15 text-primary font-bold flex items-center justify-center text-sm shrink-0">
          {initial}
        </span>
        <span className="hidden sm:block text-left">
          <span className="block font-label-md text-label-md text-on-surface leading-tight">{userName}</span>
          <span className="block text-label-sm text-on-surface-variant leading-tight">{userRoleLabel}</span>
        </span>
        <span className="material-symbols-outlined text-lg text-on-surface-variant">expand_more</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-56 glass-card rounded-xl py-2 z-50 shadow-lg">
            <div className="px-4 py-2 border-b border-outline-variant/20 sm:hidden">
              <p className="font-label-md text-label-md text-on-surface">{userName}</p>
              <p className="text-label-sm text-on-surface-variant">{userRoleLabel}</p>
            </div>
            {hasTeacherProfile && (
              <Link
                href="/team/profile"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2 text-label-md text-on-surface hover:bg-surface-container-high transition-colors"
              >
                <span className="material-symbols-outlined text-lg text-on-surface-variant">person</span>
                My Profile
              </Link>
            )}
            <div className="px-4 py-2">
              <LogoutButton />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
