import Link from "next/link";

/**
 * Kept as a union for source compatibility with the ~12 call sites that
 * still pass `theme="teal"` etc. Per the global color system every tile now
 * renders the SAME minimal treatment — white card, blue icon, dark heading,
 * neutral description — instead of a different bright colour per tile.
 */
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

export type FeatureCardProps = {
  title: string;
  description: string;
  icon: string;
  theme?: FeatureTheme;
  href: string;
  contextText?: string | null;
  isLive?: boolean;
};

export function FeatureCard({
  title,
  description,
  icon,
  href,
  contextText,
  isLive,
}: FeatureCardProps) {
  return (
    <Link
      href={href}
      className="group relative rounded-xl p-3.5 sm:p-4 border border-slate-200/80 bg-white transition-all duration-200 flex flex-col justify-between hover:border-blue-300 hover:shadow-xs active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-blue-600"
    >
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center transition-transform duration-200 shrink-0 bg-blue-50 border border-blue-200/60 group-hover:scale-105">
            <span className="material-symbols-outlined text-xl sm:text-2xl text-blue-600">
              {icon}
            </span>
          </div>

          {isLive ? (
            <span className="flex items-center gap-1 bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              Live Now
            </span>
          ) : contextText ? (
            <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold truncate max-w-[150px] bg-slate-100 text-slate-600 border border-slate-200">
              {contextText}
            </span>
          ) : null}
        </div>

        <div>
          <h3 className="font-bold text-sm sm:text-base text-slate-900 group-hover:text-blue-700 transition-colors leading-snug truncate">
            {title}
          </h3>
          <p className="text-[11px] sm:text-xs text-slate-500 line-clamp-1 sm:line-clamp-2 mt-0.5 leading-relaxed">
            {description}
          </p>
        </div>
      </div>

      <div className="pt-2.5 mt-2 flex items-center justify-between text-xs font-semibold text-slate-400 group-hover:text-blue-700 transition-colors border-t border-slate-100">
        <span>Explore</span>
        <span className="material-symbols-outlined text-sm transition-transform duration-200 group-hover:translate-x-1">
          arrow_forward
        </span>
      </div>
    </Link>
  );
}
