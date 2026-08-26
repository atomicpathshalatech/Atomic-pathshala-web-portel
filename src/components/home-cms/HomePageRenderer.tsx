import { Fragment } from "react";
import Link from "next/link";
import { prisma } from "@/lib/db";

/**
 * Renders the published homepage from a HomePageVersion's sectionsSnapshot.
 * Deliberately data-driven, not a hard-coded page: COURSE_GRID / BATCH_GRID
 * / TEACHER_GRID query the real Course/Batch/Teacher tables (never a
 * fabricated array), and every other section type reads its copy from the
 * section's own `config` JSON rather than a constant baked into this file.
 * Visual language (tokens, spacing, container width) matches the existing
 * static landing components in src/components/landing/ so a published CMS
 * homepage doesn't look like a different product from the fallback.
 */

export type RenderableSection = {
  id?: string;
  type: string;
  title: string | null;
  subtitle: string | null;
  visible?: boolean;
  visibleDesktop?: boolean;
  visibleMobile?: boolean;
  config: Record<string, unknown>;
  background: string | null;
  padding: string | null;
};

const SECTION_CONTAINER = "px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto";

function str(config: Record<string, unknown>, key: string, fallback = ""): string {
  const v = config[key];
  return typeof v === "string" ? v : fallback;
}

function arr<T = unknown>(config: Record<string, unknown>, key: string): T[] {
  const v = config[key];
  return Array.isArray(v) ? (v as T[]) : [];
}

function Wrapper({ section, children }: { section: RenderableSection; children: React.ReactNode }) {
  const visibilityClass =
    section.visibleDesktop === false
      ? "hidden md:hidden"
      : section.visibleMobile === false
        ? "hidden md:block"
        : "";
  return (
    <section
      className={`py-stack-lg ${visibilityClass}`}
      style={section.background ? { background: section.background } : undefined}
    >
      <div className={SECTION_CONTAINER} style={section.padding ? { padding: section.padding } : undefined}>
        {children}
      </div>
    </section>
  );
}

function SectionHeading({ title, subtitle }: { title: string | null; subtitle: string | null }) {
  if (!title && !subtitle) return null;
  return (
    <div className="text-center mb-stack-md space-y-2">
      {title && <h2 className="font-headline-lg text-headline-lg text-on-surface">{title}</h2>}
      {subtitle && <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl mx-auto">{subtitle}</p>}
    </div>
  );
}

async function HeroSection({ section }: { section: RenderableSection }) {
  const c = section.config;
  return (
    <Wrapper section={section}>
      <div className="text-center space-y-6 py-stack-lg">
        <h1 className="font-display-lg text-display-lg text-on-surface">
          {section.title || str(c, "heading", "Welcome to Atomic Pathshala")}
        </h1>
        {(section.subtitle || str(c, "subheading")) && (
          <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl mx-auto">
            {section.subtitle || str(c, "subheading")}
          </p>
        )}
        {str(c, "ctaText") && (
          <Link
            href={str(c, "ctaUrl", "/register")}
            className="inline-flex items-center gap-2 bg-primary text-on-primary px-8 py-3.5 rounded-xl font-label-lg text-label-lg hover:opacity-90 transition-opacity"
          >
            {str(c, "ctaText")}
          </Link>
        )}
      </div>
    </Wrapper>
  );
}

function ImageBannerSection({ section }: { section: RenderableSection }) {
  const c = section.config;
  const imageUrl = str(c, "imageUrl");
  if (!imageUrl) return null;
  return (
    <Wrapper section={section}>
      <Link href={str(c, "ctaUrl", "#")} className="block rounded-2xl overflow-hidden glass-card">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt={str(c, "alt", section.title ?? "Banner")} className="w-full h-auto" />
      </Link>
    </Wrapper>
  );
}

function TextImageSection({ section }: { section: RenderableSection }) {
  const c = section.config;
  const reverse = c.imagePosition === "left";
  return (
    <Wrapper section={section}>
      <div className={`grid grid-cols-1 md:grid-cols-2 gap-gutter items-center ${reverse ? "md:[&>*:first-child]:order-2" : ""}`}>
        <div className="space-y-4">
          {section.title && <h2 className="font-headline-lg text-headline-lg text-on-surface">{section.title}</h2>}
          {(section.subtitle || str(c, "body")) && (
            <p className="font-body-md text-body-md text-on-surface-variant">{section.subtitle || str(c, "body")}</p>
          )}
          {str(c, "ctaText") && (
            <Link href={str(c, "ctaUrl", "#")} className="text-primary font-label-md hover:underline inline-block">
              {str(c, "ctaText")} →
            </Link>
          )}
        </div>
        {str(c, "imageUrl") && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={str(c, "imageUrl")} alt={section.title ?? ""} className="rounded-2xl w-full h-auto" />
        )}
      </div>
    </Wrapper>
  );
}

