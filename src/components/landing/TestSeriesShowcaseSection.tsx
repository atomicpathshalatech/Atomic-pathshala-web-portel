import Link from "next/link";
import { ScrollReveal } from "./ScrollReveal";

export function TestSeriesShowcaseSection() {
  return (
    <section className="py-stack-lg px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto space-y-10">
      <ScrollReveal>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-secondary/10 text-secondary border border-secondary/20">
                NTA CBT Standard &middot; Real-Time AIR Engine
              </span>
            </div>
            <h2 className="font-display-lg text-display-lg text-on-surface">
              All India <span className="text-gradient">Test Series &amp; Practice Arena</span>
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant max-w-2xl mt-1">
              Simulate actual NEET &amp; JEE examination conditions with proctored CBT tests, KaTeX formula solutions, and AI mistake diagnostic.
            </p>
          </div>
          <Link
            href="/tests"
            className="flex items-center gap-2 text-primary font-bold text-xs hover:underline group"
          >
            <span>Explore All Tests</span>
            <span className="material-symbols-outlined text-sm group-hover:translate-x-1 transition-transform">
              arrow_forward
            </span>
          </Link>
        </div>
      </ScrollReveal>

      {/* Feature Highlights Grid */}
      <ScrollReveal className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: NTA CBT Interface */}
        <div className="glass-card rounded-3xl p-6 border border-outline-variant/30 space-y-4 hover:border-primary/50 transition-all bg-surface-container-lowest flex flex-col justify-between">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">desktop_windows</span>
            </div>
            <h3 className="font-bold text-base text-on-surface">NTA CBT Standard Test Engine</h3>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Experience the exact exam screen with 5-state question palette, bilingual Hindi/English switcher, font-size zoom, and countdown autosave.
            </p>
          </div>
          <div className="pt-4 border-t border-outline-variant/20 flex items-center justify-between text-xs font-bold text-primary">
            <span>Bilingual Support</span>
            <span className="material-symbols-outlined text-sm">check_circle</span>
          </div>
        </div>

        {/* Card 2: KaTeX & Formula Solutions */}
        <div className="glass-card rounded-3xl p-6 border border-outline-variant/30 space-y-4 hover:border-secondary/50 transition-all bg-surface-container-lowest flex flex-col justify-between">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-secondary/10 text-secondary flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">functions</span>
            </div>
            <h3 className="font-bold text-base text-on-surface">KaTeX Math &amp; Chemistry Equations</h3>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Crystal-clear LaTeX rendering for physics derivations, organic reaction mechanisms, and step-by-step verified question solutions.
            </p>
          </div>
          <div className="pt-4 border-t border-outline-variant/20 flex items-center justify-between text-xs font-bold text-secondary">
            <span>Step-by-Step Explanations</span>
            <span className="material-symbols-outlined text-sm">check_circle</span>
          </div>
        </div>

        {/* Card 3: AIR Rank & Mistake Diagnostics */}
        <div className="glass-card rounded-3xl p-6 border border-outline-variant/30 space-y-4 hover:border-cyan-500/50 transition-all bg-surface-container-lowest flex flex-col justify-between">
          <div className="space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">analytics</span>
            </div>
            <h3 className="font-bold text-base text-on-surface">Real-Time AIR &amp; AI Analysis</h3>
            <p className="text-xs text-on-surface-variant leading-relaxed">
              Instant All-India Percentile, subject accuracy bars, speed benchmarking against batch toppers, and AI conceptual weakness diagnostics.
            </p>
          </div>
          <div className="pt-4 border-t border-outline-variant/20 flex items-center justify-between text-xs font-bold text-cyan-600">
            <span>Instant Scorecard</span>
            <span className="material-symbols-outlined text-sm">check_circle</span>
          </div>
        </div>
      </ScrollReveal>
    </section>
  );
}
