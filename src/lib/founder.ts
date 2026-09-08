import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";

export const FOUNDER_TAG = "founder";

export type FounderSocialLink = { label: string; url: string };

/**
 * Cached read of the singleton Founder row, shared by the homepage teaser
 * section and the /about-founder page. Mutations call
 * `revalidateTag(FOUNDER_TAG)` so an admin's save shows up immediately;
 * otherwise this is served from the Next data cache with no DB round trip.
 */
export const getFounder = unstable_cache(
  async () => {
    try {
      return await prisma.founder.findUnique({ where: { id: "singleton" } });
    } catch (error) {
      // Table may not exist yet (migration not deployed) or the DB is
      // briefly unreachable — the homepage must still render (Part 20).
      console.error("getFounder failed, treating as no founder:", error);
      return null;
    }
  },
  ["founder-singleton"],
  { revalidate: 300, tags: [FOUNDER_TAG] }
);

/** Only render the founder on the public site once an admin has switched it on. */
export async function getActiveFounder() {
  const f = await getFounder();
  return f && f.isActive ? f : null;
}

/** Narrow the JSON `socialLinks` column to real {label,url} pairs. */
export function parseFounderSocialLinks(raw: unknown): FounderSocialLink[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (x): x is FounderSocialLink =>
      !!x &&
      typeof x === "object" &&
      typeof (x as Record<string, unknown>).label === "string" &&
      typeof (x as Record<string, unknown>).url === "string" &&
      (x as Record<string, unknown>).url !== ""
  );
}