function FeaturesSection({ section }: { section: RenderableSection }) {
  const items = arr<{ icon?: string; title?: string; description?: string }>(section.config, "items");
  if (items.length === 0) return null;
  return (
    <Wrapper section={section}>
      <SectionHeading title={section.title} subtitle={section.subtitle} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-gutter">
        {items.map((item, i) => (
          <div key={i} className="glass-card rounded-2xl p-6 space-y-3">
            {item.icon && (
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                <span className="material-symbols-outlined">{item.icon}</span>
              </div>
            )}
            {item.title && <h3 className="font-headline-md text-headline-md text-on-surface">{item.title}</h3>}
            {item.description && <p className="text-label-sm text-on-surface-variant">{item.description}</p>}
          </div>
        ))}
      </div>
    </Wrapper>
  );
}

async function CourseGridSection({ section }: { section: RenderableSection }) {
  const c = section.config;
  const limit = typeof c.limit === "number" ? c.limit : 6;
  const courseIds = arr<string>(c, "courseIds");
  const mode = str(c, "mode", "LATEST");

  const courses = await prisma.course.findMany({
    where: {
      isPublished: true,
      ...(mode === "MANUAL" && courseIds.length > 0 ? { id: { in: courseIds } } : {}),
    },
    orderBy: mode === "MANUAL" ? undefined : { createdAt: "desc" },
    take: limit,
    select: { id: true, title: true, slug: true, description: true, _count: { select: { batches: true } } },
  });
  if (courses.length === 0) return null;

  return (
    <Wrapper section={section}>
      <SectionHeading title={section.title} subtitle={section.subtitle} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-gutter">
        {courses.map((course) => (
          <Link key={course.id} href={`/courses/${course.slug}`} className="glass-card rounded-2xl p-6 space-y-2 hover:-translate-y-0.5 transition-transform">
            <h3 className="font-headline-md text-headline-md text-on-surface">{course.title}</h3>
            {course.description && <p className="text-label-sm text-on-surface-variant line-clamp-2">{course.description}</p>}
            <p className="text-label-sm text-primary">{course._count.batches} batch{course._count.batches === 1 ? "" : "es"} running</p>
          </Link>
        ))}
      </div>
    </Wrapper>
  );
}

async function BatchGridSection({ section }: { section: RenderableSection }) {
  const c = section.config;
  const limit = typeof c.limit === "number" ? c.limit : 6;
  const targetExam = str(c, "targetExam");

  const batches = await prisma.batch.findMany({
    where: {
      status: { in: ["UPCOMING", "ACTIVE"] },
      ...(targetExam ? { targetExam } : {}),
    },
    orderBy: { startDate: "asc" },
    take: limit,
    select: { id: true, name: true, code: true, targetExam: true, status: true, startDate: true, course: { select: { title: true } } },
  });
  if (batches.length === 0) return null;

  return (
    <Wrapper section={section}>
      <SectionHeading title={section.title} subtitle={section.subtitle} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-gutter">
        {batches.map((batch) => (
          <div key={batch.id} className="glass-card rounded-2xl p-6 space-y-2">
            <span className="text-[10px] bg-secondary/10 text-secondary px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">
              {batch.status}
            </span>
            <h3 className="font-headline-md text-headline-md text-on-surface">{batch.name}</h3>
            {batch.course?.title && <p className="text-label-sm text-on-surface-variant">{batch.course.title}</p>}
            {batch.targetExam && <p className="text-label-sm text-primary">{batch.targetExam}</p>}
          </div>
        ))}
      </div>
    </Wrapper>
  );
}

