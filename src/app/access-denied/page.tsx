import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { LogoutButton } from "@/components/student/LogoutButton";

export const metadata: Metadata = {
  title: "Access — Atomic Pathshala",
};

const CONTACT_LINE =
  "To get access, please contact your Founder, Coordinator, or Administrator.";

function messageFor(status: string, hasRole: boolean): { title: string; body: string } {
  if (!hasRole || status === "NO_ROLE") {
    return {
      title: "You have not been assigned any role in Atomic Pathshala.",
      body: CONTACT_LINE,
    };
  }
  if (status === "PENDING_VERIFICATION" || status === "APPROVAL_PENDING" || status === "INVITED") {
    return {
      title: "Your verification is pending.",
      body: "Please contact your Founder, Coordinator, or Administrator if you need access.",
    };
  }
  if (status === "EX_EDUCATOR" || status === "EX_TEAM_MEMBER") {
    return {
      title: "Your staff access has ended.",
      body:
        "Your profile and history are preserved, but you no longer have access to the team portal. " +
        CONTACT_LINE,
    };
  }
  // SUSPENDED / INACTIVE / EXPIRED
  return {
    title: "Your account access is currently unavailable.",
    body: CONTACT_LINE,
  };
}

export default async function AccessDeniedPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true, status: true, roleId: true, role: { select: { name: true } } },
  });

  // A fully working staff or student account should never see this page —
  // send them where they belong.
  if (user?.role && user.status === "ACTIVE") {
    redirect(user.role.name === "STUDENT" || user.role.name === "PARENT" ? "/dashboard" : "/team");
  }

  const { title, body } = messageFor(user?.status ?? "NO_ROLE", !!user?.roleId);

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
          <span className="material-symbols-outlined text-3xl">lock_person</span>
        </div>
        <h1 className="text-lg font-black text-slate-900">{title}</h1>
        <p className="mt-2 text-sm text-slate-500">{body}</p>

        <div className="mt-6 rounded-xl bg-slate-50 border border-slate-200 p-3 text-left text-xs text-slate-500">
          <p>
            <span className="font-semibold text-slate-700">Signed in as:</span> {user?.name}
          </p>
          <p className="truncate">{user?.email}</p>
          <p className="mt-1">
            <span className="font-semibold text-slate-700">Status:</span>{" "}
            {user?.roleId ? user?.status : "NO_ROLE"}
          </p>
        </div>

        <div className="mt-6">
          <LogoutButton />
        </div>
      </div>
    </main>
  );
}
