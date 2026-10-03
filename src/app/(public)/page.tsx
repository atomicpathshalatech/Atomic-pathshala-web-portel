import type { Metadata } from "next";
import { FloatingGuruWidget } from "@/components/shared/FloatingGuruWidget";
import { AppEntryGate } from "@/components/platform/AppEntryGate";
import { getPublicHomeData } from "@/lib/public-home";
import { getLiveHomeLayout } from "@/lib/home-layout";
import { DEFAULT_LAYOUT } from "@/lib/home-templates";
import { PublicHeader } from "@/components/public-home/PublicHeader";
import { HomeSections } from "@/components/public-home/HomeSections";
import { PublicFooter, resolveFaqs } from "@/components/public-home/TrustSections";

export const revalidate = 60;

const SITE = "https://ap.atomicpathshala.in";
const TITLE = "Atomic Pathshala — NEET, JEE & Board Exam Preparation";
const DESCRIPTION =
  "Free PYQs, notes, mind maps, formula sheets, DPPs and tests for NEET, JEE and Class 10, 11 & 12 — in Hindi and English. Live classes, recordings and doubt support.";

export const metadata: Metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: SITE,
    siteName: "Atomic Pathshala",
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: "/brand/logo.png", alt: "Atomic Pathshala" }],
    locale: "en_IN",
  },
  twitter: { card: "summary", title: TITLE, description: DESCRIPTION, images: ["/brand/logo.png"] },
};

export default async function HomePage() {
  // Team → Website → Website Builder controls the sections (order, content,
  // who sees them). Until a version is published, the default layout shows.
  const [live, data] = await Promise.all([getLiveHomeLayout(), getPublicHomeData()]);
  const sections = live?.sections ?? DEFAULT_LAYOUT;
  const faqs = resolveFaqs(data.faqs);
  const showFaqLd = sections.some((s) => s.type === "FAQ" && s.visible !== false && (s.config?.audience ?? "ALL") === "ALL");

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "EducationalOrganization",
      name: "Atomic Pathshala",
      url: SITE,
      logo: `${SITE}/brand/logo.png`,
      ...(data.socials.length ? { sameAs: data.socials.map((s) => s.url) } : {}),
    },
    { "@context": "https://schema.org", "@type": "WebSite", name: "Atomic Pathshala", url: SITE },
    ...(showFaqLd
      ? [
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })),
          },
        ]
      : []),
  ];

  return (
    <>
      {/* Installed PWA / native app users skip the marketing home and go
          straight to login → dashboard. No-op in a normal browser tab. */}
      <AppEntryGate />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <PublicHeader />
      <main className="overflow-x-hidden bg-white">
        {/* The page keeps one H1 for search engines when the hero section isn't used. */}
        {!sections.some((s) => s.type === "HERO" && s.visible !== false) && <h1 className="sr-only">{TITLE}</h1>}
        <HomeSections sections={sections} />
      </main>
      <PublicFooter socials={data.socials} />
      <FloatingGuruWidget />
    </>
  );
}
