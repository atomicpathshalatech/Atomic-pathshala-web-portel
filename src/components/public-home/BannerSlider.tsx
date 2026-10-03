"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { HomeBanner } from "@/lib/public-home";
import { CONTAINER, Icon } from "./ui";

/**
 * Homepage banner slider — the ACTIVE banners from Team → Website → Banners
 * (16:9 images). Swipe / arrows / dots; auto-advances every 5s unless the
 * visitor prefers reduced motion, is hovering, or the tab is hidden.
 */
export function BannerSlider({ banners }: { banners: HomeBanner[] }) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = banners.length;

  const goTo = useCallback(
    (i: number) => {
      const el = trackRef.current;
      if (!el || !count) return;
      const next = (i + count) % count;
      el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
    },
    [count],
  );

  // Keep the dot in sync with manual swipes.
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const onScroll = () => setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (count < 2 || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setInterval(() => {
      if (document.visibilityState === "visible") goTo(index + 1);
    }, 5000);
    return () => window.clearInterval(t);
  }, [count, paused, index, goTo]);

  if (!count) return null;

  return (
    <section aria-label="Announcements" className="bg-white pt-2 sm:pt-4">
      <div className={CONTAINER}>
        <div className="relative" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
          <div ref={trackRef} className="flex snap-x snap-mandatory overflow-x-auto rounded-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {banners.map((b, i) => {
              const img = (
                <picture>
                  {b.mobileImageUrl && <source media="(max-width: 639px)" srcSet={b.mobileImageUrl} />}
                  {/* eslint-disable-next-line @next/next/no-img-element -- CMS banner from any host */}
                  <img
                    src={b.imageUrl}
                    alt={b.subtitle ? `${b.title} — ${b.subtitle}` : b.title}
                    width={1280}
                    height={720}
                    loading={i === 0 ? "eager" : "lazy"}
                    decoding="async"
                    className="aspect-video w-full bg-slate-100 object-cover"
                  />
                </picture>
              );
              return (
                <div key={b.id} className="w-full shrink-0 snap-start" aria-roledescription="slide" aria-label={`${i + 1} of ${count}`}>
                  {b.ctaUrl ? (
                    <a
                      href={b.ctaUrl}
                      {...(b.openInNewTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                      className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500"
                    >
                      {img}
                    </a>
                  ) : (
                    img
                  )}
                </div>
              );
            })}
          </div>

          {count > 1 && (
            <>
              <button
                type="button"
                onClick={() => goTo(index - 1)}
                aria-label="Previous banner"
                className="absolute left-2 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:flex"
              >
                <Icon name="chevron_left" className="text-[24px]" />
              </button>
              <button
                type="button"
                onClick={() => goTo(index + 1)}
                aria-label="Next banner"
                className="absolute right-2 top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 sm:flex"
              >
                <Icon name="chevron_right" className="text-[24px]" />
              </button>
              <div className="mt-3 flex justify-center gap-1.5">
                {banners.map((b, i) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => goTo(i)}
                    aria-label={`Show banner ${i + 1}`}
                    aria-current={i === index}
                    className="flex h-6 items-center justify-center px-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                  >
                    <span className={`block h-2 rounded-full transition-all ${i === index ? "w-6 bg-blue-600" : "w-2 bg-slate-300"}`} />
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
