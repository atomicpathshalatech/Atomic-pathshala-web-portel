import type { User, UserProfile } from "@prisma/client";
import type { StudentProfile } from "@/types/ai-chat";

/**
 * Trimmed port of `_import_atomic-ai-chat`'s `auth-utils.ts`. Everything
 * else in that file (hashPassword/comparePassword/hashToken/
 * createSecureToken/isAdminEmail/roleForNewUser/isProRole/nextAtomicId) only
 * served the source app's own credentials-auth + signup + atomicId flows,
 * all of which are dropped since AI Chat authenticates through atomic-ops's
 * existing User instead. Only the two functions with other real call sites
 * (api/profile) survive, adapted to atomic-ops's field names:
 *  - no `atomicId`/`role`(string)/`isPro`/`image` on User — replaced with
 *    `photoUrl` for avatar and dropped role/isPro from the public payload
 *    (callers should read Pro status from UserAccess/hasActiveSubscription
 *    instead, see access.ts).
 *  - takes the profile relation as a parameter instead of reading
 *    `user.profile`, since that relation is named `aiChatProfile` on
 *    atomic-ops's User (renamed to avoid colliding with the Student/Course
 *    "profile" concepts already in the schema).
 */

export function userToStudentProfile(
  user: Pick<User, "name">,
  profile?: Pick<UserProfile, "className" | "target" | "board" | "preferredLanguage"> | null
): StudentProfile {
  const language = profile?.preferredLanguage;

  return {
    name: user.name ?? undefined,
    className: profile?.className ?? undefined,
    target:
      profile?.target === "JEE" || profile?.target === "Board" || profile?.target === "Other"
        ? profile.target
        : "NEET",
    board: profile?.board ?? undefined,
    language:
      language === "english" || language === "hindi" || language === "hinglish"
        ? language
        : "hinglish",
  };
}

export function publicUser(user: Pick<User, "id" | "email" | "name" | "photoUrl">) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.photoUrl ?? null,
  };
}
