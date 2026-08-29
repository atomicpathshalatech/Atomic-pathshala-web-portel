import { SettingsScreen } from "@/components/ai-chat/SettingsScreen";

// Source wrapped this in its own <AuthProvider>; the guru layout already
// provides AiChatUserProvider for the whole route group, so no wrapper
// is needed here.
export default function GuruSettingsPage() {
  return <SettingsScreen />;
}
