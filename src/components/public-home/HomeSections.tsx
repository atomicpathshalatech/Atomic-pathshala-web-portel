import { Fragment, type ReactNode } from "react";
import { getActiveHomeBanners, getPublicHomeData } from "@/lib/public-home";
import { getHomeHeroImage, getPublishedBlogPosts } from "@/lib/blog";
import { getApprovedTestimonials } from "@/lib/homepage";
import { effectiveType, type Audience, type LayoutSection } from "@/lib/home-templates";
import { HomePageRenderer } from "@/components/home-cms/HomePageRenderer";
import { HeroSection, type HeroContent } from "./HeroSection";
import { BannerSlider } from "./BannerSlider";
import { ExamSelector, type GoalCard } from "./ExamSelector";
import { HomeSearch } from "./HomeSearch";
import { FreeLearningHub, StudyMaterialSection, FreeTestSection, type LinkCard } from "./LearningSections";
import { PyqHub } from "./PyqHub";
import { TodaySection, CourseSection, AtomicGuruSection, FacultySection, YouTubeSection } from "./PlatformSections";
import { WhyAtomicPathshala, TrustSection, AppPromotion, HomeFAQ, resolveFaqs, type IconText } from "./TrustSections";
import { LatestBlogsSection } from "./BlogSections";
import { AnnouncementBar, ContactSection, CtaSection, ImageBanner, StatisticsSection, TestimonialsSection, TextImageSection, VideoSection } from "./ExtraSections";
import { AudienceGate } from "./AudienceGate";
import type { Head } from "./ui";

type Config = Record<string, unknown>;
const str = (c: Config, k: string) => (typeof c[k] === "string" ? (c[k] as string).trim() : "");
const num = (c: Config, k: string, d: number) => (typeof c[k] === "number" && Number.isFinite(c[k]) && (c[k] as number) > 0 ? Math.floor(c[k] as number) : d);
const bool = (c: Config, k: string, d: boolean) => (typeof c[k] === "boolean" ? (c[k] as boolean) : d);
const strings = (c: Config, k: string) => (Array.isArray(c[k]) ? (c[k] as unknown[]).filter((x): x is string => typeof x === "string" && x.trim() !== "") : []);
function objects<T>(c: Config, k: string, required: string): T[] {
  const v = c[k];
  if (!Array.isArray(v)) return [];
  return v.filter((x) => x && typeof x === "object" && typeof (x as Config)[required] === "string" && ((x as Config)[required] as string).trim() !== "") as T[];
}

/** Section types rendered by the old Website Builder renderer (kept so nothing published earlier breaks). */
const LEGACY = new Set(["FEATURES", "COURSE_GRID", "CATEGORY_GRID", "LOGO_PARTNERS", "SOCIAL_LINKS", "CUSTOM_HTML"]);

/**
 * Renders a homepage layout (published Website Builder version, the draft in
 * preview, or DEFAULT_LAYOUT) with the public-home components. Only loads the
 * data the listed sections need.
 */
