"use client";

import { useRef, useState } from "react";
import { uploadFileToR2 } from "@/lib/storage/upload-client";

/**
 * 16:9 thumbnail picker, shared by anything that carries a cover image
 * (test series today, batches once the column exists).
 *
 * The file goes browser → R2 directly through the presigned-URL flow, so a
 * multi-megabyte image never passes through the Next.js server. Visibility is
 * PUBLIC because a thumbnail is shown on listing cards, including to students
 * who do not own the resource — a PROTECTED asset would need a presigned read
 * per card render.
 *
 * The 16:9 frame is enforced visually (object-cover inside an aspect-video
 * box, which is exactly how the cards render it) and a mismatch is flagged as
 * a warning rather than a hard rejection: cropping someone's poster for them
 * is worse than telling them it will be cropped.
 */
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;
/** 16:9 = 1.777…; anything outside this band gets a crop warning. */
const TARGET_RATIO = 16 / 9;
const RATIO_TOLERANCE = 0.08;

export function ThumbnailUploader({
  value,
  onChange,
  label = "Thumbnail (16:9)",
  hint = "Recommended 1280×720 or larger. JPG, PNG or WebP, up to 5 MB.",
}: {
  value: string | null | undefined;
  onChange: (url: string | null) => void;
  label?: string;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [ratioWarning, setRatioWarning] = useState<string | null>(null);

  /** Reads the image's natural size without adding it to the DOM. */
  function measure(file: File): Promise<{ width: number; height: number } | null> {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    });
  }

  async function handleFile(file: File) {
    setError(null);
    setRatioWarning(null);

    if (!ACCEPTED.includes(file.type)) {
      setError("Use a JPG, PNG or WebP image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(`That file is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is 5 MB.`);
      return;
    }

    const size = await measure(file);
    if (size && size.height > 0) {
      const ratio = size.width / size.height;
      if (Math.abs(ratio - TARGET_RATIO) > RATIO_TOLERANCE) {
        setRatioWarning(
          `This image is ${size.width}×${size.height} (${ratio.toFixed(2)}:1). It will be cropped to fit 16:9.`
        );
      }
    }

    setUploading(true);
    setProgress(0);
    try {
      const result = await uploadFileToR2(file, {
        prefix: "course-thumbnails",
        fileType: "THUMBNAIL",
        visibility: "PUBLIC",
        onProgress: setProgress,
      });

      // `url` is only present for assets served publicly; without it there is
      // nothing a card could render, so treat that as a failure rather than
      // storing a blank value that looks fine until someone opens the list.
      if (!result.url) {
        setError("Upload finished but no public URL came back. Try again.");
        return;
      }
      onChange(result.url);
    } catch (err) {
      console.error("[thumbnail] upload failed:", err);
      setError(err instanceof Error ? err.message : "Upload failed. Try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <label className="text-xs font-bold text-on-surface">{label}</label>

      <div className="flex flex-col sm:flex-row gap-3">
        {/* Preview frame — the exact 16:9 box the listing cards use. */}
        <div className="relative w-full sm:w-56 shrink-0 aspect-video max-w-full rounded-xl overflow-hidden border border-outline-variant/40 bg-surface-container-high">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="Thumbnail preview" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-on-surface-variant gap-1">
              <span className="material-symbols-outlined text-2xl opacity-60">image</span>
              <span className="text-[10px] font-semibold">16 : 9</span>
            </div>
          )}

          {uploading && (
            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2 text-white">
              <span className="text-xs font-bold">{progress}%</span>
              <div className="w-24 h-1 rounded-full bg-white/25 overflow-hidden">
                <div className="h-full bg-white transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 justify-center min-w-0">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED.join(",")}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              // Reset so picking the same file twice still fires onChange.
              e.target.value = "";
              if (file) void handleFile(file);
            }}
          />

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
              className="px-4 min-h-11 rounded-xl bg-primary text-on-primary text-xs font-bold shadow-sm hover:opacity-90 disabled:opacity-50 transition inline-flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-base">upload</span>
              {value ? "Replace" : "Upload"}
            </button>

            {value && !uploading && (
              <button
                type="button"
                onClick={() => {
                  onChange(null);
                  setRatioWarning(null);
                  setError(null);
                }}
                className="px-3 min-h-11 rounded-xl border border-outline-variant/40 text-xs font-bold text-on-surface-variant hover:text-on-surface transition"
              >
                Remove
              </button>
            )}
          </div>

          <p className="text-[11px] text-on-surface-variant max-w-xs">{hint}</p>
          {ratioWarning && (
            <p className="text-[11px] font-semibold text-amber-600 max-w-xs">{ratioWarning}</p>
          )}
          {error && <p className="text-[11px] font-bold text-error max-w-xs">{error}</p>}
        </div>
      </div>
    </div>
  );
}
