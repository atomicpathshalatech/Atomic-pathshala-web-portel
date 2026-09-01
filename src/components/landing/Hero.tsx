import Link from "next/link";
import { HeroShaderCanvas } from "./HeroShaderCanvas";

export function Hero() {
  return (
    <section className="relative px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto py-stack-lg min-h-[80vh] flex flex-col md:flex-row items-center gap-12">
      <HeroShaderCanvas />

      <div className="flex-1 space-y-stack-md z-10">
        <span className="inline-block bg-primary-container/10 text-primary font-label-md text-label-md px-4 py-1.5 rounded-full mb-4">
          India&apos;s Premium Accelerator for NEET &amp; JEE
        </span>
        <h1 className="font-display-lg text-display-lg leading-tight">
          Accelerate Your Learning with{" "}
          <span className="text-gradient">Atomic Excellence</span>
        </h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant max-w-xl">
          Master competitive exams like NEET, JEE, and Foundation courses with
          structured learning paths, top-tier faculty, and performance-driven
          results.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 pt-4">
          <Link
            href="/register"
            className="bg-primary text-on-primary font-label-md text-label-md px-8 py-4 rounded-xl hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg"
          >
            Start Learning{" "}
            <span className="material-symbols-outlined">arrow_forward</span>
          </Link>
          <Link
            href="#batches"
            className="border-2 border-primary text-primary font-label-md text-label-md px-8 py-4 rounded-xl hover:bg-primary/5 active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            Explore Courses
          </Link>
        </div>

        <div className="flex items-center gap-6 pt-8 border-t border-outline-variant/30">
          <div className="flex -space-x-3">
            <div className="w-10 h-10 rounded-full border-2 border-surface bg-surface-container-highest overflow-hidden">
              <img
                className="w-full h-full object-cover"
                alt="Student"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCXUElFwCl3CRo7YlUoH2Xaz7YdKSK3p4Ul3fgFH1gKlS5BmBR4UEJ56KZJaC4ZJ0-J2mK9Bytq9E3Y4k0hpRjm6nLYWLTHAwcmB_aGMYHrZLwmJiJ2ollC5LdjkGoaw1_SiwrFyCCf5xjdjn274jQnZ2Kf_zUbYxn5yih4W6iYNAhJ0y0MsMLZ0-3COHKrRY9ltkz5ZOJ1v5IjIfN3I-w477qxsgdMsu-iFO09Xh4mbCnKpMOqtNB9rNl3KfGAZrIVgNEYBm1M-8o"
              />
            </div>
            <div className="w-10 h-10 rounded-full border-2 border-surface bg-surface-container-highest overflow-hidden">
              <img
                className="w-full h-full object-cover"
                alt="Student"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuDMb72NzVy8f_q3SJcAJbHXIL__CeOIXkzxgoecSjFtfA06nlduPLzp9tQVBSA8QnLaDIOd0GhqWjUc0Hscv9AH6r7VGKd_DvcKjKN3fHNpVMazA1HfWw2DKIjjzIWKBeI9Z7WAfRDvfFVZ7A5npFLISfw71C2ulW3PwyN0xMNzf7Nf_55ovekjVjTrCsxpf65pwb4QGpRLuTzjT9uJYjBeK85xVwbZbycnAsiOXx-e7A46XgxCTDbnaQDBS3Q1DMeLNTid5xGUaBU"
              />
            </div>
            <div className="w-10 h-10 rounded-full border-2 border-surface bg-primary flex items-center justify-center text-on-primary text-[10px] font-bold">
              10k+
            </div>
          </div>
          <p className="text-label-sm font-label-sm text-on-surface-variant">
            Trusted by 10,000+ students nationwide
          </p>
        </div>
      </div>

      <div className="flex-1 relative w-full aspect-square md:aspect-auto h-full min-h-[400px]">
        <div className="absolute inset-0 bg-primary/5 rounded-full blur-3xl opacity-50" />
        <div className="relative w-full h-full glass-card rounded-[2rem] overflow-hidden flex items-center justify-center shadow-2xl border-4 border-white animate-float">
          <img
            className="w-full h-full object-cover"
            alt="Futuristic student workspace with holographic display"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuAaQQ0fnM9PKiQWi5v5_MOIfPmgCNiTg-MiHXd1KsOR24RT276XjDKGDzklyuDOEYKW68XZzdT8LtQh4mr8y0gdM1deJiK3iRZQUuBUPxOBe31de9ZvD8Q8BPzosmFrTFgqpfSGIVO9K7rykSeP1eF4ZpZZEt3kd3eA79ncDLv_gPLEBVi9umauPRsnvVlVPguRv8x6Ua2ZpUHxTlx-GsAPeIpU8m7B5rfr7VBYvp2YCDkBGOE_1XDoQGa5LyUR0yMJh3-7LJh_Vuo"
          />
        </div>

        <div className="absolute -bottom-6 -left-6 glass-card p-6 rounded-2xl shadow-xl z-20 flex items-center gap-4">
          <div className="w-12 h-12 bg-secondary-container/20 rounded-full flex items-center justify-center text-secondary">
            <span className="material-symbols-outlined">trending_up</span>
          </div>
          <div>
            <div className="font-headline-md text-headline-md text-primary">98.5%</div>
            <div className="text-label-sm font-label-sm text-on-surface-variant">
              Success Rate
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
