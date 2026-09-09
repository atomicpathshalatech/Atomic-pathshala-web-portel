import type { Metadata } from "next";
import { StaffRegistrationForm } from "@/components/auth/StaffRegistrationForm";

export const metadata: Metadata = {
  title: "Join Atomic Pathshala",
};

export default function StaffInvitePage({ params }: { params: { token: string } }) {
  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6">
      <StaffRegistrationForm token={params.token} />
    </main>
  );
}