async function TeacherGridSection({ section }: { section: RenderableSection }) {
  const limit = typeof section.config.limit === "number" ? (section.config.limit as number) : 8;
  const teachers = await prisma.teacher.findMany({
    where: { onboardingStatus: "ACTIVE" },
    take: limit,
    select: { id: true, department: true, subjects: true, bio: true, rating: true, user: { select: { name: true, photoUrl: true } } },
  });
  if (teachers.length === 0) return null;

  return (
    <Wrapper section={section}>
      <SectionHeading title={section.title} subtitle={section.subtitle} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter">
        {teachers.map((t) => (
          <div key={t.id} className="glass-card rounded-2xl p-6 text-center space-y-2">
            <div className="w-16 h-16 rounded-full bg-primary/10 mx-auto flex items-center justify-center overflow-hidden">
              {t.user.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.user.photoUrl} alt={t.user.name} className="w-full h-full object-cover" />
              ) : (
                <span className="material-symbols-outlined text-primary">person</span>
              )}
            </div>
            <h3 className="font-headline-md text-headline-md text-on-surface">{t.user.name}</h3>
            <p className="text-label-sm text-on-surface-variant">{t.department}</p>
            {t.subjects.length > 0 && <p className="text-label-sm text-primary">{t.subjects.join(", ")}</p>}
          </div>
        ))}
      </div>
    </Wrapper>
  );
}

function CategoryGridSection({ section }: { section: RenderableSection }) {
  // No Category model exists in this project's schema — Batch.targetExam is
  // the real taxonomy. Config supplies the list of target-exam labels to
  // link out to a filtered batches view rather than a fabricated model.
  const items = arr<{ label?: string; icon?: string; href?: string }>(section.config, "items");
  if (items.length === 0) return null;
  return (
    <Wrapper section={section}>
      <SectionHeading title={section.title} subtitle={section.subtitle} />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-gutter">
        {items.map((item, i) => (
          <Link key={i} href={item.href ?? "#"} className="glass-card rounded-xl p-5 text-center space-y-2 hover:-translate-y-0.5 transition-transform">
            {item.icon && <span className="material-symbols-outlined text-primary text-3xl">{item.icon}</span>}
            {item.label && <p className="font-label-md text-label-md text-on-surface">{item.label}</p>}
          </Link>
        ))}
      </div>
    </Wrapper>
  );
}

function StatisticsSection({ section }: { section: RenderableSection }) {
  const items = arr<{ value?: string; label?: string }>(section.config, "items");
  if (items.length === 0) return null;
  return (
    <Wrapper section={section}>
      <SectionHeading title={section.title} subtitle={section.subtitle} />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-gutter text-center">
        {items.map((item, i) => (
          <div key={i}>
            <p className="font-display-lg text-display-lg text-gradient">{item.value}</p>
            <p className="text-label-sm text-on-surface-variant">{item.label}</p>
          </div>
        ))}
      </div>
    </Wrapper>
  );
}

