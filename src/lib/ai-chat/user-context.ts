import "server-only";
import { getCurrentUser } from "@/lib/ai-chat/auth";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import type { AiChatUser } from "@/components/ai-chat/AiChatUserContext";

/**
 * Server-side counterpart to `AiChatUserContext` — call this from whichever
 * server layout mounts the AI Chat UI (e.g. the `guru` route group's
 * `layout.tsx`) and pass the result into `<AiChatUserProvider user={...}>`.
 * Returns null when signed out; the layout should redirect to atomic-ops's
 * own login in that case rather than rendering the source app's dropped
 * AuthScreen.
 */
export async function buildAiChatUser(): Promise<AiChatUser | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const [isAdmin, isScheduleManager, isQuestionBankViewer] = await Promise.all([
    hasPermission(user.id, PERMISSIONS.AICHAT_ADMIN_ACCESS),
    hasPermission(user.id, PERMISSIONS.AICHAT_SCHEDULE_MANAGE),
    hasPermission(user.id, PERMISSIONS.AICHAT_QUESTION_BANK_VIEW),
  ]);

  return {
    id: user.id,
    name: user.name ?? null,
    email: user.email ?? null,
    image: user.image ?? null,
    isAdmin,
    isScheduleManager,
    isQuestionBankViewer,
  };
}
