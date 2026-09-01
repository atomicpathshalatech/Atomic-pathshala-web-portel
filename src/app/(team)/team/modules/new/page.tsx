import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { ModuleUploadForm } from "@/components/team-portal/ModuleUploadForm";

export const metadata: Metadata = { title: "Upload Module" };

export default async function NewModulePage() {
  const brandProfiles = await prisma.brandProfile.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });

  return (
    <div className="space-y-stack-lg max-w-6xl">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Upload Module</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Upload a source PDF — you&apos;ll run extraction and review the structured content next.
        </p>
      </div>
      <ModuleUploadForm brandProfiles={brandProfiles} />
    </div>
  );
}
