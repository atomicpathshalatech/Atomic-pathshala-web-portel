"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, X } from "lucide-react";
import { uploadFileToR2 } from "@/lib/storage/upload-client";

/** URL box + "Upload" button + preview, for Blog covers and the homepage hero image. */
export function ImageUploadField({
  label,
  hint,
  value,
  onChange,
  aspect = "aspect-video",
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (url: string) => void;
  aspect?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function upload(file: File) {
    setUploading(true);
    try {
      const res = await uploadFileToR2(file, { fileType: "IMAGE", prefix: "course-thumbnails", visibility: "PUBLIC" });
      if (res.url) {
        onChange(res.url);
        toast.success("Image uploaded.");
      } else {
        toast.error("Upload succeeded but no public URL returned.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Image upload failed.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <label className="mb-1 block text-xs font-semibold text-slate-700">{label}</label>
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Paste image URL or upload"
          className="flex-1 rounded-xl border border-slate-200 px-3.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
          }}
        />
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
        >
          <Upload className="h-3.5 w-3.5" />
          {uploading ? "Uploading…" : "Upload"}
        </button>
      </div>
      {hint && <p className="mt-1 text-[11px] text-slate-500">{hint}</p>}
      {value && (
        <div className={`relative mt-2.5 w-full max-w-sm overflow-hidden rounded-xl border border-slate-200 bg-slate-100 ${aspect}`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of any URL */}
          <img src={value} alt="Preview" className="h-full w-full object-contain" />
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute right-2 top-2 rounded-full bg-white/90 p-1 text-slate-700 shadow hover:bg-white"
            aria-label="Remove image"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
