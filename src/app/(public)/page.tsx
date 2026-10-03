import type { Metadata } from "next";
import { FloatingGuruWidget } from "@/components/shared/FloatingGuruWidget";
import { AppEntryGate } from "@/components/platform/AppEntryGate";
import { getActiveHomeBanners, getPublicHomeData } from "@/lib/public-home";
import { getHomeHeroImage, getPublishedBlogPosts } from "@/lib/blog";
import { PublicHeader } from "@/components/public-home/PublicHeader";
import { HeroSection } from "@/components/public-home/HeroSection";
import { BannerSlider } from "@/components/public-home/BannerSlider";
import { LatestBlogsSection } from "@/components/public-home/BlogSections";
import { ExamSelector } from "@/components/public-home/ExamSelector";
import { HomeSearch } from "@/components/public-home/HomeSearch";
import { FreeLearningHub, StudyMaterialSection, FreeTestSection } from "@/components/public-home/LearningSections";
import { PyqHub } from "@/components/public-home/PyqHub";
import { TodaySection, CourseSection, AtomicGuruSection, FacultySection, YouTubeSection } from "@/components/public-home/PlatformSections";
import { WhyAtomicPathshala, TrustSection, AppPromotion, HomeFAQ, PublicFooter, resolveFaqs } from "@/components/public-home/TrustSections";

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
  const [data, banners, heroImage, posts] = await Promise.all([getPublicHomeData(), getActiveHomeBanners(), getHomeHeroImage(), getPublishedBlogPosts(3)]);
  const faqs = resolveFaqs(data.faqs);

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
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })),
    },
  ];

  return (
    <>
      {/* Installed PWA / native app users skip the marketing home and go
          straight to login → dashboard. No-op in a normal browser tab. */}
      <AppEntryGate />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <PublicHeader />
      <main className="overflow-x-hidden bg-white">
        <HeroSection image={heroImage} />
        <BannerSlider banners={banners} />
        <ExamSelector />
        <HomeSearch />
        <FreeLearningHub data={data} youtubeUrl={data.youtubeUrl} />
        <PyqHub pyqCounts={data.pyqCounts} topChapters={data.topPyqChapters} />
        <StudyMaterialSection data={data} />
        <FreeTestSection data={data} />
        <TodaySection today={data.today} />
        <CourseSection batches={data.batches} />
        <AtomicGuruSection />
        <FacultySection faculty={data.faculty} />
        <YouTubeSection youtubeUrl={data.youtubeUrl} />
        <WhyAtomicPathshala />
        <TrustSection metrics={data.metrics} />
        <AppPromotion />
        <LatestBlogsSection posts={posts} />
        <HomeFAQ faqs={faqs} />
      </main>
      <PublicFooter socials={data.socials} />
      <FloatingGuruWidget />
    </>
  );
}
