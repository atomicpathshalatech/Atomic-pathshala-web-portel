import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { PromoBanner } from "@/components/landing/PromoBanner";
import { FeatureGrid } from "@/components/landing/FeatureGrid";
import { BatchesSection } from "@/components/landing/BatchesSection";
import { AIBentoSection } from "@/components/landing/AIBentoSection";
import { FacultySection } from "@/components/landing/FacultySection";
import { AnalyticsSection } from "@/components/landing/AnalyticsSection";
import { TestimonialsSection } from "@/components/landing/TestimonialsSection";
import { FAQSection } from "@/components/landing/FAQSection";
import { Footer } from "@/components/landing/Footer";
import { HomePageRenderer, type RenderableSection } from "@/components/home-cms/HomePageRenderer";
import { prisma } from "@/lib/db";

export const revalidate = 60;

function StaticFallbackHome() {
  return (
    <main className="pt-24">
      <Hero />
      <PromoBanner />
      <FeatureGrid />
      <BatchesSection />
      <AIBentoSection />
      <FacultySection />
      <AnalyticsSection />
      <TestimonialsSection />
      <FAQSection />
    </main>
  );
}

/**
 * The public homepage is CMS-driven when an admin has published a Home
 * Builder version, and falls back to the original static landing page
 * (unchanged, still fully functional) when nothing has been published or
 * the live version was explicitly unpublished. This is the ONLY place the
 * fallback and the CMS output are chosen between — HomePageRenderer never
 * runs unless a real, admin-published version exists.
 */
export default async function HomePage() {
  const live = await prisma.homePageVersion.findFirst({
    where: { unpublishedAt: null },
    orderBy: { publishedAt: "desc" },
  });

  const sections = live && Array.isArray(live.sectionsSnapshot) ? (live.sectionsSnapshot as unknown as RenderableSection[]) : null;

  return (
    <>
      <Navbar />
      {sections && sections.length > 0 ? (
        <main className="pt-24">
          <HomePageRenderer sections={sections} />
        </main>
      ) : (
        <StaticFallbackHome />
      )}
      <Footer />
    </>
  );
}
