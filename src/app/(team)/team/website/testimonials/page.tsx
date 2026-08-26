import type { Metadata } from "next";
import { requireTeamSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { prisma } from "@/lib/db";
import { TestimonialManager } from "@/components/home-cms/TestimonialManager";

export const metadata: Metadata = { title: "Testimonials — Website Builder" };

export default async function TestimonialsPage() {
  const { user } = await requireTeamSession();
  const canManage = await hasPermission(user.id, PERMISSIONS.TESTIMONIAL_MANAGE);
  if (!canManage) {
    return <div className="glass-card rounded-2xl p-8 text-center text-on-surface-variant font-body-md">You don&apos;t have access to Testimonials.</div>;
  }

  const testimonials = await prisma.testimonial.findMany({ orderBy: { order: "asc" } });

  return (
    <div className="space-y-stack-lg max-w-5xl">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-on-surface">Testimonials</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Only approved testimonials show on the public homepage&apos;s TESTIMONIALS section.
        </p>
      </div>
      <TestimonialManager
        initialTestimonials={testimonials.map((t) => ({
          id: t.id,
          studentName: t.studentName,
          studentClass: t.studentClass,
          targetExam: t.targetExam,
          quote: t.quote,
          isApproved: t.isApproved,
        }))}
      />
    </div>
  );
}
