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
    card: "bg-white hover:bg-slate-50 border-slate-200/80 hover:border-blue-300 shadow-2xs hover:shadow-xs",
    iconCircle: "bg-blue-50 border border-blue-200/60 group-hover:scale-105",
    iconColor: "text-blue-600",
    badge: "bg-blue-50 text-blue-700 border border-blue-200",
  },
  teal: {
    card: "bg-white hover:bg-slate-50 border-slate-200/80 hover:border-teal-300 shadow-2xs hover:shadow-xs",
    iconCircle: "bg-teal-50 border border-teal-200/60 group-hover:scale-105",
    iconColor: "text-teal-600",
    badge: "bg-teal-50 text-teal-700 border border-teal-200",
  },
  purple: {
    card: "bg-white hover:bg-slate-50 border-slate-200/80 hover:border-purple-300 shadow-2xs hover:shadow-xs",
    iconCircle: "bg-purple-50 border border-purple-200/60 group-hover:scale-105",
    iconColor: "text-purple-600",
    badge: "bg-purple-50 text-purple-700 border border-purple-200",
  },
  orange: {
    card: "bg-white hover:bg-slate-50 border-slate-200/80 hover:border-orange-300 shadow-2xs hover:shadow-xs",
    iconCircle: "bg-orange-50 border border-orange-200/60 group-hover:scale-105",
    iconColor: "text-orange-600",
    badge: "bg-orange-50 text-orange-700 border border-orange-200",
  },
  rose: {
    card: "bg-white hover:bg-slate-50 border-slate-200/80 hover:border-rose-300 shadow-2xs hover:shadow-xs",
    iconCircle: "bg-rose-50 border border-rose-200/60 group-hover:scale-105",
    iconColor: "text-rose-600",
    badge: "bg-rose-50 text-rose-700 border border-rose-200",
  },
  red: {
    card: "bg-white hover:bg-slate-50 border-slate-200/80 hover:border-red-300 shadow-2xs hover:shadow-xs",
    iconCircle: "bg-red-50 border border-red-200/60 group-hover:scale-105",
    iconColor: "text-red-600",
    badge: "bg-red-50 text-red-700 border border-red-200",
  },
  green: {
    card: "bg-white hover:bg-slate-50 border-slate-200/80 hover:border-emerald-300 shadow-2xs hover:shadow-xs",
    iconCircle: "bg-emerald-50 border border-emerald-200/60 group-hover:scale-105",
    iconColor: "text-emerald-600",
    badge: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  },
  cyan: {
    card: "bg-white hover:bg-slate-50 border-slate-200/80 hover:border-cyan-300 shadow-2xs hover:shadow-xs",
    iconCircle: "bg-cyan-50 border border-cyan-200/60 group-hover:scale-105",
    iconColor: "text-cyan-600",
    badge: "bg-cyan-50 text-cyan-700 border border-cyan-200",
  },
  indigo: {
    card: "bg-white hover:bg-slate-50 border-slate-200/80 hover:border-indigo-300 shadow-2xs hover:shadow-xs",
    iconCircle: "bg-indigo-50 border border-indigo-200/60 group-hover:scale-105",
    iconColor: "text-indigo-600",
    badge: "bg-indigo-50 text-indigo-700 border border-indigo-200",
  },
  amber: {
    card: "bg-white hover:bg-slate-50 border-slate-200/80 hover:border-amber-300 shadow-2xs hover:shadow-xs",
    iconCircle: "bg-amber-50 border border-amber-200/60 group-hover:scale-105",
    iconColor: "text-amber-600",
    badge: "bg-amber-50 text-amber-700 border border-amber-200",
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
      className={`group relative rounded-xl p-3.5 sm:p-4 border transition-all duration-200 flex flex-col justify-between hover:shadow-xs active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-orange-500 ${styles.card}`}
    >
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center transition-transform duration-200 shrink-0 ${styles.iconCircle}`}
          >
            <span className={`material-symbols-outlined text-xl sm:text-2xl ${styles.iconColor}`}>
              {icon}
            </span>
          </div>

          {isLive ? (
            <span className="flex items-center gap-1 bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              Live Now
            </span>
          ) : contextText ? (
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold truncate max-w-[150px] ${styles.badge}`}>
              {contextText}
            </span>
          ) : null}
        </div>

        <div>
          <h3 className="font-bold text-sm sm:text-base text-slate-900 group-hover:text-orange-600 transition-colors leading-snug truncate">
            {title}
          </h3>
          <p className="text-[11px] sm:text-xs text-slate-500 line-clamp-1 sm:line-clamp-2 mt-0.5 leading-relaxed">
            {description}
          </p>
        </div>
      </div>

      <div className="pt-2.5 mt-2 flex items-center justify-between text-xs font-semibold text-slate-400 group-hover:text-orange-600 transition-colors border-t border-slate-100">
        <span>Explore</span>
        <span className="material-symbols-outlined text-sm transition-transform duration-200 group-hover:translate-x-1">
          arrow_forward
        </span>
      </div>
    </Link>
  );
}
