"use client";

import { createContext, useContext, type ReactNode } from "react";

export interface AiChatUser {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  isAdmin: boolean;
  isScheduleManager: boolean;
  isQuestionBankViewer: boolean;
}

interface AiChatUserContextValue {
  user: AiChatUser;
  loading: false;
}

const AiChatUserContext = createContext<AiChatUserContextValue | null>(null);

/**
 * Drop-in replacement for the source app's own client-side `AuthProvider`
 * (`_import_atomic-ai-chat/src/components/AuthProvider.tsx`) — that
 * component ran its own NextAuth session/signIn/signup flow, which is not
 * wired up per the integration decision to reuse atomic-ops's existing
 * login. Its `useAuth()` hook is replaced by `useAiChatUser()` below.
 *
 * The user value is fetched once server-side (see
 * `src/lib/ai-chat/user-context.ts`'s `buildAiChatUser()`) and handed down
 * through this context by whichever server layout mounts the AI Chat UI —
 * matching this codebase's existing convention (see
 * `src/components/team-portal/TeamShell.tsx`) of doing session/permission
 * lookups in the server layout, not client-side. Because the value is
 * always present on first render, `loading` is always `false` — kept in the
 * shape only so ported components' existing `if (loading) ...` branches
 * keep compiling.
 */
export function AiChatUserProvider({
  user,
  children,
}: {
  user: AiChatUser;
  children: ReactNode;
}) {
  return (
    <AiChatUserContext.Provider value={{ user, loading: false }}>
      {children}
    </AiChatUserContext.Provider>
  );
}

export function useAiChatUser() {
  const ctx = useContext(AiChatUserContext);
  if (!ctx) {
    throw new Error("useAiChatUser must be used within AiChatUserProvider");
  }
  return ctx;
}
