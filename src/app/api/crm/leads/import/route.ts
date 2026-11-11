import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { createLead } from "@/lib/crm/crm-service";
import { CRMLeadSource } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.LEAD_CREATE);

    const formData = await req.formData();
    const file = formData.get("file") as File;
    if (!file) return apiError("CSV file is required", 400);

    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
    if (lines.length < 2) return apiError("CSV file is empty or missing data rows", 400);

    const header = lines[0].split(",").map((h) => h.replace(/^["']|["']$/g, "").trim().toLowerCase());
    const nameIdx = header.findIndex((h) => h.includes("name"));
    const phoneIdx = header.findIndex((h) => h.includes("phone") || h.includes("mobile"));
    const emailIdx = header.findIndex((h) => h.includes("email"));
    const examIdx = header.findIndex((h) => h.includes("exam"));
    const classIdx = header.findIndex((h) => h.includes("class"));
    const cityIdx = header.findIndex((h) => h.includes("city"));

    if (phoneIdx === -1) {
      return apiError("CSV must contain a 'phone' or 'mobile' column", 400);
    }

    let importedCount = 0;
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(",").map((p) => p.replace(/^["']|["']$/g, "").trim());
      const rawPhone = parts[phoneIdx];
      if (!rawPhone || rawPhone.length < 8) continue;

      const name = nameIdx !== -1 && parts[nameIdx] ? parts[nameIdx] : `Lead ${i}`;
      const email = emailIdx !== -1 && parts[emailIdx] ? parts[emailIdx] : undefined;
      const targetExam = examIdx !== -1 && parts[examIdx] ? parts[examIdx] : "NEET";
      const studentClass = classIdx !== -1 && parts[classIdx] ? parts[classIdx] : "Class 12";
      const city = cityIdx !== -1 && parts[cityIdx] ? parts[cityIdx] : undefined;

      try {
        await createLead(
          {
            name,
            phone: rawPhone,
            email,
            targetExam,
            studentClass,
            city,
            source: CRMLeadSource.CSV_IMPORT,
          },
          session.user.id
        );
        importedCount++;
      } catch (err: any) {
        errors.push(`Row ${i} (${name}): ${err.message}`);
      }
    }

    return apiSuccess({
      message: `Successfully imported ${importedCount} leads.`,
      importedCount,
      errors: errors.slice(0, 10),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
