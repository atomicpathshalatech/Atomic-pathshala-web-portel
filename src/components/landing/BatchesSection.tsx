import Link from "next/link";
import { prisma } from "@/lib/db";
import { ScrollReveal } from "./ScrollReveal";

export async function BatchesSection() {
  // Fetch real batches from database
  const dbBatches = await prisma.batch.findMany({
    where: { status: { in: ["ACTIVE", "UPCOMING"] } },
    include: {
      course: { select: { title: true, slug: true } },
      teachers: {
        include: {
          teacher: {
            include: {
              user: { select: { name: true } },
            },
          },
        },
      },
      _count: { select: { enrollments: true, schedules: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 6,
  }).catch(() => []);

  // Fallback high-yield batches if no database records yet
  const displayBatches =
    dbBatches.length > 0
      ? dbBatches.map((b, idx) => ({
          id: b.id,
          title: b.name,
          code: b.code,
          targetExam: b.targetExam || "NEET / JEE",
          badge: idx === 0 ? "Featured" : b.status === "ACTIVE" ? "Live" : "Upcoming",
          faculty:
            b.teachers.map((t) => t.teacher.user.name).join(", ") ||
            "Atomic Pathshala Faculty",
          description:
            b.description ||
            "Comprehensive concept-first preparation with live whiteboard sessions, DPPs, and All-India Test Series.",
          startDate: b.startDate
            ? new Date(b.startDate).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })
            : "Starting Soon",
          enrollmentsCount: b._count.enrollments,
          schedulesCount: b._count.schedules,
          capacity: b.capacity ?? 250,
          price: "₹7,499",
          originalPrice: "₹14,999",
        }))
      : [
          {
            id: "fallback_1",
            title: "NEET 2027 (Phoenix Target Batch)",
            code: "NEET27-PHOENIX",
            targetExam: "NEET UG",
            badge: "Popular",
            faculty: "Firoz Sir, Sanu Yadav Sir, Yaman Khan Sir",
            description:
              "Comprehensive 2-year concept-first program for medical aspirants focusing on NCERT line-by-line mastery and high-yield problem solving.",
            startDate: "Starts 10 Sep 2026",
            enrollmentsCount: 184,
            schedulesCount: 48,
            capacity: 250,
            price: "₹7,499",
            originalPrice: "₹14,999",
          },
          {
            id: "fallback_2",
            title: "JEE 2028 (Apex Comprehensive Batch)",
            code: "JEE28-APEX",
            targetExam: "JEE Main & Advanced",
            badge: "New",
            faculty: "Firoz Sir, Sanu Yadav Sir, Mohsin Ali Sir",
            description:
              "Intensive coaching for JEE Mains & Advanced with heavy emphasis on mathematical derivations and multi-concept mechanics problem solving.",
            startDate: "Starts 15 Sep 2026",
            enrollmentsCount: 142,
            schedulesCount: 42,
            capacity: 200,
            price: "₹8,499",
            originalPrice: "₹16,999",
          },
          {
            id: "fallback_3",
            title: "NEET Droppers / Repeaters Foundation",
            code: "NEET27-DROPPER",
            targetExam: "NEET UG",
            badge: "Fast Track",
            faculty: "Firoz Sir, Dr. Ilmas Amer, Yaman Khan Sir",
            description:
              "Targeted 1-year rank-booster program for dropper students to reinforce weak fundamentals, speed techniques, and daily mock tests.",
            startDate: "Starts 20 Sep 2026",
            enrollmentsCount: 96,
            schedulesCount: 36,
            capacity: 150,
            price: "₹6,999",
            originalPrice: "₹13,999",
          },
        ];

  return (
    <section id="batches" className="py-stack-lg px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto space-y-10">
      <ScrollReveal>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-primary/10 text-primary">
                Live &amp; Verified Cohorts
              </span>
            </div>
            <h2 className="font-display-lg text-display-lg text-on-surface">
              Target <span className="text-gradient">Batches &amp; Cohorts</span>
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl mt-1">
              Structured batch-first learning with live interactive whiteboards, daily DPPs, and personalized mentor support.
            </p>
          </div>
          <Link
            href="/courses"
            className="flex items-center gap-2 text-primary font-bold text-xs hover:underline group"
          >
            <span>View All Active Batches</span>
            <span className="material-symbols-outlined text-sm group-hover:translate-x-1 transition-transform">
              arrow_forward
            </span>
          </Link>
        </div>
      </ScrollReveal>

      <ScrollReveal className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {displayBatches.map((batch) => (
          <div
            key={batch.id}
            className="glass-card rounded-3xl overflow-hidden border border-outline-variant/30 hover:border-primary/50 transition-all flex flex-col justify-between shadow-lg group bg-surface-container-lowest"
          >
            {/* Batch Header Banner */}
            <div className="p-6 pb-4 bg-gradient-to-br from-primary/10 via-surface to-surface border-b border-outline-variant/20 relative space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-surface-container-high text-on-surface">
                  {batch.code}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-primary text-on-primary shadow-sm">
                  {batch.badge}
                </span>
              </div>

              <h3 className="font-headline-md text-base md:text-lg font-bold text-on-surface group-hover:text-primary transition-colors line-clamp-1">
                {batch.title}
              </h3>

              <div className="flex items-center gap-2 text-xs">
                <span className="font-semibold text-primary">{batch.targetExam}</span>
                <span className="text-on-surface-variant">&middot;</span>
                <span className="text-on-surface-variant text-[11px] flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm text-secondary">school</span>
                  {batch.faculty}
                </span>
              </div>
            </div>

            {/* Batch Description & Details */}
            <div className="p-6 space-y-4 flex-1 flex flex-col justify-between">
              <p className="text-xs text-on-surface-variant leading-relaxed line-clamp-3">
                {batch.description}
              </p>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-outline-variant/15 text-xs">
                <div className="flex items-center gap-1.5 text-on-surface-variant">
                  <span className="material-symbols-outlined text-primary text-base">calendar_today</span>
                  <span className="text-[11px] font-semibold">{batch.startDate}</span>
                </div>
                <div className="flex items-center gap-1.5 text-on-surface-variant">
                  <span className="material-symbols-outlined text-secondary text-base">groups</span>
                  <span className="text-[11px] font-semibold">
                    {batch.enrollmentsCount} / {batch.capacity} Enrolled
                  </span>
                </div>
              </div>

              {/* Pricing & CTA */}
              <div className="pt-4 border-t border-outline-variant/20 flex items-center justify-between">
                <div>
                  <span className="text-on-surface-variant line-through text-[11px] font-mono block">
                    {batch.originalPrice}
                  </span>
                  <div className="text-lg font-bold text-primary font-mono">
                    {batch.price}
                  </div>
                </div>
                <Link
                  href="/register"
                  className="px-6 py-2.5 bg-primary text-on-primary font-bold text-xs rounded-xl shadow hover:opacity-90 active:scale-95 transition-all text-center flex items-center gap-1"
                >
                  <span>Enroll Now</span>
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </Link>
              </div>
            </div>
          </div>
        ))}
      </ScrollReveal>
    </section>
  );
}
