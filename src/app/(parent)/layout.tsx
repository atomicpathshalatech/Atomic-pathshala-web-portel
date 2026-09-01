import { ReactNode } from "react";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/student/LogoutButton";

export default async function ParentLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-background text-on-surface flex flex-col font-sans">
      {/* Parent Navbar */}
      <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur border-b border-outline-variant/20 px-4 md:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/parent/dashboard" className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-2xl">family_restroom</span>
            <span className="font-headline-md text-headline-md font-bold text-on-surface">
              Atomic Parent Portal
            </span>
          </Link>
          <span className="hidden sm:inline-block text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
            Guardian Access
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold text-on-surface">{session.user.name}</p>
            <p className="text-[10px] text-on-surface-variant">Guardian / Parent</p>
          </div>
          <LogoutButton />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8">{children}</main>

      {/* Footer */}
      <footer className="border-t border-outline-variant/10 py-6 text-center text-xs text-on-surface-variant">
        Atomic Pathshala Education &middot; Student Academic Progress & Guardian Monitoring System
      </footer>
    </div>
  );
}
