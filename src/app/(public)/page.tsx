import { Navbar } from "@/components/landing/Navbar";
import { Hero } from "@/components/landing/Hero";
import { PromoBanner } from "@/components/landing/PromoBanner";
import { FeatureGrid } from "@/components/landing/FeatureGrid";
import { BatchesSection } from "@/components/landing/BatchesSection";
import { TestSeriesShowcaseSection } from "@/components/landing/TestSeriesShowcaseSection";
import { AIBentoSection } from "@/components/landing/AIBentoSection";
import { AtomicGuruLiveSection } from "@/components/landing/AtomicGuruLiveSection";
import { FacultySection } from "@/components/landing/FacultySection";
import { AnalyticsSection } from "@/components/landing/AnalyticsSection";
import { TestimonialsSection } from "@/components/landing/TestimonialsSection";
import { FAQSection } from "@/components/landing/FAQSection";
import { Footer } from "@/components/landing/Footer";

export const revalidate = 60;

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main className="pt-20 md:pt-24 space-y-12 md:space-y-20 overflow-x-hidden">
        <Hero />
        <PromoBanner />
        <FeatureGrid />
        <BatchesSection />
        <TestSeriesShowcaseSection />
        <AIBentoSection />
        <AtomicGuruLiveSection />
        <FacultySection />
        <AnalyticsSection />
        <TestimonialsSection />
        <FAQSection />
      </main>
      <Footer />
    </>
  );
}
