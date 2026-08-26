import type { Metadata } from "next";
import { requireTeamSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { prisma } from "@/lib/db";
import { FaqManager } from "@/components/home-cms/FaqManager";

export const metadata: Metadata = { title: "FAQs — Website Builder" };

export default async function FaqsPage() {
  const { user } = await requireTeamSession();
  const canManage = await hasPermission(user.id, PERMISSIONS.FAQ_MANAGE);
  if (!canManage) {
    return <div className="glass-card rounded-2xl p-8 text-center text-on-surface-variant font-body-md">You don&apos;t have access to FAQs.</div>;
  }

  const [categories, faqs] = await Promise.all([
    prisma.faqCategory.findMany({ orderBy: { order: "asc" } }),
    prisma.faq.findMany({ orderBy: [{ categoryId: "asc" }, { order: "asc" }] }),
  ]);

  return (
    <div className="space-y-stack-lg max-w-5xl">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">FAQs</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Feeds the homepage FAQ section — optionally scoped to one category via that section&apos;s config.
        </p>
      </div>
      <FaqManager
        initialCategories={categories.map((c) => ({ id: c.id, name: c.name }))}
        initialFaqs={faqs.map((f) => ({ id: f.id, categoryId: f.categoryId, question: f.question, answer: f.answer, isPublished: f.isPublished }))}
      />
    </div>
  );
}
