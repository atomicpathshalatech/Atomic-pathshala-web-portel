import Link from "next/link";
import { getActiveBanner } from "@/lib/homepage";

const DEFAULT_BG =
  "https://www.gstatic.com/labs-code/stitch/stitch-placeholder-300x300.svg";

export async function PromoBanner() {
  const banner = await getActiveBanner();

  const bg = banner?.imageUrl || DEFAULT_BG;
  const heading = banner?.title || "Unlock Your Potential with Our Advanced JEE/NEET Test Series";
  const sub =
    banner?.subtitle ||
    "Get 50% off on all Pro plans this week. Use code ATOMIC50";
  const primaryCta = banner?.ctaText || "Get Started";
  const primaryHref = banner?.ctaUrl || "/register";
  const newTab = banner?.openInNewTab ?? false;

  return (
    <section className="relative w-full py-stack-lg px-margin-mobile md:px-margin-desktop overflow-hidden">
      <div className="max-w-container-max mx-auto relative min-h-[400px] flex items-center justify-center rounded-xl overflow-hidden">
        <div className="absolute inset-0 z-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt=""
            aria-hidden="true"
            className="w-full h-full object-cover"
            src={bg}
            loading="lazy"
            decoding="async"
          />
          <div className="absolute inset-0 bg-primary/20 backdrop-blur-[2px]" />
        </div>

        <div className="relative z-10 glass-card p-8 md:p-12 rounded-xl max-w-3xl text-center space-y-6 border-white/20">
          <h2 className="font-display-lg text-display-lg text-primary leading-tight">{heading}</h2>
          <p className="font-body-lg text-body-lg text-on-surface-variant whitespace-pre-line">{sub}</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link
              href={primaryHref}
              {...(newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              className="bg-primary text-on-primary font-label-md text-label-md px-8 py-4 rounded-xl hover:opacity-90 transition-all shadow-lg w-full sm:w-auto"
            >
              {primaryCta}
            </Link>
            <Link
              href="/courses"
              className="border-2 border-primary text-primary font-label-md text-label-md px-8 py-4 rounded-xl hover:bg-primary/5 transition-all w-full sm:w-auto"
            >
              View Plans
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
