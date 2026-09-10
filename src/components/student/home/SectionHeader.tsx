import Link from "next/link";

/**
 * One consistent section title for the student home. Compact — a single
 * 15px semibold line, optional muted right-aligned link. No card, no big
 * description block (that was the old design's vertical-space problem).
 */
export function SectionHeader({
  title,
  href,
  linkLabel = "See all",
}: {
  title: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="flex items-baseline justify-between px-0.5">
      <h2 className="text-[15px] font-semibold tracking-tight text-slate-900">{title}</h2>
      {href && (
        <Link
          href={href}
          className="text-xs font-semibold text-blue-600 hover:text-blue-700 whitespace-nowrap"
        >
          {linkLabel}
        </Link>
      )}
    </div>
  );
}
