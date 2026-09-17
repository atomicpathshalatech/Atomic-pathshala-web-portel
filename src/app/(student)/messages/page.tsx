import type { Metadata } from "next";
import { requireStudentSession } from "@/lib/auth/session";
import { getConversationsForUser } from "@/lib/messages/messaging-service";
import { StudentMessagesConsole } from "@/components/student/StudentMessagesConsole";

export const metadata: Metadata = {
  title: "Messages & Inbox | Atomic Pathshala",
};

export default async function StudentMessagesPage() {
  const { student } = await requireStudentSession();

  const initialConversations = await getConversationsForUser(student.userId, "STUDENT");

  return (
    <div className="w-full">
      <StudentMessagesConsole
        initialConversations={initialConversations}
        currentUserId={student.userId}
      />
    </div>
  );
}
