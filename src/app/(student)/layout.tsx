import Link from "next/link";
import { requireStudentSession } from "@/lib/auth/session";
import { LogoutButton } from "@/components/student/LogoutButton";

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: "space_dashboard" },
  { href: "/courses", label: "Courses", icon: "video_library" },
  { href: "/tests", label: "Test Series", icon: "quiz" },
  { href: "/dpp", label: "DPP", icon: "history_edu" },
  { href: "/doubts", label: "Ask a Doubt", icon: "live_help" },
  { href: "/schedule", label: "Schedule", icon: "calendar_month" },
  { href: "/subscription", label: "Subscription", icon: "workspace_premium" },
  { href: "/notifications", label: "Notifications", icon: "notifications" },
  { href: "/id-card", label: "ID Card", icon: "badge" },
];

export default async function StudentPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { student } = await requireStudentSession();

  return (
    <div className="min-h-screen bg-surface-container-low/30">
      <nav className="sticky top-0 z-50 bg-surface/90 backdrop-blur-md border-b border-outline-variant/20">
        <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-4 flex items-center justify-between gap-6">
          <Link href="/" className="font-headline-md text-headline-md font-bold text-primary shrink-0">
            Atomic Pathshala
          </Link>

          <div className="hidden md:flex items-center gap-1 flex-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-label-md text-label-md text-on-surface-variant hover:bg-primary/5 hover:text-primary transition-colors"
              >
                <span className="material-symbols-outlined text-lg">{link.icon}</span>
                {link.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <span className="hidden sm:block font-label-md text-label-md text-on-surface">
              {student.user.name}
            </span>
            <LogoutButton />
          </div>
        </div>

        {/* Mobile nav */}
        <div className="md:hidden flex items-center gap-1 px-margin-mobile pb-3 overflow-x-auto">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-label-sm text-label-sm text-on-surface-variant hover:bg-primary/5 hover:text-primary transition-colors whitespace-nowrap"
            >
              <span className="material-symbols-outlined text-base">{link.icon}</span>
              {link.label}
            </Link>
          ))}
        </div>
      </nav>

      <main className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-stack-lg">
        {children}
      </main>
    </div>
  );
}
