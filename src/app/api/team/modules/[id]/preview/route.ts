import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { handleApiError } from "@/lib/api/response";
import { MODULE_THEMES, moduleElementSchema } from "@/lib/validation/module";
import { buildPremiumModuleHtml } from "@/lib/module-studio/premium-html";

/** The premium design as an HTML page, for the editor's live preview. */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.MODULE_READ);

    const moduleRow = await prisma.module.findUnique({
      where: { id: params.id },
      include: { brandProfile: true, pages: { orderBy: { pageNumber: "asc" } } },
    });
    if (!moduleRow) return new NextResponse("Module not found", { status: 404 });

    const themeParam = request.nextUrl.searchParams.get("theme");
    const theme = (MODULE_THEMES as readonly string[]).includes(themeParam ?? "") ? (themeParam as (typeof MODULE_THEMES)[number]) : undefined;
    const brand = moduleRow.brandProfile;
    const html = buildPremiumModuleHtml({
      title: moduleRow.title,
      subject: moduleRow.subject,
      chapter: moduleRow.chapter,
      className: moduleRow.class,
      facultyName: moduleRow.facultyName,
      academicYear: moduleRow.academicYear,
      theme,
      watermark: request.nextUrl.searchParams.get("watermark") === "1",
      brand: brand ? { name: brand.name, logoUrl: brand.logoUrl, tagline: brand.tagline, websiteUrl: brand.websiteUrl } : null,
      pages: moduleRow.pages.map((p) => ({
        pageNumber: p.pageNumber,
        elements: z.array(moduleElementSchema).catch([]).parse(p.elements),
      })),
    });
    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
  } catch (error) {
    return handleApiError(error);
  }
}
