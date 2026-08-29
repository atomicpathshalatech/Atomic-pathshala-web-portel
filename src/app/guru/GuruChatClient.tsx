"use client";

import { signOut } from "next-auth/react";
import { ChatApp } from "@/components/ai-chat/ChatApp";
import type { StudentProfile } from "@/types/ai-chat";

/**
 * Thin client wrapper so the server page (page.tsx) can pass
 * server-fetched studentProfile/userName/userEmail into ChatApp while
 * still supplying a real sign-out handler. Source's onSignOut called its
 * own AuthProvider's signOut(); atomic-ops already provides a NextAuth
 * SessionProvider at the root layout, so this just calls next-auth's
 * signOut() directly.
 */
export function GuruChatClient({
  studentProfile,
  userName,
  userEmail,
}: {
  studentProfile: StudentProfile;
  userName: string | null;
  userEmail: string | null;
}) {
  return (
    <ChatApp
      studentProfile={studentProfile}
      userName={userName ?? undefined}
      userEmail={userEmail ?? undefined}
      onSignOut={() => void signOut({ callbackUrl: "/login" })}
    />
  );
}
