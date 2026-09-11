import { prisma } from "@/lib/db";
import { RegenerateCreativeButton } from "./RegenerateCreativeButton";

type CreativeType = "BATCH" | "TEST_SERIES" | "CHAPTER" | "LECTURE" | "LECTURE_START_SLIDE";

/**
 * Server-rendered creative preview for entities with no pre-existing
 * thumbnail display slot (Chapter, Lecture) — Batch/TestSeries reuse their
 * existing `thumbnailUrl` card everywhere already, so they don't need this.
 * Shows the current GeneratedCreative row's asset, or a clear "not
 * generated yet" state (spec section 18 — never a silent blank).
 */
export async function CreativeThumbnail({
  type,
  entityId,
  showRegenerate = false,
  aspectClass = "aspect-[16/9]",
}: {
  type: CreativeType;
  entityId: string;
  showRegenerate?: boolean;
  aspectClass?: string;
}) {
  const creative = await prisma.generatedCreative.findUnique({
    where: { type_sourceEntityId: { type, sourceEntityId: entityId } },
  });

  return (
    <div className="space-y-2">
      <div className={`w-full ${aspectClass} rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center`}>
        {creative?.status === "READY" && creative.assetUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={creative.assetUrl} alt="" className="w-full h-full object-cover" />
        ) : creative?.status === "FAILED" ? (
          <div className="text-center px-4">
            <span className="material-symbols-outlined text-2xl text-rose-500">error</span>
            <p className="text-xs text-rose-500 mt-1">Creative generation failed</p>
          </div>
        ) : (
          <div className="text-center px-4">
            <span className="material-symbols-outlined text-2xl text-slate-400">image</span>
            <p className="text-xs text-slate-400 mt-1">Creative not generated yet</p>
          </div>
        )}
      </div>
      {showRegenerate && <RegenerateCreativeButton type={type} entityId={entityId} />}
    </div>
  );
}
