"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";

export interface StudentBanner {
  id: string;
  title: string;
  subtitle?: string | null;
  imageUrl: string;
  ctaUrl?: string | null;
  ctaText?: string | null;
  openInNewTab?: boolean;
}

const DEFAULT_BANNERS: StudentBanner[] = [
  {
    id: "default-1",
    title: "NEET & JEE Intensive Mastery",
    subtitle: "Daily Live Interactive Classes & NCERT Page-by-Page Practice",
    imageUrl: "https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=1280&q=80",
    ctaUrl: "/courses",
    ctaText: "Explore Batches",
  },
  {
    id: "default-2",
    title: "NCERT Chapter-Wise Question Practice",
    subtitle: "Direct page locked NCERT practice with detailed solutions",
    imageUrl: "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=1280&q=80",
    ctaUrl: "/practice/ncert",
    ctaText: "Start Practice",
  },
  {
    id: "default-3",
    title: "All India NEET Mock Test Series",
    subtitle: "Real NTA Pattern with Instant AI Performance Analytics",
    imageUrl: "https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?auto=format&fit=crop&w=1280&q=80",
    ctaUrl: "/tests",
    ctaText: "Attempt Test",
  },
];

export function StudentBannerCarousel({ banners }: { banners: StudentBanner[] }) {
  const activeBanners = banners && banners.length > 0 ? banners : DEFAULT_BANNERS;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const total = activeBanners.length;

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % total);
  }, [total]);

  const prevSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + total) % total);
  }, [total]);

  useEffect(() => {
    if (isPaused || total <= 1) return;
    const interval = setInterval(nextSlide, 5000);
    return () => clearInterval(interval);
  }, [isPaused, total, nextSlide]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current === null || touchEndX.current === null) return;
    const diff = touchStartX.current - touchEndX.current;
    if (diff > 50) nextSlide();
    else if (diff < -50) prevSlide();
    touchStartX.current = null;
    touchEndX.current = null;
  };

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl bg-slate-900 shadow-md group"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* 16:9 Aspect Ratio Container that strictly fits within width */}
      <div className="relative w-full aspect-video overflow-hidden">
        {activeBanners.map((banner, index) => {
          const isActive = index === currentIndex;
          const content = (
            <div className="relative w-full h-full select-none cursor-pointer">
              <img
                src={banner.imageUrl}
                alt={banner.title}
                className="w-full h-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
                loading={index === 0 ? "eager" : "lazy"}
              />
              {/* Gradient Overlay for Readability */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent flex flex-col justify-end p-4 sm:p-6 md:p-8 text-white">
                {banner.subtitle && (
                  <span className="inline-flex items-center gap-1.5 w-fit rounded-full bg-amber-500/90 backdrop-blur-sm px-2.5 py-0.5 text-[10px] sm:text-xs font-bold text-slate-950 uppercase tracking-wider mb-1.5 sm:mb-2">
                    <Sparkles className="w-3 h-3" />
                    {banner.subtitle}
                  </span>
                )}
                <h3 className="text-base sm:text-xl md:text-2xl font-extrabold leading-tight text-white drop-shadow-sm line-clamp-2">
                  {banner.title}
                </h3>
                {banner.ctaText && (
                  <div className="mt-2 sm:mt-3">
                    <span className="inline-flex items-center gap-1 rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-slate-900 shadow-sm transition hover:bg-slate-100">
                      {banner.ctaText}
                      <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                )}
              </div>
            </div>
          );

          return (
            <div
              key={banner.id || index}
              className={`absolute inset-0 transition-opacity duration-500 ease-in-out ${
                isActive ? "opacity-100 z-10 pointer-events-auto" : "opacity-0 z-0 pointer-events-none"
              }`}
            >
              {banner.ctaUrl ? (
                banner.openInNewTab ? (
                  <a href={banner.ctaUrl} target="_blank" rel="noopener noreferrer">
                    {content}
                  </a>
                ) : (
                  <Link href={banner.ctaUrl}>{content}</Link>
                )
              ) : (
                content
              )}
            </div>
          );
        })}
      </div>

      {/* Left Navigation Arrow */}
      {total > 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            prevSlide();
          }}
          className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 z-20 flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-all hover:bg-black/70 hover:scale-110 active:scale-95 opacity-80 group-hover:opacity-100"
          aria-label="Previous banner"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}

      {/* Right Navigation Arrow */}
      {total > 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            nextSlide();
          }}
          className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 z-20 flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-sm transition-all hover:bg-black/70 hover:scale-110 active:scale-95 opacity-80 group-hover:opacity-100"
          aria-label="Next banner"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      )}

      {/* Pagination Dots */}
      {total > 1 && (
        <div className="absolute bottom-2.5 sm:bottom-3.5 right-4 z-20 flex items-center gap-1.5">
          {activeBanners.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setCurrentIndex(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === currentIndex ? "w-5 bg-amber-400" : "w-1.5 bg-white/50 hover:bg-white/80"
              }`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
