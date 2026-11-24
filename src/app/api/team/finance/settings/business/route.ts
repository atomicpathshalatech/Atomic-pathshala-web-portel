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

    let profile = await prisma.businessProfile.findFirst({
      orderBy: { createdAt: "desc" },
    });

    if (!profile) {
      // Create default profile
      profile = await prisma.businessProfile.create({
        data: {
          legalName: "Atomic Pathshala Education Private Limited",
          tradeName: "Atomic Pathshala",
          businessType: "PROPRIETORSHIP",
          registeredAddress: "Civil Lines, Rampur, Uttar Pradesh - 244901",
          state: "Uttar Pradesh",
          stateCode: "09",
          pincode: "244901",
          contactEmail: "admin@atomicpathshala.com",
          contactPhone: "+91 9876543210",
          businessPanMasked: "•••••4582E",
          website: "https://atomicpathshala.com",
        },
      });
    }

    return apiSuccess({ profile });
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
      legalName,
      tradeName,
      businessType,
      registeredAddress,
      state,
      stateCode,
      pincode,
      contactEmail,
      contactPhone,
      businessPan,
      logoUrl,
      website,
    } = body;

    // Mask PAN for safe storage & presentation
    let panMasked: string | undefined = undefined;
    if (businessPan && businessPan.length === 10) {
      panMasked = `•••••${businessPan.slice(5)}`;
    }

    const existing = await prisma.businessProfile.findFirst({
      orderBy: { createdAt: "desc" },
    });

    let profile;
    if (existing) {
      profile = await prisma.businessProfile.update({
        where: { id: existing.id },
        data: {
          legalName,
          tradeName,
          businessType,
          registeredAddress,
          state,
          stateCode,
          pincode,
          contactEmail,
          contactPhone,
          ...(panMasked ? { businessPanMasked: panMasked } : {}),
          logoUrl,
          website,
        },
      });
    } else {
      profile = await prisma.businessProfile.create({
        data: {
          legalName: legalName || "Atomic Pathshala",
          tradeName: tradeName || "Atomic Pathshala",
          businessType: businessType || "PROPRIETORSHIP",
          registeredAddress: registeredAddress || "",
          state: state || "Uttar Pradesh",
          stateCode: stateCode || "09",
          pincode,
          contactEmail: contactEmail || "admin@atomicpathshala.com",
          contactPhone: contactPhone || "",
          businessPanMasked: panMasked || "•••••1234A",
          logoUrl,
          website: website || "https://atomicpathshala.com",
          createdById: session.user.id,
        },
      });
    }

    return apiSuccess({ profile, message: "Business profile updated successfully" });
  } catch (error) {
    return handleApiError(error);
  }
}
