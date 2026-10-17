import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { ModuleBlocksClient } from "@/components/team-portal/ModuleBlocksClient";

export const metadata: Metadata = { title: "Module blocks" };

/** The block editor: PDF import (extraction, OCR, retry, report) and editable blocks. */
export default async function ModuleBlocksPage({ params }: { params: { id: string } }) {
  const exists = await prisma.module.count({ where: { id: params.id } });
  if (exists === 0) notFound();
  return <ModuleBlocksClient moduleId={params.id} />;
}
