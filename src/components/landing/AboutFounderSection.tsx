import Link from "next/link";
import { getActiveFounder } from "@/lib/founder";

/**
 * Concise homepage "About the Founder" block. Renders real HTML text (never
 * text-in-an-image) with a proper H2, and links to the dedicated
 * /about-founder page for the full profile + its own crawlable metadata.
 * Returns null when no founder is marked active — the homepage simply omits
 * the section rather than showing anything broken.
 */
export async function AboutFounderSection() {
  const founder = await getActiveFounder();
  if (!founder || (!founder.name && !founder.shortBio)) return null;

  return (
    <section aria-labelledby="about-founder-heading" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-10 grid gap-8 md:grid-cols-[220px_1fr] md:items-center">
        <div className="mx-auto md:mx-0">
          {founder.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={founder.photoUrl}
              alt={founder.name ? `${founder.name}, ${founder.designation || "Founder"} of Atomic Pathshala` : "Founder of Atomic Pathshala"}
              width={220}
              height={220}
              loading="lazy"
              decoding="async"
              className="w-40 h-40 md:w-[220px] md:h-[220px] rounded-2xl object-cover border border-slate-200"
            />
          ) : (
            <div className="w-40 h-40 md:w-[220px] md:h-[220px] rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-700 text-5xl font-black">
              {(founder.name || "A").charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-blue-700">About the Founder</p>
          <h2 id="about-founder-heading" className="mt-1 text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            {founder.name || "Our Founder"}
          </h2>
          {founder.designation && (
            <p className="mt-1 text-sm font-semibold text-slate-500">{founder.designation}</p>
          )}
          {founder.shortBio && (
            <p className="mt-4 text-sm sm:text-base leading-relaxed text-slate-600 max-w-2xl">
              {founder.shortBio}
            </p>
          )}
          <Link
            href="/about-founder"
            className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-blue-700 hover:text-blue-800"
          >
            Read the full story
            <span aria-hidden className="material-symbols-outlined text-base">arrow_forward</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
