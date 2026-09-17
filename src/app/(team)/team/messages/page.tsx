import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireTeamSession } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { getConversationsForUser } from "@/lib/messages/messaging-service";
import { TeamMessagesConsole } from "@/components/team-portal/TeamMessagesConsole";

export const metadata: Metadata = {
  title: "Messages & Inbox | Team Portal",
};

export default async function TeamMessagesPage() {
  const { user, permissions } = await requireTeamSession();

  if (!permissions.has(PERMISSIONS.MESSAGE_READ)) {
    redirect("/team");
  }

  const roleName = user.role?.name || "STAFF";
  const initialConversations = await getConversationsForUser(user.id, roleName);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <TeamMessagesConsole
        initialConversations={initialConversations}
        currentUserId={user.id}
        currentUserRole={roleName}
      />
    </div>
  );
}
