"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";

type Props = {
  initialPhotoUrl: string | null;
  initialCreativePngUrl: string | null;
  initialHasAlpha: boolean | null;
};

/**
 * "Profile Images / Creative Assets" (spec section 1-2). Two independent
 * uploads — normal Profile Photo (User.photoUrl, used everywhere a plain
 * avatar shows) and Creative PNG / cutout (Teacher.creativePngUrl, used
 * only as an input to auto-generated batch/chapter/lecture/test-series
 * creatives). Replacing one never touches the other.
 */
export function ProfileImagesSection({ initialPhotoUrl, initialCreativePngUrl, initialHasAlpha }: Props) {
  const [photoUrl, setPhotoUrl] = useState(initialPhotoUrl);
  const [pngUrl, setPngUrl] = useState(initialCreativePngUrl);
  const [hasAlpha, setHasAlpha] = useState(initialHasAlpha);
  const [busyPhoto, setBusyPhoto] = useState(false);
  const [busyPng, setBusyPng] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);
  const pngInput = useRef<HTMLInputElement>(null);

  async function uploadTo(file: File): Promise<string | null> {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: form });
    const json = await res.json();
    if (!json.success) {
      toast.error(json.error || "Upload failed.");
      return null;
    }
    return json.data.url as string;
  }

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusyPhoto(true);
    try {
      const url = await uploadTo(file);
      if (!url) return;
      const res = await fetch("/api/team/profile/photo", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error || "Could not save profile photo.");
        return;
      }
      setPhotoUrl(json.data.photoUrl);
      toast.success("Profile photo updated.");
    } finally {
      setBusyPhoto(false);
      if (photoInput.current) photoInput.current.value = "";
    }
  }

  async function handlePng(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "image/png") {
      toast.error("Creative asset must be a PNG file.");
      return;
    }
    setBusyPng(true);
    try {
      const url = await uploadTo(file);
      if (!url) return;
      const res = await fetch("/api/team/profile/creative-png", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const json = await res.json();
      if (!json.success) {
        toast.error(json.error || "Could not save the creative PNG.");
        return;
      }
      setPngUrl(json.data.creativePngUrl);
      setHasAlpha(json.data.creativePngHasAlpha);
      if (!json.data.creativePngHasAlpha) {
        toast.warning("This PNG doesn't appear to have transparency — it will show its background on creatives.");
      } else {
        toast.success("Creative PNG updated — existing creatives will refresh.");
      }
    } finally {
      setBusyPng(false);
      if (pngInput.current) pngInput.current.value = "";
    }
  }

  return (
    <div className="glass-card rounded-xl p-6 space-y-5">
      <div>
        <h2 className="font-label-lg text-label-lg text-on-surface">Profile Images</h2>
        <p className="text-label-sm text-on-surface-variant mt-1">
          Use a transparent PNG cutout of the educator. This image will automatically appear on
          course, chapter, batch, test-series and lecture creatives.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        {/* Profile Photo */}
        <div className="space-y-2">
          <p className="text-label-md font-label-md text-on-surface">Profile Photo</p>
          <div className="w-28 h-28 rounded-full overflow-hidden bg-surface-container-high border border-outline-variant flex items-center justify-center">
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <span className="material-symbols-outlined text-3xl text-on-surface-variant">person</span>
            )}
          </div>
          <input ref={photoInput} type="file" accept="image/jpeg,image/jpg,image/png" onChange={handlePhoto} disabled={busyPhoto} className="text-label-sm" />
          <p className="text-label-sm text-on-surface-variant">Normal photo — shown as your avatar wherever the platform shows a profile picture.</p>
        </div>

        {/* Creative PNG */}
        <div className="space-y-2">
          <p className="text-label-md font-label-md text-on-surface">Creative PNG / Cutout Photo</p>
          <div
            className="w-28 h-28 rounded-xl overflow-hidden border border-outline-variant flex items-center justify-center"
            style={{
              backgroundImage:
                "linear-gradient(45deg, #e2e8f0 25%, transparent 25%), linear-gradient(-45deg, #e2e8f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e2e8f0 75%), linear-gradient(-45deg, transparent 75%, #e2e8f0 75%)",
              backgroundSize: "12px 12px",
              backgroundPosition: "0 0, 0 6px, 6px -6px, -6px 0px",
            }}
          >
            {pngUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={pngUrl} alt="Creative cutout" className="w-full h-full object-contain" />
            ) : (
              <span className="material-symbols-outlined text-3xl text-on-surface-variant">image</span>
            )}
          </div>
          <input ref={pngInput} type="file" accept="image/png" onChange={handlePng} disabled={busyPng} className="text-label-sm" />
          {pngUrl && hasAlpha === false && (
            <p className="text-label-sm text-amber-600 flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">warning</span>
              No transparency detected — background will show on creatives.
            </p>
          )}
          {!pngUrl && <p className="text-label-sm text-amber-600">Not uploaded yet — creatives will show a placeholder until you add one.</p>}
        </div>
      </div>
    </div>
  );
}
