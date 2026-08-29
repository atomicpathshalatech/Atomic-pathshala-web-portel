import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { buildAiChatUser } from "@/lib/ai-chat/user-context";
import { AiChatUserProvider } from "@/components/ai-chat/AiChatUserContext";
import { ThemeProvider } from "@/components/ai-chat/ThemeProvider";
import { ServiceWorkerRegister } from "@/components/ai-chat/ServiceWorkerRegister";

/**
 * Server layout for the AI Chat ("Atomic Guru") feature, mounted under
 * atomic-ops at /guru. Replaces the source app's own root layout.tsx
 * (which had its own <html>/<body>, font, and manifest — inappropriate
 * here since it's a section of the existing site, not a standalone app)
 * and its client-side AuthGate/AuthProvider session handling.
 *
 * Session + AI-Chat-specific permission flags are resolved once, here,
 * server-side (matching src/app/(team)/team/layout.tsx's convention) and
 * handed down through AiChatUserProvider; every ported component reads
 * them via useAiChatUser() instead of the source's useAuth().
 *
 * The `ai-chat-scope` class scopes this feature's custom CSS (see
 * globals.css) so it never leaks into the rest of atomic-ops.
 */
export const metadata: Metadata = {
  title: "Atomic Guru | Atomic Pathshala",
  description:
    "Solve academic doubts instantly in English, Hindi, or Hinglish. Upload images, PDFs, screenshots, and camera photos for step-by-step AI explanations.",
};

export default async function GuruLayout({ children }: { children: React.ReactNode }) {
  const user = await buildAiChatUser();
  if (!user) redirect("/login");

  return (
    <div className="ai-chat-scope">
      <ServiceWorkerRegister />
      <ThemeProvider>
        <AiChatUserProvider user={user}>{children}</AiChatUserProvider>
      </ThemeProvider>
    </div>
  );
}
