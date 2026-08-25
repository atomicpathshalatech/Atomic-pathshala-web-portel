"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const MAX_BYTES = 3 * 1024 * 1024; // 3MB, mirrors the API route's limit
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function ProfilePhotoUploader({
  initialPhotoUrl,
  name,
}: {
  initialPhotoUrl: string | null;
  name: string;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoUrl, setPhotoUrl] = useState(initialPhotoUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initials = name
    .trim()
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    setError(null);
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Please choose a JPG, PNG or WEBP image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Image is too large — please keep it under 3MB.");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("photo", file);
      const res = await fetch("/api/profile/photo", { method: "POST", body: formData });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error ?? "Could not upload this photo.");
        return;
      }
      setPhotoUrl(json.data.photoUrl);
      router.refresh();
    } catch {
      setError("Something went wrong. Please check your connection and try again.");
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove() {
    setError(null);
    setUploading(true);
    try {
      const res = await fetch("/api/profile/photo", { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error ?? "Could not remove this photo.");
        return;
      }
      setPhotoUrl(null);
      router.refresh();
    } catch {
      setError("Something went wrong. Please check your connection and try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="w-20 h-20 rounded-full bg-surface-container-high overflow-hidden shrink-0 flex items-center justify-center relative">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- uploaded to external object storage, not a next.config image domain
          <img src={photoUrl} alt={name} className="w-full h-full object-cover" />
        ) : (
          <span className="font-headline-md text-headline-md text-primary">{initials}</span>
        )}
        {uploading && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <span className="material-symbols-outlined text-white animate-spin text-xl">progress_activity</span>
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
            className="text-label-md font-label-md text-primary hover:opacity-80 transition-opacity disabled:opacity-50"
          >
            {photoUrl ? "Change photo" : "Upload photo"}
          </button>
          {photoUrl && (
            <>
              <span className="text-on-surface-variant">·</span>
              <button
                type="button"
                disabled={uploading}
                onClick={handleRemove}
                className="text-label-md font-label-md text-error hover:opacity-80 transition-opacity disabled:opacity-50"
              >
                Remove
              </button>
            </>
          )}
        </div>
        <p className="text-label-sm text-on-surface-variant">JPG, PNG or WEBP, up to 3MB.</p>
        {error && <p className="text-label-sm font-label-sm text-error">{error}</p>}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}
