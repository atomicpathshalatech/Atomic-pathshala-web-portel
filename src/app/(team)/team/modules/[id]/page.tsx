import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ModuleEditor } from "@/components/team-portal/ModuleEditor";

export const metadata: Metadata = { title: "Module" };

export default async function ModuleDetailPage({ params }: { params: { id: string } }) {
  const exists = await prisma.module.count({ where: { id: params.id } });
  if (exists === 0) notFound();

  return (
    <div className="max-w-6xl">
      <ModuleEditor moduleId={params.id} />
    </div>
  );
}
