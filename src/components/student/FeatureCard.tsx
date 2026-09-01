import Link from "next/link";

export type FeatureTheme =
  | "blue"
  | "teal"
  | "purple"
  | "orange"
  | "rose"
  | "red"
  | "green"
  | "cyan"
  | "indigo"
  | "amber";

const THEME_STYLES: Record<
  FeatureTheme,
  {
    card: string;
    iconCircle: string;
    iconColor: string;
    badge: string;
  }
> = {
  blue: {
    card: "bg-blue-50/60 hover:bg-blue-50/90 border-blue-200/60 hover:border-blue-400/80 dark:bg-blue-950/20 dark:hover:bg-blue-950/40 dark:border-blue-800/40",
    iconCircle: "bg-blue-100 dark:bg-blue-900/50 group-hover:scale-105",
    iconColor: "text-blue-600 dark:text-blue-400",
    badge: "bg-blue-100/80 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  },
  teal: {
    card: "bg-teal-50/60 hover:bg-teal-50/90 border-teal-200/60 hover:border-teal-400/80 dark:bg-teal-950/20 dark:hover:bg-teal-950/40 dark:border-teal-800/40",
    iconCircle: "bg-teal-100 dark:bg-teal-900/50 group-hover:scale-105",
    iconColor: "text-teal-600 dark:text-teal-400",
    badge: "bg-teal-100/80 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300",
  },
  purple: {
    card: "bg-purple-50/70 hover:bg-purple-50/95 border-purple-200/70 hover:border-purple-400/90 dark:bg-purple-950/25 dark:hover:bg-purple-950/45 dark:border-purple-800/50 shadow-sm",
    iconCircle: "bg-purple-100 dark:bg-purple-900/60 group-hover:scale-105 shadow-sm",
    iconColor: "text-purple-600 dark:text-purple-400",
    badge: "bg-purple-100/90 text-purple-700 dark:bg-purple-900/60 dark:text-purple-300",
  },
  orange: {
    card: "bg-amber-50/60 hover:bg-amber-50/90 border-amber-200/60 hover:border-amber-400/80 dark:bg-amber-950/20 dark:hover:bg-amber-950/40 dark:border-amber-800/40",
    iconCircle: "bg-amber-100 dark:bg-amber-900/50 group-hover:scale-105",
    iconColor: "text-amber-600 dark:text-amber-400",
    badge: "bg-amber-100/80 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  },
  rose: {
    card: "bg-rose-50/60 hover:bg-rose-50/90 border-rose-200/60 hover:border-rose-400/80 dark:bg-rose-950/20 dark:hover:bg-rose-950/40 dark:border-rose-800/40",
    iconCircle: "bg-rose-100 dark:bg-rose-900/50 group-hover:scale-105",
    iconColor: "text-rose-600 dark:text-rose-400",
    badge: "bg-rose-100/80 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300",
  },
  red: {
    card: "bg-red-50/60 hover:bg-red-50/90 border-red-200/60 hover:border-red-400/80 dark:bg-red-950/20 dark:hover:bg-red-950/40 dark:border-red-800/40",
    iconCircle: "bg-red-100 dark:bg-red-900/50 group-hover:scale-105",
    iconColor: "text-red-600 dark:text-red-400",
    badge: "bg-red-100/80 text-red-700 dark:bg-red-900/50 dark:text-red-300",
  },
  green: {
    card: "bg-emerald-50/60 hover:bg-emerald-50/90 border-emerald-200/60 hover:border-emerald-400/80 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/40 dark:border-emerald-800/40",
    iconCircle: "bg-emerald-100 dark:bg-emerald-900/50 group-hover:scale-105",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    badge: "bg-emerald-100/80 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
  },
  cyan: {
    card: "bg-cyan-50/60 hover:bg-cyan-50/90 border-cyan-200/60 hover:border-cyan-400/80 dark:bg-cyan-950/20 dark:hover:bg-cyan-950/40 dark:border-cyan-800/40",
    iconCircle: "bg-cyan-100 dark:bg-cyan-900/50 group-hover:scale-105",
    iconColor: "text-cyan-600 dark:text-cyan-400",
    badge: "bg-cyan-100/80 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300",
  },
  indigo: {
    card: "bg-indigo-50/60 hover:bg-indigo-50/90 border-indigo-200/60 hover:border-indigo-400/80 dark:bg-indigo-950/20 dark:hover:bg-indigo-950/40 dark:border-indigo-800/40",
    iconCircle: "bg-indigo-100 dark:bg-indigo-900/50 group-hover:scale-105",
    iconColor: "text-indigo-600 dark:text-indigo-400",
    badge: "bg-indigo-100/80 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300",
  },
  amber: {
    card: "bg-yellow-50/60 hover:bg-yellow-50/90 border-yellow-200/60 hover:border-yellow-400/80 dark:bg-yellow-950/20 dark:hover:bg-yellow-950/40 dark:border-yellow-800/40",
    iconCircle: "bg-yellow-100 dark:bg-yellow-900/50 group-hover:scale-105",
    iconColor: "text-yellow-700 dark:text-yellow-400",
    badge: "bg-yellow-100/80 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300",
  },
};

export type FeatureCardProps = {
  title: string;
  description: string;
  icon: string;
  theme: FeatureTheme;
  href: string;
  contextText?: string | null;
  isLive?: boolean;
};

export function FeatureCard({
  title,
  description,
  icon,
  theme,
  href,
  contextText,
  isLive,
}: FeatureCardProps) {
  const styles = THEME_STYLES[theme] || THEME_STYLES.blue;

  return (
    <Link
      href={href}
      className={`group relative rounded-2xl p-5 md:p-6 border transition-all duration-200 flex flex-col justify-between hover:-translate-y-1 hover:shadow-md active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-primary ${styles.card}`}
    >
      <div className="space-y-3.5">
        <div className="flex items-center justify-between gap-2">
          <div
            className={`w-11 h-11 md:w-12 md:h-12 rounded-xl flex items-center justify-center transition-transform duration-200 ${styles.iconCircle}`}
          >
            <span className={`material-symbols-outlined text-2xl md:text-3xl ${styles.iconColor}`}>
              {icon}
            </span>
          </div>

          {isLive ? (
            <span className="flex items-center gap-1.5 bg-error/15 text-error px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-error" />
              Live Now
            </span>
          ) : contextText ? (
            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold truncate max-w-[150px] ${styles.badge}`}>
              {contextText}
            </span>
          ) : null}
        </div>

        <div>
          <h3 className="font-bold text-base md:text-lg text-on-surface group-hover:text-primary transition-colors leading-snug">
            {title}
          </h3>
          <p className="text-xs md:text-[13px] text-on-surface-variant line-clamp-2 mt-1 leading-relaxed">
            {description}
          </p>
        </div>
      </div>

      <div className="pt-4 mt-2 flex items-center justify-between text-xs font-semibold text-on-surface-variant group-hover:text-primary transition-colors border-t border-outline-variant/15">
        <span>Explore</span>
        <span className="material-symbols-outlined text-sm transition-transform duration-200 group-hover:translate-x-1">
          arrow_forward
        </span>
      </div>
    </Link>
  );
}
