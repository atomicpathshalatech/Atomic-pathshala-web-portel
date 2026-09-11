import "server-only";
import type { CreativeEducator } from "../content-types";

type TeacherLike = {
  id: string;
  creativePngUrl: string | null;
  creativeAssetVersion: number;
  user: { name: string; photoUrl: string | null };
};

/**
 * Fallback chain (spec section 18): a true transparent cutout is always
 * preferred; the normal profile photo is used ONLY as a visibly-different
 * fallback (never silently swapped in as if it were the cutout — callers
 * that need a real cutout check `isCutout`); if neither exists, imageUrl is
 * null and the template renders its "no creative image" placeholder.
 */
export function toCreativeEducator(t: TeacherLike): CreativeEducator {
  const hasCutout = Boolean(t.creativePngUrl);
  return {
    teacherId: t.id,
    name: t.user.name,
    imageUrl: t.creativePngUrl || t.user.photoUrl || null,
    isCutout: hasCutout,
    creativeAssetVersion: t.creativeAssetVersion,
  };
}
