import type { Metadata } from "next";
import { requireStudentSession } from "@/lib/auth/session";
import { LogoutButton } from "@/components/student/LogoutButton";
import { ProfilePhotoUploader } from "@/components/student/ProfilePhotoUploader";

export const metadata: Metadata = {
  title: "Settings",
};

/**
 * Deliberately minimal — read-only account info plus sign-out, plus the
 * profile photo uploader. The mockup had toggles for notification
 * preferences, theme, language, etc., but none of those are backed by a
 * schema field, so rather than build UI that looks functional but does
 * nothing on save, we're shipping just what's real. Preference toggles can
 * be added here once there's a place to persist them.
 */
export default async function SettingsPage() {
  const { session, student } = await requireStudentSession();

  return (
    <div className="space-y-stack-lg max-w-2xl">
      <header>
        <h1 className="font-display-lg text-display-lg-mobile md:text-display-lg text-on-surface">Settings</h1>
        <p className="text-body-lg text-on-surface-variant mt-2">Your account details.</p>
      </header>

      <div className="glass-card rounded-2xl p-5">
        <ProfilePhotoUploader initialPhotoUrl={student.user.photoUrl} name={session.user.name ?? ""} />
      </div>

      <div className="glass-card rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between gap-4 py-2 border-b border-outline-variant/20">
          <span className="text-label-md text-on-surface-variant">Name</span>
          <span className="text-body-md text-on-surface text-right">{session.user.name}</span>
        </div>
        <div className="flex items-center justify-between gap-4 py-2 border-b border-outline-variant/20">
          <span className="text-label-md text-on-surface-variant">Email</span>
          <span className="text-body-md text-on-surface text-right truncate">{session.user.email}</span>
        </div>
        <div className="flex items-center justify-between gap-4 py-2 border-b border-outline-variant/20">
          <span className="text-label-md text-on-surface-variant">Student ID</span>
          <span className="text-body-md text-on-surface text-right">{student.studentIdCode}</span>
        </div>
        <div className="flex items-center justify-between gap-4 py-2">
          <span className="text-label-md text-on-surface-variant">Enrollment Number</span>
          <span className="text-body-md text-on-surface text-right">{student.enrollmentNumber || "—"}</span>
        </div>
      </div>

      <div className="glass-card rounded-xl p-4 flex items-start gap-3 border-l-4 border-l-secondary">
        <span className="material-symbols-outlined text-secondary shrink-0">info</span>
        <p className="text-body-sm text-on-surface-variant">
          To update your name, email or other account details, please contact your batch coordinator —
          self-service editing isn&apos;t available for those yet. Your profile photo above can be changed anytime.
        </p>
      </div>

      <div className="glass-card rounded-2xl p-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface">Sign Out</h2>
          <p className="text-body-sm text-on-surface-variant">You&apos;ll need to log in again to access your account.</p>
        </div>
        <LogoutButton />
      </div>
    </div>
  );
}
