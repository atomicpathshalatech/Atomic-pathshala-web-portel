import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ModuleDesignClient } from "@/components/team-portal/design/ModuleDesignClient";

export const metadata: Metadata = { title: "Module design" };

/** Design Studio: templates, theme, page setup and print/digital export for a module's blocks. */
export default async function ModuleDesignPage({ params }: { params: { id: string } }) {
  const exists = await prisma.module.count({ where: { id: params.id } });
  if (exists === 0) notFound();
  return <ModuleDesignClient moduleId={params.id} />;
}
