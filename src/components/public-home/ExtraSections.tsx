import Link from "next/link";
import type { HomepageTestimonial } from "@/lib/homepage";
import { ButtonLink, CardRail, CONTAINER, Icon, Section, SectionHeader, type Head } from "./ui";

/* Simple Website Builder templates (admin-written content) in the homepage style. */

const isExternal = (u: string) => /^https?:\/\//i.test(u);

function Header({ head }: { head?: Head }) {
  if (!head?.title) return null;
  return <SectionHeader eyebrow={head.eyebrow} title={head.title} subtitle={head.subtitle} />;
}

export function AnnouncementBar({ message, ctaText, ctaUrl }: { message: string; ctaText?: string; ctaUrl?: string }) {
  if (!message) return null;
  return (
    <div className="bg-blue-600 text-white">
      <div className={`${CONTAINER} flex flex-wrap items-center justify-center gap-x-3 gap-y-1 py-2.5 text-center text-sm font-medium`}>
        <Icon name="campaign" className="text-[18px]" />
        <span>{message}</span>
        {ctaText && ctaUrl && (
          <Link href={ctaUrl} {...(isExternal(ctaUrl) ? { target: "_blank", rel: "noopener noreferrer" } : {})} className="inline-flex min-h-[32px] items-center gap-0.5 font-semibold underline underline-offset-2">
            {ctaText} <Icon name="arrow_forward" className="text-[16px]" />
          </Link>
        )}
      </div>
    </div>
  );
}

export function ImageBanner({ imageUrl, mobileImageUrl, alt, ctaUrl }: { imageUrl: string; mobileImageUrl?: string; alt?: string; ctaUrl?: string }) {
  if (!imageUrl) return null;
  const img = (
    <picture>
      {mobileImageUrl && <source media="(max-width: 639px)" srcSet={mobileImageUrl} />}
      {/* eslint-disable-next-line @next/next/no-img-element -- CMS image */}
      <img src={imageUrl} alt={alt || ""} loading="lazy" decoding="async" className="h-auto w-full rounded-2xl" />
    </picture>
  );
  return (
    <section className="bg-white py-6 sm:py-8">
      <div className={CONTAINER}>
        {ctaUrl ? (
          <a href={ctaUrl} {...(isExternal(ctaUrl) ? { target: "_blank", rel: "noopener noreferrer" } : {})} className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
            {img}
          </a>
        ) : (
          img
        )}
      </div>
    </section>
  );
}

/** youtube.com/watch?v=, youtu.be/, /shorts/, /embed/ → video id */
export function youTubeId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m?.[1] ?? null;
}

