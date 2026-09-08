import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/landing/Navbar";
import { Footer } from "@/components/landing/Footer";
import { getActiveFounder, parseFounderSocialLinks } from "@/lib/founder";

const SITE = process.env.APP_BASE_URL || "https://atomicpathshala.com";

export async function generateMetadata(): Promise<Metadata> {
  const founder = await getActiveFounder();
  if (!founder) {
    return { title: "About the Founder", robots: { index: false, follow: true } };
  }
  const title =
    founder.seoTitle ||
    (founder.name ? `${founder.name} — Founder of Atomic Pathshala` : "About the Founder — Atomic Pathshala");
  const description =
    founder.metaDescription || founder.shortBio || `${founder.name}, ${founder.designation || "Founder"} of Atomic Pathshala.`;
  const canonical = founder.canonicalUrl || `${SITE.replace(/\/$/, "")}/about-founder`;
  const ogImage = founder.ogImageUrl || founder.photoUrl || undefined;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "profile",
      images: ogImage ? [{ url: ogImage }] : undefined,
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

function Para({ text }: { text: string }) {
  return (
    <>
      {text
        .split(/\n+/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p, i) => (
          <p key={i} className="mt-3 first:mt-0 leading-relaxed text-slate-700">
            {p}
          </p>
        ))}
    </>
  );
}

export default async function AboutFounderPage() {
  const founder = await getActiveFounder();
  if (!founder || (!founder.name && !founder.biography && !founder.shortBio)) notFound();

  const links = parseFounderSocialLinks(founder.socialLinks);
  const canonical = founder.canonicalUrl || `${SITE.replace(/\/$/, "")}/about-founder`;

  // JSON-LD built ONLY from admin-entered values — no fabricated awards,
  // ratings, qualifications or affiliations.
  const personLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: founder.name || undefined,
    jobTitle: founder.designation || undefined,
    description: founder.shortBio || founder.metaDescription || undefined,
    image: founder.photoUrl || undefined,
    url: canonical,
    worksFor: { "@type": "Organization", name: "Atomic Pathshala", url: SITE },
    ...(links.length ? { sameAs: links.map((l) => l.url) } : {}),
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE },
      { "@type": "ListItem", position: 2, name: "About the Founder", item: canonical },
    ],
  };

  const sections: { heading: string; body: string }[] = [
    { heading: "Biography", body: founder.biography },
    { heading: "Education & background", body: founder.education },
    { heading: "Teaching experience", body: founder.experience },
    { heading: "Teaching philosophy", body: founder.teachingPhilosophy },
    { heading: "Vision for Atomic Pathshala", body: founder.vision },
    { heading: "A message from the founder", body: founder.founderMessage },
  ].filter((s) => s.body && s.body.trim());

  return (
    <>
      <Navbar />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify([personLd, breadcrumbLd]) }}
      />
      <main className="pt-20 md:pt-24 pb-16 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav aria-label="Breadcrumb" className="text-xs font-semibold text-slate-500">
          <Link href="/" className="hover:text-blue-700">Home</Link>
          <span className="mx-1.5">/</span>
          <span className="text-slate-700">About the Founder</span>
        </nav>

        <header className="mt-6 flex flex-col sm:flex-row sm:items-center gap-5">
          {founder.photoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={founder.photoUrl}
              alt={`${founder.name || "Founder"}${founder.designation ? `, ${founder.designation}` : ""}`}
              width={140}
              height={140}
              decoding="async"
              className="w-28 h-28 sm:w-[140px] sm:h-[140px] rounded-2xl object-cover border border-slate-200 shrink-0"
            />
          )}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-blue-700">About the Founder</p>
            <h1 className="mt-1 text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
              {founder.name || "Our Founder"}
            </h1>
            {founder.designation && (
              <p className="mt-1.5 text-sm font-semibold text-slate-500">{founder.designation}</p>
            )}
          </div>
        </header>

        {founder.shortBio && (
          <p className="mt-6 text-lg leading-relaxed text-slate-700">{founder.shortBio}</p>
        )}

        {sections.map((s) => (
          <section key={s.heading} className="mt-10">
            <h2 className="text-xl font-bold text-slate-900">{s.heading}</h2>
            <div className="mt-2 text-slate-700">
              <Para text={s.body} />
            </div>
          </section>
        ))}

        {links.length > 0 && (
          <section className="mt-10">
            <h2 className="text-xl font-bold text-slate-900">Profiles</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {links.map((l) => (
                <li key={l.url}>
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-sm font-semibold text-blue-700 hover:border-blue-300"
                  >
                    {l.label}
                    <span aria-hidden className="material-symbols-outlined text-sm">open_in_new</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="mt-12">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-blue-700 hover:text-blue-800"
          >
            <span aria-hidden className="material-symbols-outlined text-base">arrow_back</span>
            Back to home
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
