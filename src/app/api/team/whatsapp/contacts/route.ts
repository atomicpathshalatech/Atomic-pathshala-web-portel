import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { sanitizeIndianPhoneNumber } from "@/lib/whatsapp/provider";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.WHATSAPP_READ);

    const searchParams = req.nextUrl.searchParams;
    const search = searchParams.get("search")?.trim();
    const tag = searchParams.get("tag")?.trim();
    const batchId = searchParams.get("batchId")?.trim();
    const source = searchParams.get("source")?.trim();
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
    const skip = (page - 1) * limit;

    const where: Prisma.WhatsAppContactWhereInput = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
        { cleanPhone: { contains: search } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    if (tag) {
      where.tags = { has: tag };
    }

    if (batchId) {
      where.batchId = batchId;
    }

    if (source) {
      where.source = source as any;
    }

    const [contacts, total] = await Promise.all([
      prisma.whatsAppContact.findMany({
        where,
        include: {
          batch: { select: { id: true, name: true, code: true } },
          student: { include: { user: { select: { name: true, email: true } } } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.whatsAppContact.count({ where }),
    ]);

    return apiSuccess({
      contacts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.WHATSAPP_CONTACT_MANAGE);

    const body = await req.json();
    const { name, phone, email, tags, batchId } = body;

    if (!phone || typeof phone !== "string") {
      return apiError("Valid phone number is required", 400);
    }

    const { isValid, cleanPhone, formattedE164 } = sanitizeIndianPhoneNumber(phone);
    if (!isValid) {
      return apiError("Please enter a valid 10-digit Indian phone number (+91)", 400);
    }

    const existing = await prisma.whatsAppContact.findUnique({
      where: { phone: formattedE164 },
    });

    if (existing) {
      return apiError("A contact with this phone number already exists", 409);
    }

    const contact = await prisma.whatsAppContact.create({
      data: {
        name: (name || "Contact").trim(),
        phone: formattedE164,
        cleanPhone,
        email: email?.trim() || null,
        tags: Array.isArray(tags) ? tags.map((t: string) => t.trim()).filter(Boolean) : [],
        batchId: batchId || null,
        source: "MANUAL",
      },
      include: {
        batch: { select: { id: true, name: true } },
      },
    });

    return apiSuccess({ contact }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
