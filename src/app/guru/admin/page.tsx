import { redirect } from "next/navigation";
import { buildAiChatUser } from "@/lib/ai-chat/user-context";
import { AdminDashboard } from "@/components/ai-chat/AdminDashboard";

// Source relied entirely on its API routes' own 401/403 responses to keep
// non-admins out (the page itself rendered unconditionally). Since we
// already have the permission flag on hand server-side here, redirecting
// non-admins straight to the chat screen is a small, low-stakes UX
// improvement over letting them load a dashboard full of failed fetches.
export default async function GuruAdminPage() {
  const user = await buildAiChatUser();
  if (!user?.isAdmin) redirect("/guru");

  return <AdminDashboard />;
}
