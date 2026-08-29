import "server-only";
import { prisma } from "@/lib/db";

/**
 * Bridge for code ported from `_import_atomic-ai-chat`, which called
 * `getPrisma()` from its own `@/lib/prisma` (a lazily-constructed client
 * built on `@prisma/adapter-pg` against its own `@/generated/prisma/client`
 * types). atomic-ops already has a single shared Prisma client + generated
 * client — this just hands ported code that same client under the name it
 * already expects, so route/lib bodies don't need per-call rewrites beyond
 * their import path.
 */
export function getPrisma() {
  return prisma;
}

export { prisma };
