"use client";

import { signOut } from "next-auth/react";

export function LogoutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/" })}
      className="font-label-md text-label-md text-on-surface-variant hover:text-error transition-colors flex items-center gap-2"
    >
      <span className="material-symbols-outlined text-lg">logout</span>
      Log out
    </button>
  );
}
