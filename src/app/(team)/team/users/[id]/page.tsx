import type { Metadata } from "next";
import { UserDetailEffectiveAccessView } from "@/components/team-portal/UserDetailEffectiveAccessView";

export const metadata: Metadata = {
  title: "User Profile & Effective Permissions — Atomic OPS",
};

export default async function TeamUserDetailPage({
  params,
}: {
  params: { id: string } | Promise<{ id: string }>;
}) {
  const resolved = await Promise.resolve(params);
  const userId = resolved?.id;

  return <UserDetailEffectiveAccessView userId={userId} />;
}
