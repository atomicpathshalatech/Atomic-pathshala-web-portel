import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { apiError } from "@/lib/api/response";
import { requirePermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { applyModuleBranding, type ModuleBrandingOptions, type RebrandingPreset } from "@/lib/module-studio/rebranding-engine";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return apiError("Authentication required", 401);
    }

    await requirePermission(session.user.id, PERMISSIONS.TEAM_PORTAL_ACCESS);

    const formData = await request.formData();
    const mainPdfFile = formData.get("mainPdf") as File | null;

    if (!mainPdfFile) {
      return apiError("MAIN PDF file is required", 400);
    }

    const subject = (formData.get("subject") as string) || "CHEMISTRY";
    const moduleNumber = (formData.get("moduleNumber") as string) || "Module 01";
    const chapterName = (formData.get("chapterName") as string) || "IUPAC Nomenclature";
    const targetExam = (formData.get("targetExam") as string) || "NEET (UG)";
    const facultyName = (formData.get("facultyName") as string) || "Firoz Sir";
    const batchName = (formData.get("batchName") as string) || "NEET Accelerated Batch";
    const includeCover = formData.get("includeCover") !== "false";
    const removeOldHeader = formData.get("removeOldHeader") !== "false";
    const removeOldFooter = formData.get("removeOldFooter") !== "false";
    const includeWatermark = formData.get("includeWatermark") === "true";
    const watermarkText = (formData.get("watermarkText") as string) || "ATOMIC PATHSHALA";

    const preset: RebrandingPreset =
      subject.toUpperCase().includes("CHEM") ? "CHEMISTRY" :
      subject.toUpperCase().includes("PHYS") ? "PHYSICS" :
      subject.toUpperCase().includes("BIO") ? "BIOLOGY" : "ATOMIC_DEFAULT";

    const mainPdfBuffer = Buffer.from(await mainPdfFile.arrayBuffer());

    const brandingOptions: ModuleBrandingOptions = {
      preset,
      teacherName: facultyName,
      subject,
      batchName,
      chapterName,
      targetExam,
      moduleCode: moduleNumber,
      includeCover,
      removeOldHeader,
      removeOldFooter,
      oldHeaderHeightPt: 44,
      oldFooterHeightPt: 32,
      includeHeader: true,
      includeFooter: true,
      includeWatermark,
      watermarkText,
      watermarkOpacity: 0.05,
    };

    const result = await applyModuleBranding(mainPdfBuffer, brandingOptions);

    return new NextResponse(Buffer.from(result.brandedPdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${chapterName.replace(/[^a-zA-Z0-9_-]/g, "_")}_Atomic_Pathshala.pdf"`,
        "X-Page-Count": String(result.pageCount),
        "X-Preset": result.appliedPreset,
      },
    });
  } catch (err: any) {
    console.error("[rebrand_vector_error]", err);
    return apiError(err.message || "Failed to generate rebranded vector PDF", 500);
  }
}
