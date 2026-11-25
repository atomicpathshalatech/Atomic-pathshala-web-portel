import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireTeamSession } from "@/lib/auth/session";
import { hasPermission, isSuperAdminUser } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { generateSlug } from "@/lib/teacher/slug";

export async function GET() {
  try {
    const { user } = await requireTeamSession();
    const canManage = (await isSuperAdminUser(user.id)) || (await hasPermission(user.id, PERMISSIONS.SEO_MANAGE));
    if (!canManage) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const teachers = await prisma.teacher.findMany({
      where: {
        onboardingStatus: { not: "REJECTED" },
        user: {
          status: "ACTIVE",
          role: {
            name: { in: ["TEACHER", "ACADEMIC_HEAD", "DEPARTMENT_HEAD", "ADMIN", "FOUNDER"] },
          },
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            photoUrl: true,
            position: true,
          },
        },
        seoProfile: true,
        batchAssignments: {
          select: { batch: { select: { id: true, name: true } } },
        },
        lectures: {
          select: { id: true, title: true },
          take: 5,
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const enriched = teachers.map((t) => {
      const slug = t.seoProfile?.slug || generateSlug(t.user.name);
      const isPublic = t.seoProfile ? t.seoProfile.isPublicProfileEnabled : true;
      const isIndexed = t.seoProfile ? t.seoProfile.isSeoIndexed : true;
      const title = t.seoProfile?.customSeoTitle || `${t.user.name} — ${t.department} Faculty | Atomic Pathshala`;
      const desc = t.seoProfile?.customMetaDescription || t.bio || "";
      const hasKeywords = (t.seoProfile?.targetKeywords?.length || 0) > 0;
      const hasBio = Boolean(t.bio && t.bio.trim().length > 30);
      const hasPhoto = Boolean(t.user.photoUrl);

      // Real completeness score based on actual presence of attributes
      let completeness = 30; // base registered
      if (hasBio) completeness += 25;
      if (hasPhoto) completeness += 15;
      if (hasKeywords) completeness += 15;
      if (t.seoProfile?.customSeoTitle) completeness += 15;

      return {
        id: t.id,
        name: t.user.name,
        email: t.user.email,
        photoUrl: t.user.photoUrl,
        department: t.department,
        subjects: t.subjects,
        targetExams: t.targetExams,
        slug,
        isPublicProfileEnabled: isPublic,
        isSeoIndexed: isIndexed,
        customSeoTitle: t.seoProfile?.customSeoTitle || "",
        customMetaDescription: t.seoProfile?.customMetaDescription || "",
        targetKeywords: t.seoProfile?.targetKeywords || [],
        hindiKeywords: t.seoProfile?.hindiKeywords || [],
        englishKeywords: t.seoProfile?.englishKeywords || [],
        verifiedBio: t.seoProfile?.verifiedBio || t.bio || "",
        teachingPhilosophy: t.seoProfile?.teachingPhilosophy || "",
        canonicalUrl: `https://atomicpathshala.in/teachers/${slug}`,
        completenessScore: Math.min(completeness, 100),
        batchesCount: t.batchAssignments.length,
        lecturesCount: t.lectures.length,
      };
    });

    return NextResponse.json({ teachers: enriched });
  } catch (error: any) {
    console.error("GET /api/team/seo/teachers error:", error);
    return NextResponse.json({ error: error.message || "Failed to load teachers" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireTeamSession();
    const canManage = (await isSuperAdminUser(user.id)) || (await hasPermission(user.id, PERMISSIONS.SEO_MANAGE));
    if (!canManage) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json();
    const {
      teacherId,
      slug,
      isPublicProfileEnabled,
      isSeoIndexed,
      customSeoTitle,
      customMetaDescription,
      targetKeywords,
      hindiKeywords,
      englishKeywords,
      verifiedBio,
      teachingPhilosophy,
    } = body;

    if (!teacherId || !slug) {
      return NextResponse.json({ error: "teacherId and slug are required" }, { status: 400 });
    }

    const cleanSlug = slug.toLowerCase().trim().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");

    const updated = await prisma.teacherSeo.upsert({
      where: { teacherId },
      update: {
        slug: cleanSlug,
        isPublicProfileEnabled: Boolean(isPublicProfileEnabled),
        isSeoIndexed: Boolean(isSeoIndexed),
        customSeoTitle: customSeoTitle || null,
        customMetaDescription: customMetaDescription || null,
        targetKeywords: Array.isArray(targetKeywords) ? targetKeywords : [],
        hindiKeywords: Array.isArray(hindiKeywords) ? hindiKeywords : [],
        englishKeywords: Array.isArray(englishKeywords) ? englishKeywords : [],
        verifiedBio: verifiedBio || null,
        teachingPhilosophy: teachingPhilosophy || null,
        canonicalUrl: `https://atomicpathshala.in/teachers/${cleanSlug}`,
      },
      create: {
        teacherId,
        slug: cleanSlug,
        isPublicProfileEnabled: Boolean(isPublicProfileEnabled),
        isSeoIndexed: Boolean(isSeoIndexed),
        customSeoTitle: customSeoTitle || null,
        customMetaDescription: customMetaDescription || null,
        targetKeywords: Array.isArray(targetKeywords) ? targetKeywords : [],
        hindiKeywords: Array.isArray(hindiKeywords) ? hindiKeywords : [],
        englishKeywords: Array.isArray(englishKeywords) ? englishKeywords : [],
        verifiedBio: verifiedBio || null,
        teachingPhilosophy: teachingPhilosophy || null,
        canonicalUrl: `https://atomicpathshala.in/teachers/${cleanSlug}`,
      },
    });

    return NextResponse.json({ success: true, teacherSeo: updated });
  } catch (error: any) {
    console.error("POST /api/team/seo/teachers error:", error);
    return NextResponse.json({ error: error.message || "Failed to update teacher SEO" }, { status: 500 });
  }
}