async function TestimonialsSection({ section }: { section: RenderableSection }) {
  const limit = typeof section.config.limit === "number" ? (section.config.limit as number) : 6;
  const testimonials = await prisma.testimonial.findMany({
    where: { isApproved: true },
    orderBy: { order: "asc" },
    take: limit,
  });
  if (testimonials.length === 0) return null;

  return (
    <Wrapper section={section}>
      <SectionHeading title={section.title} subtitle={section.subtitle} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-gutter">
        {testimonials.map((t) => (
          <div key={t.id} className="glass-card rounded-2xl p-6 space-y-3">
            <p className="font-body-md text-body-md text-on-surface italic">&ldquo;{t.quote}&rdquo;</p>
            <div className="flex items-center gap-3">
              {t.photoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.photoUrl} alt={t.studentName} className="w-10 h-10 rounded-full object-cover" />
              )}
              <div>
                <p className="font-label-md text-label-md text-on-surface">{t.studentName}</p>
                {(t.studentClass || t.targetExam) && (
                  <p className="text-label-sm text-on-surface-variant">{[t.studentClass, t.targetExam].filter(Boolean).join(" · ")}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Wrapper>
  );
}

function AnnouncementSection({ section }: { section: RenderableSection }) {
  const c = section.config;
  const message = str(c, "message");
  if (!message) return null;
  return (
    <Wrapper section={section}>
      <div className="bg-tertiary-container/20 border border-tertiary/30 rounded-xl p-4 text-center flex items-center justify-center gap-3">
        <span className="material-symbols-outlined text-tertiary">campaign</span>
        <p className="font-label-md text-label-md text-on-surface">{message}</p>
        {str(c, "ctaText") && (
          <Link href={str(c, "ctaUrl", "#")} className="text-primary font-label-md hover:underline">
            {str(c, "ctaText")}
          </Link>
        )}
      </div>
    </Wrapper>
  );
}

function VideoSection({ section }: { section: RenderableSection }) {
  const embedUrl = str(section.config, "embedUrl");
  if (!embedUrl) return null;
  return (
    <Wrapper section={section}>
      <SectionHeading title={section.title} subtitle={section.subtitle} />
      <div className="aspect-video rounded-2xl overflow-hidden glass-card">
        <iframe src={embedUrl} className="w-full h-full" allowFullScreen title={section.title ?? "Video"} />
      </div>
    </Wrapper>
  );
}

function AppDownloadSection({ section }: { section: RenderableSection }) {
  const c = section.config;
  const androidUrl = str(c, "androidUrl");
  const iosUrl = str(c, "iosUrl");
  if (!androidUrl && !iosUrl) return null;
  return (
    <Wrapper section={section}>
      <div className="glass-card rounded-2xl p-8 text-center space-y-4">
        <SectionHeading title={section.title} subtitle={section.subtitle} />
        <div className="flex flex-wrap items-center justify-center gap-4">
          {androidUrl && (
            <Link href={androidUrl} className="bg-inverse-surface text-surface-variant px-6 py-3 rounded-xl font-label-md">
              Get it on Google Play
            </Link>
          )}
          {iosUrl && (
            <Link href={iosUrl} className="bg-inverse-surface text-surface-variant px-6 py-3 rounded-xl font-label-md">
              Download on the App Store
            </Link>
          )}
        </div>
      </div>
    </Wrapper>
  );
}

async function BlogSection({ section }: { section: RenderableSection }) {
  // Blog CMS is a deferred follow-up phase — no BlogPost model exists yet.
  // Rendering nothing (rather than fake posts) keeps this honest; an admin
  // simply shouldn't add this section type until Blog CMS ships.
  void section;
  return null;
}

async function FaqSection({ section }: { section: RenderableSection }) {
  const categoryId = str(section.config, "categoryId");
  const faqs = await prisma.faq.findMany({
    where: { isPublished: true, ...(categoryId ? { categoryId } : {}) },
    orderBy: { order: "asc" },
    take: 20,
  });
  if (faqs.length === 0) return null;

  return (
    <Wrapper section={section}>
      <SectionHeading title={section.title} subtitle={section.subtitle} />
      <div className="max-w-2xl mx-auto divide-y divide-outline-variant/20 glass-card rounded-2xl">
        {faqs.map((faq) => (
          <details key={faq.id} className="p-5 group">
            <summary className="font-label-lg text-label-lg text-on-surface cursor-pointer list-none flex items-center justify-between">
              {faq.question}
              <span className="material-symbols-outlined text-on-surface-variant group-open:rotate-180 transition-transform">expand_more</span>
            </summary>
            <p className="text-label-sm text-on-surface-variant mt-2">{faq.answer}</p>
          </details>
        ))}
      </div>
    </Wrapper>
  );
}

function LogoPartnersSection({ section }: { section: RenderableSection }) {
  const logos = arr<{ imageUrl?: string; name?: string }>(section.config, "logos");
  if (logos.length === 0) return null;
  return (
    <Wrapper section={section}>
      <SectionHeading title={section.title} subtitle={section.subtitle} />
      <div className="flex flex-wrap items-center justify-center gap-8 opacity-80">
        {logos.map((logo, i) =>
          logo.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={logo.imageUrl} alt={logo.name ?? ""} className="h-8 w-auto grayscale" />
          ) : null
        )}
      </div>
    </Wrapper>
  );
}

function CtaSection({ section }: { section: RenderableSection }) {
  const c = section.config;
  return (
    <Wrapper section={section}>
      <div className="bg-primary rounded-2xl p-10 text-center space-y-4">
        <h2 className="font-headline-lg text-headline-lg text-on-primary">{section.title || str(c, "heading")}</h2>
        {(section.subtitle || str(c, "body")) && (
          <p className="font-body-md text-body-md text-on-primary/80 max-w-xl mx-auto">{section.subtitle || str(c, "body")}</p>
        )}
        {str(c, "ctaText") && (
          <Link href={str(c, "ctaUrl", "/register")} className="inline-block bg-white text-primary px-8 py-3 rounded-xl font-label-lg">
            {str(c, "ctaText")}
          </Link>
        )}
      </div>
    </Wrapper>
  );
}

function ContactSection({ section }: { section: RenderableSection }) {
  const c = section.config;
  const phone = str(c, "phone");
  const email = str(c, "email");
  const address = str(c, "address");
  if (!phone && !email && !address) return null;
  return (
    <Wrapper section={section}>
      <SectionHeading title={section.title} subtitle={section.subtitle} />
      <div className="glass-card rounded-2xl p-6 grid grid-cols-1 sm:grid-cols-3 gap-gutter text-center">
        {phone && (
          <div>
            <span className="material-symbols-outlined text-primary">call</span>
            <p className="text-label-sm text-on-surface-variant">{phone}</p>
          </div>
        )}
        {email && (
          <div>
            <span className="material-symbols-outlined text-primary">mail</span>
            <p className="text-label-sm text-on-surface-variant">{email}</p>
          </div>
        )}
        {address && (
          <div>
            <span className="material-symbols-outlined text-primary">location_on</span>
            <p className="text-label-sm text-on-surface-variant">{address}</p>
          </div>
        )}
      </div>
    </Wrapper>
  );
}

function SocialLinksSection({ section }: { section: RenderableSection }) {
  const links = arr<{ platform?: string; url?: string; icon?: string }>(section.config, "links");
  if (links.length === 0) return null;
  return (
    <Wrapper section={section}>
      <div className="flex items-center justify-center gap-4">
        {links.map((link, i) => (
          <Link key={i} href={link.url ?? "#"} className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/20">
            <span className="material-symbols-outlined text-lg">{link.icon ?? "link"}</span>
          </Link>
        ))}
      </div>
    </Wrapper>
  );
}

function CustomHtmlSection({ section }: { section: RenderableSection }) {
  const html = str(section.config, "html");
  if (!html) return null;
  // Trusted input: only SUPER_ADMIN / MARKETING (HOME_EDIT permission
  // holders) can ever write section config, the same trust boundary as
  // every other Team Portal write in this project — not public input.
  return (
    <Wrapper section={section}>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </Wrapper>
  );
}

type SectionRenderer = (props: { section: RenderableSection }) => React.ReactNode | Promise<React.ReactNode>;

const RENDERERS: Record<string, SectionRenderer> = {
  HERO: HeroSection,
  IMAGE_BANNER: ImageBannerSection,
  TEXT_IMAGE: TextImageSection,
  FEATURES: FeaturesSection,
  COURSE_GRID: CourseGridSection,
  BATCH_GRID: BatchGridSection,
  TEACHER_GRID: TeacherGridSection,
  CATEGORY_GRID: CategoryGridSection,
  STATISTICS: StatisticsSection,
  TESTIMONIALS: TestimonialsSection,
  ANNOUNCEMENT: AnnouncementSection,
  VIDEO: VideoSection,
  APP_DOWNLOAD: AppDownloadSection,
  BLOG: BlogSection,
  FAQ: FaqSection,
  LOGO_PARTNERS: LogoPartnersSection,
  CTA: CtaSection,
  CONTACT: ContactSection,
  SOCIAL_LINKS: SocialLinksSection,
  CUSTOM_HTML: CustomHtmlSection,
};

export async function HomePageRenderer({ sections }: { sections: RenderableSection[] }) {
  // Sections arrive pre-ordered from the snapshot (see /api/homepage).
  const visible = sections.filter((s) => s.visible !== false);

  // Renderer functions are called directly (not used as JSX tags) and
  // awaited here — several of them are async (they query Prisma for real
  // course/batch/teacher/testimonial/FAQ data). Calling them as plain
  // functions and awaiting the result sidesteps TypeScript's JSX typing
  // for async components, which @types/react doesn't model cleanly for
  // components nested this deep.
  const rendered = await Promise.all(
    visible.map(async (section, i) => {
      const renderFn = RENDERERS[section.type];
      if (!renderFn) return null;
      const node = await renderFn({ section });
      return <Fragment key={section.id ?? i}>{node}</Fragment>;
    })
  );

  return <>{rendered}</>;
}
