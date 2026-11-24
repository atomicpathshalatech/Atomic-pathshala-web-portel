import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";

export const metadata: Metadata = {
  title: "Course Pricing & Fee Structure — Atomic Pathshala",
  description: "Transparent, honest pricing for NEET, JEE, and Foundation batches at Atomic Pathshala. All prices inclusive of GST.",
};

export default async function PricingPage() {
  const batches = await prisma.batch.findMany({
    where: {
      status: { in: ["ACTIVE", "UPCOMING"] },
      isPurchasable: true,
      price: { not: null },
    },
    select: {
      id: true,
      name: true,
      code: true,
      price: true,
      originalPrice: true,
      targetExam: true,
      description: true,
      thumbnailUrl: true,
    },
    orderBy: { createdAt: "desc" },
    take: 12,
  });

  return (
    <div className="min-h-screen bg-[#fbfcff] text-[#121c2c] py-12 px-4 font-sans">
      <div className="max-w-5xl mx-auto space-y-10">
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-primary">Honest &amp; Transparent</span>
          <h1 className="text-3xl sm:text-4xl font-black text-[#031635]">Course &amp; Batch Pricing</h1>
          <p className="text-xs sm:text-sm text-slate-500">
            No hidden admission fees. Every enrollment includes live classes, recorded lecture archives, daily practice problems, full-length test series, and dedicated doubt clearance.
          </p>
          <p className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 py-1 px-3 rounded-full inline-block">
            All prices are inclusive of 18% GST · Tax invoice provided immediately upon enrollment
          </p>
        </div>

        {/* Batches Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {batches.map((b) => {
            const discount =
              b.originalPrice && b.originalPrice > (b.price ?? 0)
                ? Math.round((((b.originalPrice - (b.price ?? 0)) / b.originalPrice) * 100))
                : null;

            return (
              <div
                key={b.id}
                className="bg-white rounded-3xl border border-slate-200/80 p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition"
              >
                <div className="space-y-4">
                  {b.targetExam && (
                    <span className="bg-purple-100 text-purple-800 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full">
                      {b.targetExam}
                    </span>
                  )}
                  <div>
                    <h3 className="font-black text-lg text-[#031635] leading-snug">{b.name}</h3>
                    <p className="text-[11px] font-mono text-slate-400 mt-0.5">Code: {b.code}</p>
                    {b.description && (
                      <p className="text-xs text-slate-500 mt-2 line-clamp-3 leading-relaxed">
                        {b.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-100 space-y-4 mt-6">
                  <div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-black text-[#031635]">
                        ₹{(b.price ?? 0).toLocaleString("en-IN")}
                      </span>
                      {b.originalPrice && b.originalPrice > (b.price ?? 0) && (
                        <span className="text-xs text-slate-400 line-through">
                          ₹{b.originalPrice.toLocaleString("en-IN")}
                        </span>
                      )}
                      {discount && (
                        <span className="text-[11px] font-extrabold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                          {discount}% OFF
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400">Total payable including taxes</span>
                  </div>

                  <Link
                    href={`/checkout/${b.id}`}
                    className="w-full py-3 rounded-2xl bg-[#6b46c1] hover:bg-[#5b3da5] text-white font-bold text-xs block text-center transition shadow-md shadow-purple-500/20"
                  >
                    Enroll Now
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        {/* Subscription Callout */}
        <div className="bg-gradient-to-r from-slate-900 to-[#1a237e] text-white p-8 rounded-3xl flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
          <div className="space-y-2 text-center md:text-left">
            <h2 className="text-xl font-black">Looking for Platform-Wide All-Access?</h2>
            <p className="text-xs text-slate-300 max-w-lg leading-relaxed">
              Atomic Pathshala Pro subscriptions give you unrestricted access to every subject, live interactive whiteboards, instant AI doubt solutions, and comprehensive question banks.
            </p>
          </div>
          <Link
            href="/subscription"
            className="px-6 py-3.5 bg-white text-slate-900 hover:bg-slate-100 font-bold text-xs rounded-2xl transition shrink-0 shadow"
          >
            Explore Subscription Plans
          </Link>
        </div>

        <div className="text-center pt-2">
          <Link href="/" className="text-xs text-primary font-bold hover:underline">
            &larr; Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