export async function HomeSections({ sections }: { sections: LayoutSection[] }) {
  const list = sections.map((s) => ({ ...s, type: effectiveType(s) })).filter((s) => s.visible !== false && !(s.visibleDesktop === false && s.visibleMobile === false));
  const has = (...types: string[]) => list.some((s) => types.includes(s.type));

  const needsData = has("FREE_RESOURCES", "PYQ_HUB", "STUDY_MATERIAL", "FREE_TESTS", "TODAY_SCHEDULE", "BATCH_GRID", "TEACHER_GRID", "YOUTUBE", "TRUST", "FAQ");
  const [data, banners, heroImage, posts, testimonials] = await Promise.all([
    needsData ? getPublicHomeData() : null,
    has("BANNER_SLIDER") ? getActiveHomeBanners() : [],
    has("HERO") ? getHomeHeroImage() : null,
    has("BLOG") ? getPublishedBlogPosts(9) : [],
    has("TESTIMONIALS") ? getApprovedTestimonials() : [],
  ]);

  const render = async (s: LayoutSection): Promise<ReactNode> => {
    const c = (s.config ?? {}) as Config;
    const head: Head = { eyebrow: str(c, "eyebrow") || undefined, title: s.title?.trim() || undefined, subtitle: s.subtitle?.trim() || undefined };

    switch (s.type) {
      case "HERO": {
        const content: HeroContent = {
          badge: typeof c.badge === "string" ? c.badge : undefined,
          heading: str(c, "heading") || s.title?.trim() || undefined,
          highlight: str(c, "highlight") || undefined,
          headingEnd: str(c, "headingEnd") || undefined,
          subheading: str(c, "subheading") || s.subtitle?.trim() || undefined,
          ctaText: str(c, "ctaText") || undefined,
          ctaUrl: str(c, "ctaUrl") || undefined,
          secondaryCtaText: str(c, "secondaryCtaText") || undefined,
          secondaryCtaUrl: str(c, "secondaryCtaUrl") || undefined,
          bullets: strings(c, "bullets"),
        };
        const own = str(c, "imageUrl");
        const image = own ? { imageUrl: own, mobileImageUrl: str(c, "mobileImageUrl") || null, altText: str(c, "imageAlt") || null } : heroImage;
        return <HeroSection image={image} content={content} />;
      }
      case "BANNER_SLIDER":
        return <BannerSlider banners={banners.slice(0, num(c, "limit", 8))} />;
      case "ANNOUNCEMENT":
        return <AnnouncementBar message={str(c, "message")} ctaText={str(c, "ctaText")} ctaUrl={str(c, "ctaUrl")} />;
      case "IMAGE_BANNER":
        return <ImageBanner imageUrl={str(c, "imageUrl")} mobileImageUrl={str(c, "mobileImageUrl")} alt={str(c, "alt") || s.title || ""} ctaUrl={str(c, "ctaUrl")} />;
      case "EXAM_SELECTOR":
        return <ExamSelector head={head} items={objects<GoalCard>(c, "items", "title")} />;
      case "SEARCH":
        return <HomeSearch head={head} />;
      case "FREE_RESOURCES":
        return data && <FreeLearningHub data={data} youtubeUrl={data.youtubeUrl} head={head} items={objects<LinkCard>(c, "items", "title")} />;
      case "PYQ_HUB":
        return data && <PyqHub pyqCounts={data.pyqCounts} topChapters={data.topPyqChapters} head={head} exams={strings(c, "exams")} />;
      case "STUDY_MATERIAL":
        return data && <StudyMaterialSection data={data} head={head} types={strings(c, "types")} />;
      case "FREE_TESTS": {
        if (!data) return null;
        const ids = strings(c, "seriesIds");
        return <FreeTestSection data={ids.length ? data : { ...data, freeSeries: data.freeSeries.slice(0, 6) }} head={head} seriesIds={ids} />;
      }
      case "TODAY_SCHEDULE":
        return data && <TodaySection today={data.today} head={head} />;
      case "BATCH_GRID": {
        if (!data) return null;
        const ids = strings(c, "batchIds");
        const picked = ids.length ? ids.map((id) => data.batches.find((b) => b.id === id)).filter((b): b is NonNullable<typeof b> => !!b) : data.batches;
        return <CourseSection batches={picked.slice(0, num(c, "limit", ids.length ? 24 : 6))} head={head} showPrice={bool(c, "showPrice", true)} />;
      }
      case "TEACHER_GRID": {
        if (!data) return null;
        const slugs = strings(c, "teacherSlugs");
        const picked = slugs.length ? slugs.map((slug) => data.faculty.find((f) => f.slug === slug)).filter((f): f is NonNullable<typeof f> => !!f) : data.faculty;
        return <FacultySection faculty={picked.slice(0, num(c, "limit", slugs.length ? 40 : 8))} head={head} />;
      }
      case "ATOMIC_GURU":
        return <AtomicGuruSection head={head} ctaText={str(c, "ctaText")} ctaUrl={str(c, "ctaUrl")} />;
      case "YOUTUBE":
        return <YouTubeSection youtubeUrl={str(c, "channelUrl") || data?.youtubeUrl || null} head={head} chips={strings(c, "chips")} ctaText={str(c, "ctaText")} />;
      case "VIDEO":
        return <VideoSection head={head} videoUrl={str(c, "videoUrl") || str(c, "embedUrl")} />;
      case "TESTIMONIALS":
        return <TestimonialsSection head={head} items={testimonials.slice(0, num(c, "limit", 6))} />;
      case "WHY_US":
        return <WhyAtomicPathshala head={head} items={objects<IconText>(c, "items", "title")} />;
      case "TRUST":
        return data && <TrustSection metrics={data.metrics} head={head} showNumbers={bool(c, "showNumbers", true)} items={objects<IconText>(c, "items", "text")} />;
      case "APP_DOWNLOAD":
        return <AppPromotion head={head} ctaText={str(c, "ctaText")} ctaUrl={str(c, "ctaUrl")} />;
      case "BLOG":
        return <LatestBlogsSection posts={posts.slice(0, num(c, "limit", 3))} head={head} />;
      case "FAQ":
        return data && <HomeFAQ faqs={resolveFaqs(data.faqs)} />;
      case "TEXT_IMAGE":
        return <TextImageSection head={head} body={str(c, "body")} imageUrl={str(c, "imageUrl")} imagePosition={str(c, "imagePosition")} ctaText={str(c, "ctaText")} ctaUrl={str(c, "ctaUrl")} />;
      case "CTA":
        return <CtaSection head={{ ...head, title: head.title || str(c, "heading") || undefined, subtitle: head.subtitle || str(c, "body") || undefined }} ctaText={str(c, "ctaText")} ctaUrl={str(c, "ctaUrl")} />;
      case "STATISTICS":
        return <StatisticsSection head={head} items={objects<{ value?: string; label?: string }>(c, "items", "value")} />;
      case "CONTACT":
        return <ContactSection head={head} phone={str(c, "phone")} email={str(c, "email")} address={str(c, "address")} />;
      default:
        if (LEGACY.has(s.type)) {
          return (
            <HomePageRenderer
              sections={[{ id: s.id, type: s.type, title: s.title, subtitle: s.subtitle, config: c, background: s.background ?? null, padding: s.padding ?? null }]}
            />
          );
        }
        return null;
    }
  };

  const nodes = await Promise.all(
    list.map(async (s, i) => {
      let node = await render(s);
      if (!node) return null;
      // Device visibility
      if (s.visibleDesktop === false) node = <div className="md:hidden">{node}</div>;
      else if (s.visibleMobile === false) node = <div className="hidden md:block">{node}</div>;
      // Who can see it
      const audience = (typeof s.config?.audience === "string" ? s.config.audience : "ALL") as Audience;
      if (audience !== "ALL") node = <AudienceGate audience={audience}>{node}</AudienceGate>;
      return <Fragment key={s.id ?? `${s.type}-${i}`}>{node}</Fragment>;
    })
  );
  return <>{nodes}</>;
}
