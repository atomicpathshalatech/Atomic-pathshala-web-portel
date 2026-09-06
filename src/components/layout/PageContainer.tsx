import type { ReactNode } from "react";

/**
 * The app's single page-width container.
 *
 * Before this, 61 pages each declared their own wrapper and eight different
 * max-widths were in circulation (`max-w-7xl`, `6xl`, `5xl`, `4xl`, `3xl`,
 * `2xl`, `container-max`, ...), so the same content sat at a different width
 * on nearly every route, and the two shells disagreed as well: TeamShell had
 * no max-width at all (content stretched edge-to-edge on a 2560px monitor)
 * while StudentShell capped at 1280px.
 *
 * Padding scales with the viewport instead of jumping from 20px straight to
 * 64px at `md`, which previously cost 128px of a 768px tablet.
 */
const WIDTHS = {
  /** Dashboards, tables, anything data-dense. */
  wide: "max-w-screen-2xl",
  /** Default for standard pages. */
  default: "max-w-7xl",
  /** Forms and settings, where line length matters. */
  narrow: "max-w-3xl",
  /** Fills the shell -- for pages that manage their own width. */
  full: "max-w-none",
} as const;

export type PageWidth = keyof typeof WIDTHS;

export function PageContainer({
  children,
  width = "default",
  className = "",
}: {
  children: ReactNode;
  width?: PageWidth;
  className?: string;
}) {
  return (
    <div
      className={`mx-auto w-full min-w-0 ${WIDTHS[width]} px-4 sm:px-6 lg:px-8 ${className}`}
    >
      {children}
    </div>
  );
}
