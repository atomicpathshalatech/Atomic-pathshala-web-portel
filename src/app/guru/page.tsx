import { requireCurrentUser } from "@/lib/ai-chat/auth";
import { getPrisma } from "@/lib/ai-chat/prisma";
import { userToStudentProfile } from "@/lib/ai-chat/profile-utils";
import { GuruChatClient } from "./GuruChatClient";

/**
 * The chat screen — source's app/chat/page.tsx (behind its own client-side
 * AuthGate). This route group's layout already redirects signed-out
 * visitors to /login, so this page can go straight to rendering.
 *
 * Source also had a separate app/page.tsx "launcher" screen (a grid of
 * cards linking to /chat, /quiz, /board-exam, /schedule, /dashboard,
 * /admin/question-bank) sitting in front of the chat screen. That's
 * redundant here: Sidebar.tsx already surfaces every one of those links
 * inside the chat screen itself, so /guru goes directly to chat instead
 * of an extra launcher page — a deliberate, low-stakes simplification.
 */
export default async function GuruChatPage() {
  const sessionUser = await requireCurrentUser();
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    include: { aiChatProfile: true },
  });
  if (!user) {
    // Should be unreachable: the layout already confirmed a valid session.
    throw new Error("Signed-in user not found.");
  }

  const studentProfile = userToStudentProfile(user, user.aiChatProfile);

  return (
    <GuruChatClient
      studentProfile={studentProfile}
      userName={user.name}
      userEmail={user.email}
    />
  );
}
