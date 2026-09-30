/**
 * Sorting for the Performance Boards (pure, unit tested). A board declares
 * which columns can be sorted and how to read each one's value.
 */

export type SortDir = "asc" | "desc";
export type SortValue = number | string | Date | null | undefined;
export type SortSpec<T> = Record<string, (row: T) => SortValue>;

/** The requested column if the board knows it, else the default. */
export function pickSort<T>(spec: SortSpec<T>, key: string | undefined, fallback: string): string {
  return key && Object.prototype.hasOwnProperty.call(spec, key) ? key : fallback;
}

export function pickDir(dir: string | undefined, fallback: SortDir = "desc"): SortDir {
  return dir === "asc" || dir === "desc" ? dir : fallback;
}

/**
 * Stable sort by one column. Empty values (null, never) always go last,
 * whichever way you sort, so "top to bottom" never starts with blanks.
 */
export function sortRows<T>(rows: T[], spec: SortSpec<T>, key: string, dir: SortDir): T[] {
  const read = spec[key];
  if (!read) return rows;
  const val = (r: T) => {
    const v = read(r);
    return v instanceof Date ? v.getTime() : v;
  };
  return rows
    .map((row, i) => ({ row, i, v: val(row) }))
    .sort((a, b) => {
      const an = a.v === null || a.v === undefined || a.v === "";
      const bn = b.v === null || b.v === undefined || b.v === "";
      if (an || bn) return an === bn ? a.i - b.i : an ? 1 : -1;
      const c = typeof a.v === "string" && typeof b.v === "string" ? a.v.localeCompare(b.v, "en", { sensitivity: "base" }) : (a.v as number) - (b.v as number);
      return (dir === "asc" ? c : -c) || a.i - b.i;
    })
    .map((x) => x.row);
}

/** Activity filter for students: days since they last did anything. */
export type ActivityFilter = "all" | "7d" | "inactive7" | "never";

export function matchesActivity(lastActiveAt: Date | null, filter: ActivityFilter, now = Date.now()): boolean {
  if (filter === "all") return true;
  if (filter === "never") return !lastActiveAt;
  if (!lastActiveAt) return filter === "inactive7";
  const recent = now - lastActiveAt.getTime() <= 7 * 86_400_000;
  return filter === "7d" ? recent : !recent;
}
