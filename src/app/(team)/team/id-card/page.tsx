import type { Metadata } from "next";
import { requireTeamSession } from "@/lib/auth/session";
import { loadTeamCard } from "@/lib/id-card/data";
import { IdCardWorkspace } from "@/components/id-card/IdCardWorkspace";

export const metadata: Metadata = { title: "My ID Card" };
export const dynamic = "force-dynamic";

export default async function TeamIdCardPage() {
  const { user } = await requireTeamSession();
  const loaded = await loadTeamCard(user.id);

  return (
    <div className="space-y-6 max-w-5xl">
      <header>
        <h1 className="font-headline-lg text-headline-lg text-on-surface font-black">My ID Card</h1>
        <p className="text-sm text-on-surface-variant mt-1">Your official Atomic Pathshala team identity card.</p>
      </header>
      {loaded && <IdCardWorkspace loaded={loaded} />}
    </div>
  );
}
