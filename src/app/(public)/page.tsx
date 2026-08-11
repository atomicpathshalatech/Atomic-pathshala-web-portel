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

export default function HomePage() {
  return (
    <>
      <Navbar />
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
      <Footer />
    </>
  );
}