export function VideoSection({ head, videoUrl }: { head?: Head; videoUrl: string }) {
  const id = youTubeId(videoUrl || "");
  if (!id) return null;
  return (
    <Section>
      <Header head={head} />
      <div className="mx-auto max-w-4xl overflow-hidden rounded-2xl bg-black shadow-sm">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${id}`}
          title={head?.title || "YouTube video"}
          loading="lazy"
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
          className="aspect-video w-full"
        />
      </div>
    </Section>
  );
}

export function TestimonialsSection({ head, items }: { head?: Head; items: HomepageTestimonial[] }) {
  if (!items.length) return null;
  return (
    <Section tone="tint">
      <SectionHeader eyebrow={head?.eyebrow || "Student reviews"} title={head?.title || "What our students say"} subtitle={head?.subtitle} />
      <CardRail cols="sm:grid-cols-2 lg:grid-cols-3">
        {items.map((t) => (
          <figure key={t.id} className="flex h-full flex-col rounded-2xl border border-slate-200/80 bg-white p-5">
            {t.rating ? (
              <p className="text-amber-500" aria-label={`${t.rating} out of 5`}>
                {"★".repeat(Math.max(0, Math.min(5, t.rating)))}
                <span className="text-slate-200">{"★".repeat(5 - Math.max(0, Math.min(5, t.rating)))}</span>
              </p>
            ) : null}
            <blockquote className="mt-2 flex-1 text-sm leading-relaxed text-slate-700">“{t.quote}”</blockquote>
            <figcaption className="mt-4 flex items-center gap-3">
              {t.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- CMS photo
                <img src={t.photoUrl} alt="" loading="lazy" className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 font-bold text-blue-700">{t.studentName.charAt(0)}</span>
              )}
              <span>
                <span className="block text-sm font-semibold text-slate-900">{t.studentName}</span>
                <span className="block text-xs text-slate-500">{[t.studentClass, t.targetExam].filter(Boolean).join(" · ")}</span>
              </span>
            </figcaption>
          </figure>
        ))}
      </CardRail>
    </Section>
  );
}

export function TextImageSection({ head, body, imageUrl, imagePosition, ctaText, ctaUrl }: { head?: Head; body?: string; imageUrl?: string; imagePosition?: string; ctaText?: string; ctaUrl?: string }) {
  if (!head?.title && !body && !imageUrl) return null;
  const left = imagePosition === "left";
  return (
    <Section>
      <div className="grid items-center gap-8 lg:grid-cols-2">
        <div className={left ? "lg:order-2" : ""}>
          {head?.eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-600">{head.eyebrow}</p>}
          {head?.title && <h2 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">{head.title}</h2>}
          {head?.subtitle && <p className="mt-2 text-base font-medium text-slate-700">{head.subtitle}</p>}
          {body && <p className="mt-3 whitespace-pre-line text-base leading-relaxed text-slate-600">{body}</p>}
          {ctaText && ctaUrl && (
            <div className="mt-5">
              <ButtonLink href={ctaUrl} external={isExternal(ctaUrl)}>{ctaText}</ButtonLink>
            </div>
          )}
        </div>
        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- CMS image
          <img src={imageUrl} alt="" loading="lazy" decoding="async" className={`h-auto w-full rounded-2xl ${left ? "lg:order-1" : ""}`} />
        )}
      </div>
    </Section>
  );
}

export function CtaSection({ head, ctaText, ctaUrl }: { head?: Head; ctaText?: string; ctaUrl?: string }) {
  const title = head?.title || "Start learning today";
  const href = ctaUrl || "/register";
  return (
    <Section>
      <div className="flex flex-col items-center gap-4 rounded-3xl bg-gradient-to-br from-blue-600 to-blue-800 px-6 py-10 text-center text-white sm:py-14">
        {head?.eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-200">{head.eyebrow}</p>}
        <h2 className="max-w-2xl text-2xl sm:text-3xl font-bold tracking-tight">{title}</h2>
        {head?.subtitle && <p className="max-w-xl text-sm sm:text-base text-white/80">{head.subtitle}</p>}
        <ButtonLink href={href} variant="light" external={isExternal(href)}>
          {ctaText || "Start Learning Free"} <Icon name="arrow_forward" className="text-[18px]" />
        </ButtonLink>
      </div>
    </Section>
  );
}

export function StatisticsSection({ head, items }: { head?: Head; items: { value?: string; label?: string }[] }) {
  const rows = items.filter((x) => x.value && x.label);
  if (!rows.length) return null;
  return (
    <Section>
      <Header head={head} />
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {rows.map((x, i) => (
          <div key={i} className="rounded-2xl border border-slate-200/80 bg-white p-5 text-center">
            <dd className="text-3xl font-extrabold text-blue-700">{x.value}</dd>
            <dt className="mt-1 text-sm text-slate-600">{x.label}</dt>
          </div>
        ))}
      </dl>
    </Section>
  );
}

export function ContactSection({ head, phone, email, address }: { head?: Head; phone?: string; email?: string; address?: string }) {
  if (!phone && !email && !address) return null;
  const tel = phone?.replace(/[^\d+]/g, "");
  return (
    <Section tone="tint">
      <SectionHeader eyebrow={head?.eyebrow || "Contact"} title={head?.title || "Talk to us"} subtitle={head?.subtitle} />
      <ul className="grid gap-3 sm:grid-cols-3">
        {phone && (
          <li>
            <a href={`tel:${tel}`} className="flex h-full items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 hover:border-blue-200">
              <Icon name="call" className="text-[22px] text-blue-600" />
              <span className="text-sm font-semibold text-slate-900">{phone}</span>
            </a>
          </li>
        )}
        {email && (
          <li>
            <a href={`mailto:${email}`} className="flex h-full items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 hover:border-blue-200">
              <Icon name="mail" className="text-[22px] text-blue-600" />
              <span className="break-all text-sm font-semibold text-slate-900">{email}</span>
            </a>
          </li>
        )}
        {address && (
          <li className="flex h-full items-start gap-3 rounded-2xl border border-slate-200/80 bg-white p-4">
            <Icon name="location_on" className="text-[22px] text-blue-600" />
            <span className="whitespace-pre-line text-sm text-slate-700">{address}</span>
          </li>
        )}
      </ul>
    </Section>
  );
}
