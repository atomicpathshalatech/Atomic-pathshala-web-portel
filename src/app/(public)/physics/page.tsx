import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Physics for NEET & JEE — Mechanics, Optics & Modern Physics | Atomic Pathshala",
  description:
    "Learn Physics for NEET UG and IIT-JEE Main/Advanced with top educators Mukul Kashyap and Sashan Yadav at Atomic Pathshala. Concept derivations, formula sheets, short tricks, and chapter-wise verified PYQ solutions in Hindi & English medium.",
  alternates: {
    canonical: "https://ap.atomicpathshala.in/physics",
  },
  openGraph: {
    type: "website",
    url: "https://ap.atomicpathshala.in/physics",
    title: "NEET & JEE Physics Mastery | Atomic Pathshala",
    description: "Physics derivations, numerical solving techniques, and verified chapter-wise PYQ bank for NEET & JEE.",
    images: [{ url: "/brand/logo.png", width: 1200, height: 630, alt: "Physics Atomic Pathshala" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "NEET & JEE Physics Mastery | Atomic Pathshala",
    description: "Physics derivations, numerical solving techniques, and chapter-wise PYQs.",
    images: ["/brand/logo.png"],
  },
};

export default async function PhysicsLandingPage() {
  const [physicsTeachers, physCount] = await Promise.all([
    prisma.teacher.findMany({
      where: {
        onboardingStatus: { not: "REJECTED" },
        OR: [{ department: "Physics" }, { subjects: { has: "Physics" } }],
      },
      include: { user: { select: { name: true, photoUrl: true } }, seoProfile: true },
    }),
    prisma.question.count({
      where: {
        isPublished: true,
        subject: { contains: "Physics", mode: "insensitive" },
        pyqOccurrences: { some: { verificationStatus: "VERIFIED" } },
      },
    }),
  ]);

  const units = [
    { name: "Mechanics & Kinematics", desc: "Laws of Motion, Work Energy & Power, Rotational Motion, Gravitation, and Fluid Mechanics." },
    { name: "Electrodynamics & Magnetism", desc: "Electrostatics, Current Electricity, Moving Charges, Electromagnetic Induction & AC Circuits." },
    { name: "Optics & Wave Theory", desc: "Ray Optics, Optical Instruments, Wave Optics (Interference, Diffraction, Polarization) and Sound Waves." },
    { name: "Modern Physics & Thermodynamics", desc: "Dual Nature of Matter, Atoms, Nuclei, Semiconductor Electronics, and Kinetic Theory of Gases." },
  ];

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Course",
      name: "Physics for NEET & JEE Entrance Exams",
      description: "Concept derivations, numerical mastery, and verified PYQ bank for Physics aspirants.",
      provider: {
        "@type": "EducationalOrganization",
        name: "Atomic Pathshala",
        url: "https://ap.atomicpathshala.in",
      },
      url: "https://ap.atomicpathshala.in/physics",
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Home", item: "https://ap.atomicpathshala.in" },
        { "@type": "ListItem", position: 2, name: "Physics Hub", item: "https://ap.atomicpathshala.in/physics" },
      ],
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#f8fafc] dark:bg-[#0b0f19] text-slate-900 dark:text-slate-100 antialiased font-sans">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Navbar />

      <main className="flex-1 pt-24 pb-20 px-4 sm:px-6 max-w-6xl mx-auto w-full space-y-12">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <Link href="/" className="hover:text-blue-600 transition-colors">
            Home
          </Link>
          <span className="material-symbols-outlined text-xs text-slate-400">chevron_right</span>
          <span className="text-blue-600 dark:text-blue-400 font-semibold truncate">
            Physics Hub
          </span>
        </nav>

        <section className="bg-gradient-to-br from-blue-950 via-slate-950 to-black text-white rounded-3xl p-8 sm:p-12 relative overflow-hidden shadow-xl border border-blue-500/20">
          <div className="max-w-3xl space-y-4 relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-bold border border-blue-400/30">
              <span className="material-symbols-outlined text-sm">bolt</span>
              <span>Physics Core Curriculum</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
              NEET &amp; JEE Physics: Concept Clarity, Formula Derivations &amp; Speed
            </h1>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Master the physical world from Newton&apos;s laws to quantum semiconductors. Learn speed-solving techniques and tackle over {physCount > 0 ? physCount : "300+"} verified PYQs in Hindi and English.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href="/pyq/neet"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-blue-600/30 transition-all"
              >
                <span className="material-symbols-outlined text-base">quiz</span>
                <span>Physics PYQ Solutions</span>
              </Link>
              <Link
                href="/teachers"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs sm:text-sm font-bold border border-white/20 transition-all"
              >
                <span className="material-symbols-outlined text-base">groups</span>
                <span>Physics Faculty Team</span>
              </Link>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-500">grid_view</span>
            <span>Core Physics Modules</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {units.map((u, idx) => (
              <div
                key={idx}
                className="bg-white dark:bg-[#111625] rounded-2xl p-6 border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-2"
              >
                <h3 className="text-base font-bold text-slate-900 dark:text-white">{u.name}</h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{u.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {physicsTeachers.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-blue-500">school</span>
              <span>Physics Educators</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {physicsTeachers.map((t) => {
                const slug = t.seoProfile?.slug || t.user.name?.toLowerCase().replace(/[^a-z0-9]+/g, "-") || t.id;
                return (
                  <Link
                    key={t.id}
                    href={`/teachers/${slug}`}
                    className="group bg-white dark:bg-[#111625] rounded-2xl p-5 border border-slate-200/90 dark:border-slate-800 hover:border-blue-500 shadow-sm transition-all flex items-center gap-4"
                  >
                    <div className="w-12 h-12 rounded-full bg-blue-600 text-white font-bold text-base flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
                      {t.user.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={t.user.photoUrl} alt={t.user.name} className="w-full h-full object-cover" />
                      ) : (
                        (t.user.name[0] || "P").toUpperCase()
                      )}
                    </div>
                    <div>
                      <div className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-blue-600 transition-colors">
                        {t.user.name}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">Physics Faculty</div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </main>

      <Footer />
    </div>
  );
}
