import type { Metadata } from "next";
import { requireTeamSession } from "@/lib/auth/session";
import { hasPermission, isSuperAdminUser } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { prisma } from "@/lib/db";
import { getSeoGlobalSettings } from "@/lib/seo/settings";
import { generateSlug } from "@/lib/teacher/slug";
import { SuperAdminOnlyNotice } from "@/components/team-portal/SuperAdminOnlyNotice";
import { AdminSeoManagerClient } from "@/components/seo/AdminSeoManagerClient";

export const metadata: Metadata = { title: "SEO Manager — Search & Visibility Engine" };

export default async function TeamSeoManagerPage() {
  const { user } = await requireTeamSession();
  const isSuper = (await isSuperAdminUser(user.id)) || (await hasPermission(user.id, PERMISSIONS.SEO_MANAGE));

  if (!isSuper) {
    return <SuperAdminOnlyNotice />;
  }

  const [
    settings,
    teachers,
    keywords,
    articles,
    issues,
    verifiedPyqCount,
    batchesCount,
  ] = await Promise.all([
    getSeoGlobalSettings(),
    prisma.teacher.findMany({
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
        user: { select: { id: true, name: true, email: true, photoUrl: true } },
        seoProfile: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.seoKeyword.findMany({ orderBy: [{ cluster: "asc" }, { priority: "asc" }] }),
    prisma.seoContentArticle.findMany({ orderBy: { updatedAt: "desc" } }),
    prisma.seoAuditIssue.findMany({ orderBy: [{ severity: "asc" }, { lastDetectedAt: "desc" }] }),
    prisma.pyqOccurrence.count({ where: { verificationStatus: "VERIFIED" } }),
    prisma.batch.count({ where: { status: "ACTIVE" } }),
  ]);

  const teacherItems = teachers.map((t) => {
    const slug = t.seoProfile?.slug || generateSlug(t.user.name);
    const hasBio = Boolean(t.bio && t.bio.trim().length > 30);
    const hasKeywords = (t.seoProfile?.targetKeywords?.length || 0) > 0;
    let completeness = 40;
    if (hasBio) completeness += 20;
    if (t.user.photoUrl) completeness += 20;
    if (hasKeywords) completeness += 20;

    return {
      id: t.id,
      name: t.user.name,
      email: t.user.email,
      photoUrl: t.user.photoUrl,
      department: t.department,
      subjects: t.subjects,
      targetExams: t.targetExams,
      slug,
      isPublicProfileEnabled: t.seoProfile ? t.seoProfile.isPublicProfileEnabled : true,
      isSeoIndexed: t.seoProfile ? t.seoProfile.isSeoIndexed : true,
      customSeoTitle: t.seoProfile?.customSeoTitle || "",
      customMetaDescription: t.seoProfile?.customMetaDescription || "",
      targetKeywords: t.seoProfile?.targetKeywords || [],
      hindiKeywords: t.seoProfile?.hindiKeywords || [],
      englishKeywords: t.seoProfile?.englishKeywords || [],
      verifiedBio: t.seoProfile?.verifiedBio || t.bio || "",
      teachingPhilosophy: t.seoProfile?.teachingPhilosophy || "",
      canonicalUrl: `https://atomicpathshala.in/teachers/${slug}`,
      completenessScore: completeness,
    };
  });

  const criticalIssues = issues.filter((i) => i.status === "OPEN" && i.severity === "CRITICAL").length;
  const highIssues = issues.filter((i) => i.status === "OPEN" && i.severity === "HIGH").length;
  const mediumIssues = issues.filter((i) => i.status === "OPEN" && i.severity === "MEDIUM").length;

  let healthScore = 100 - criticalIssues * 15 - highIssues * 8 - mediumIssues * 3;
  healthScore = Math.max(20, Math.min(healthScore, 100));

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <AdminSeoManagerClient
        initialSettings={settings}
        initialTeachers={teacherItems}
        initialKeywords={keywords}
        initialArticles={articles.map((a) => ({
          ...a,
          publishedAt: a.publishedAt ? a.publishedAt.toISOString() : null,
        }))}
        initialIssues={issues}
        initialHealthScore={healthScore}
        stats={{
          totalPublishedPages: 12 + teacherItems.length,
          totalVerifiedPyqs: verifiedPyqCount,
          activeBatchesCount: batchesCount,
        }}
      />
    </div>
  );
}
