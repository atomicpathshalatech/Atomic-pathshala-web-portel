import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Small design system for the public homepage only (the signed-in app keeps
 * its own components). Blue = primary, navy = text / dark surfaces, cyan =
 * accent, a little orange only for highlights.
 */

/** Admin-editable section heading (Website Builder); blank fields keep the default. */
export type Head = { eyebrow?: string; title?: string; subtitle?: string };
export function hd(h: Head | undefined, d: { eyebrow?: string; title: string; subtitle?: string }) {
  return { eyebrow: h?.eyebrow || d.eyebrow, title: h?.title || d.title, subtitle: h?.subtitle || d.subtitle };
}

export const CONTAINER = "mx-auto w-full max-w-6xl px-4 sm:px-6";

export function Section({
  id,
  children,
  className = "",
  tone = "white",
  style,
  dark,
  padding,
}: {
  id?: string;
  children: ReactNode;
  className?: string;
  tone?: "white" | "tint" | "gray" | "navy" | "dark" | "blue" | "indigo" | "gradient" | "gradient-light" | "custom" | string;
  style?: React.CSSProperties;
  dark?: boolean;
  padding?: "normal" | "compact" | "spacious" | "none" | string;
}) {
  let bg = "bg-white";
  if (tone === "tint" || tone === "gray" || tone === "slate") bg = "bg-slate-50";
  else if (tone === "navy" || tone === "dark") bg = "bg-[#0b1736] text-white";
  else if (tone === "blue") bg = "bg-blue-50/60 text-slate-900";
  else if (tone === "indigo") bg = "bg-indigo-50/60 text-slate-900";
  else if (tone === "gradient") bg = "bg-gradient-to-br from-[#0b1736] via-[#1e3a8a] to-[#0f172a] text-white";
  else if (tone === "gradient-light") bg = "bg-gradient-to-b from-blue-50/70 via-white to-white";
  else if (tone === "custom" || (typeof tone === "string" && (tone.startsWith("#") || tone.startsWith("rgb")))) {
    bg = "";
  }

  const isDark = dark || tone === "navy" || tone === "dark" || tone === "gradient";

  const py =
    padding === "compact"
      ? "py-6 sm:py-8"
      : padding === "spacious"
      ? "py-20 sm:py-28"
      : padding === "none"
      ? "py-0"
      : "py-12 sm:py-16";

  const customStyle: React.CSSProperties = {
    ...style,
    ...(typeof tone === "string" && (tone.startsWith("#") || tone.startsWith("rgb")) ? { backgroundColor: tone } : {}),
  };

  return (
    <section id={id} style={customStyle} className={`${bg} ${isDark ? "text-white" : ""} ${py} scroll-mt-20 ${className}`}>
      <div className={CONTAINER}>{children}</div>
    </section>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  subtitle,
  action,
  dark = false,
  align = "left",
  accentColor,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  dark?: boolean;
  align?: "left" | "center";
  accentColor?: string;
}) {
  const isCenter = align === "center";
  return (
    <div className={`mb-6 sm:mb-8 flex flex-col gap-3 ${isCenter ? "items-center text-center mx-auto" : "sm:flex-row sm:items-end sm:justify-between"}`}>
      <div className={isCenter ? "max-w-3xl mx-auto" : "max-w-2xl"}>
        {eyebrow && (
          <p
            style={accentColor ? { color: accentColor } : undefined}
            className={`text-xs font-semibold uppercase tracking-[0.14em] ${
              accentColor ? "" : dark ? "text-cyan-300" : "text-blue-600"
            }`}
          >
            {eyebrow}
          </p>
        )}
        <h2 className={`mt-1 text-2xl sm:text-3xl font-bold tracking-tight ${dark ? "text-white" : "text-slate-900"}`}>{title}</h2>
        {subtitle && <p className={`mt-2 text-sm sm:text-base ${dark ? "text-slate-300" : "text-slate-600"}`}>{subtitle}</p>}
      </div>
      {action && <div className={isCenter ? "mt-2" : "shrink-0"}>{action}</div>}
    </div>
  );
}

export function Icon({ name, className = "" }: { name: string; className?: string }) {
  return (
    <span aria-hidden="true" className={`material-symbols-outlined leading-none ${className}`}>
      {name}
    </span>
  );
}

const BTN_BASE =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 active:scale-[0.98]";

export function ButtonLink({ href, children, variant = "primary", external = false, className = "" }: { href: string; children: ReactNode; variant?: "primary" | "secondary" | "ghost" | "light"; external?: boolean; className?: string }) {
  const styles = {
    primary: "bg-blue-600 text-white shadow-sm shadow-blue-600/20 hover:bg-blue-700",
    secondary: "bg-white text-slate-900 ring-1 ring-slate-200 hover:ring-blue-300 hover:text-blue-700",
    ghost: "text-blue-700 hover:bg-blue-50",
    light: "bg-white text-[#0b1736] hover:bg-blue-50",
  }[variant];
  const cls = `${BTN_BASE} ${styles} ${className}`;
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
      {children}
    </a>
  ) : (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}

const TONES: Record<string, string> = {
  blue: "bg-blue-50 text-blue-700",
  cyan: "bg-cyan-50 text-cyan-700",
  navy: "bg-slate-100 text-[#0b1736]",
  orange: "bg-orange-50 text-orange-600",
  green: "bg-emerald-50 text-emerald-700",
  violet: "bg-violet-50 text-violet-700",
};

/** A clickable resource card: icon, title, one line, and a quiet CTA. */
export function ResourceCard({ href, icon, title, text, cta, tone = "blue", meta, external = false }: { href: string; icon: string; title: string; text: string; cta: string; tone?: keyof typeof TONES | string; meta?: string; external?: boolean }) {
  const inner = (
    <>
      <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${TONES[tone] ?? TONES.blue}`}>
        <Icon name={icon} className="text-[22px]" />
      </span>
      <span className="mt-3 block text-[15px] font-semibold text-slate-900">{title}</span>
      <span className="mt-1 block text-[13px] leading-snug text-slate-600">{text}</span>
      {meta && <span className="mt-2 block text-xs font-medium text-slate-500">{meta}</span>}
      <span className="mt-auto pt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-blue-700">
        {cta}
        <Icon name="arrow_forward" className="text-[16px] transition-transform group-hover:translate-x-0.5" />
      </span>
    </>
  );
  const cls =
    "group flex h-full flex-col rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_8px_24px_-12px_rgba(30,64,175,0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 motion-reduce:transform-none";
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>
      {inner}
    </a>
  ) : (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  );
}

/** Horizontal scroll on phones, a grid from `sm`. */
export function CardRail({ children, cols = "sm:grid-cols-2 lg:grid-cols-4" }: { children: ReactNode; cols?: string }) {
  return (
    <div className={`-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:scroll-px-0 sm:grid sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 ${cols} [&>*]:w-[72%] [&>*]:shrink-0 [&>*]:snap-start sm:[&>*]:w-auto`}>
      {children}
    </div>
  );
}

export const fmtCount = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k+` : String(n));
export const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
