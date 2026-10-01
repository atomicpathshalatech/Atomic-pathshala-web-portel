/**
 * A batch / test-series thumbnail is either the auto-generated creative
 * (stored under creatives/…, regenerated when teachers or details change)
 * or an image the admin uploaded — which must then never be replaced by a
 * regenerated creative. Saving a form decides which it is from the URL.
 */
export function isAutoCreativeUrl(url: string | null | undefined): boolean {
  return Boolean(url && /\/creatives\/(batch|test_series)\//.test(url));
}

/** Fields to write when an admin form saves a thumbnail URL ("" / null = let it be auto). */
export function thumbnailFields(url: string | null | undefined): { thumbnailUrl: string | null; thumbnailIsAuto: boolean } {
  const clean = url ? url.trim() : "";
  return { thumbnailUrl: clean || null, thumbnailIsAuto: !clean || isAutoCreativeUrl(clean) };
}
