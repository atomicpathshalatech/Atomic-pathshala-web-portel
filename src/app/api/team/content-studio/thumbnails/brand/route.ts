import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";

const saveBrandSchema = z.object({
  kind: z.enum(["BRAND_PROFILE", "TEMPLATE"]),
  name: z.string().trim().min(2).max(120),
  logoUrl: z.string().optional(),
  primaryColor: z.string().optional(),
  secondaryColor: z.string().optional(),
  accentColor: z.string().optional(),
  projectType: z.string().optional(),
  width: z.number().int().optional(),
  height: z.number().int().optional(),
  layers: z.array(z.record(z.unknown())).optional(),
});

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_THUMBNAIL);

    let brandProfiles = await prisma.thumbnailBrandProfile.findMany({
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });

    if (brandProfiles.length === 0) {
      const def = await prisma.thumbnailBrandProfile.create({
        data: {
          name: "Atomic Pathshala Official",
          logoUrl: "/atomic-logo.png",
          primaryColor: "#0050cb",
          secondaryColor: "#00ccf9",
          accentColor: "#f97316",
          fonts: ["Inter", "Geist", "Impact"],
          isDefault: true,
        },
      });
      brandProfiles = [def];
    }

    const [templates, teachers] = await Promise.all([
      prisma.thumbnailTemplate.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
      prisma.teacher.findMany({
        select: {
          id: true,
          displayName: true,
          creativePngUrl: true,
        },
        take: 30,
      }),
    ]);

    return apiSuccess({
      brandProfiles,
      templates,
      teachers: teachers.map((t) => ({
        id: t.id,
        name: t.displayName || "Teacher",
        imageUrl: t.creativePngUrl || null,
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_THUMBNAIL);

    const body = saveBrandSchema.parse(await req.json());

    if (body.kind === "TEMPLATE") {
      const template = await prisma.thumbnailTemplate.create({
        data: {
          name: body.name,
          projectType: body.projectType || "LECTURE",
          width: body.width || 1280,
          height: body.height || 720,
          layers: (body.layers || []) as Prisma.InputJsonValue,
          createdById: session.user.id,
        },
      });
      return apiSuccess({ template }, 201);
    }

    const brandProfile = await prisma.thumbnailBrandProfile.create({
      data: {
        name: body.name,
        logoUrl: body.logoUrl || "/atomic-logo.png",
        primaryColor: body.primaryColor || "#0050cb",
        secondaryColor: body.secondaryColor || "#00ccf9",
        accentColor: body.accentColor || "#f97316",
        createdById: session.user.id,
      },
    });
    return apiSuccess({ brandProfile }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
