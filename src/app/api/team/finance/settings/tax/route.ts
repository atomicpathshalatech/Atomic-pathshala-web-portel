import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.FINANCE_READ);

    let gstSetting = await prisma.gstSetting.findFirst({
      orderBy: { createdAt: "desc" },
    });

    if (!gstSetting) {
      gstSetting = await prisma.gstSetting.create({
        data: {
          registrationStatus: "PENDING",
          gstState: "Uttar Pradesh",
          gstStateCode: "09",
          taxpayerType: "REGULAR",
          gstScheme: "FORWARD_CHARGE",
          invoicePrefix: "INV",
          creditNotePrefix: "CN",
          currentFinancialYear: "2026-27",
          nextInvoiceSequence: 1,
          nextCreditNoteSequence: 1,
          taxCalculationMode: "EXCLUSIVE",
          isVerified: false,
          notes: "Initial registration pending with GST Department. GST collection currently locked.",
        },
      });
    }

    const taxRules = await prisma.taxRule.findMany({
      orderBy: { createdAt: "desc" },
    });

    return apiSuccess({ gstSetting, taxRules });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.FINANCE_GST_MANAGE);

    const body = await request.json();
    const {
      registrationStatus,
      gstin,
      registrationDate,
      effectiveDate,
      gstState,
      gstStateCode,
      taxpayerType,
      gstScheme,
      invoicePrefix,
      creditNotePrefix,
      currentFinancialYear,
      taxCalculationMode,
      isVerified,
      certificateUrl,
      notes,
    } = body;

    // Safety validation: If activating GST, GSTIN and Effective Date are required!
    if (registrationStatus === "ACTIVE") {
      if (!gstin || gstin.trim().length !== 15) {
        return handleApiError(new Error("A valid 15-character GSTIN is required to set registration status to ACTIVE"));
      }
      if (!effectiveDate) {
        return handleApiError(new Error("An Effective Date is required to activate GST collection"));
      }
    }

    const existing = await prisma.gstSetting.findFirst({
      orderBy: { createdAt: "desc" },
    });

    let gstSetting;
    if (existing) {
      gstSetting = await prisma.gstSetting.update({
        where: { id: existing.id },
        data: {
          registrationStatus,
          gstin,
          registrationDate: registrationDate ? new Date(registrationDate) : undefined,
          effectiveDate: effectiveDate ? new Date(effectiveDate) : undefined,
          gstState,
          gstStateCode,
          taxpayerType,
          gstScheme,
          invoicePrefix,
          creditNotePrefix,
          currentFinancialYear,
          taxCalculationMode,
          isVerified: Boolean(isVerified),
          certificateUrl,
          notes,
          updatedById: session.user.id,
        },
      });
    } else {
      gstSetting = await prisma.gstSetting.create({
        data: {
          registrationStatus: registrationStatus || "PENDING",
          gstin,
          registrationDate: registrationDate ? new Date(registrationDate) : undefined,
          effectiveDate: effectiveDate ? new Date(effectiveDate) : undefined,
          gstState: gstState || "Uttar Pradesh",
          gstStateCode: gstStateCode || "09",
          taxpayerType: taxpayerType || "REGULAR",
          gstScheme: gstScheme || "FORWARD_CHARGE",
          invoicePrefix: invoicePrefix || "INV",
          creditNotePrefix: creditNotePrefix || "CN",
          currentFinancialYear: currentFinancialYear || "2026-27",
          taxCalculationMode: taxCalculationMode || "EXCLUSIVE",
          isVerified: Boolean(isVerified),
          certificateUrl,
          notes,
          updatedById: session.user.id,
        },
      });
    }

    return apiSuccess({ gstSetting, message: "GST & Tax Configuration updated successfully" });
  } catch (error) {
    return handleApiError(error);
  }
}
