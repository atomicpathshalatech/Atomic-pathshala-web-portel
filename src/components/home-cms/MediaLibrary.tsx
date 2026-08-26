"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";

type Asset = { id: string; url: string; fileName: string; sizeBytes: number };

export function MediaLibrary({ initialAssets }: { initialAssets: Asset[] }) {
  const [assets, setAssets] = useState(initialAssets);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/admin/media", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error ?? "Upload failed.");
      setAssets((prev) => [json.data.asset, ...prev]);
      toast.success("Uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove(id: string) {
    try {
      await fetch(`/api/admin/media/${id}`, { method: "DELETE" });
      setAssets((prev) => prev.filter((a) => a.id !== id));
    } catch {
      toast.error("Could not delete asset.");
    }
  }

  function copyUrl(url: string) {
    navigator.clipboard.writeText(url).then(() => toast.success("URL copied"));
  }

  return (
    <div className="space-y-stack-md">
      <label className="glass-card rounded-2xl p-8 flex flex-col items-center justify-center gap-2 cursor-pointer border-2 border-dashed border-outline-variant/40 hover:border-primary/50">
        <span className="material-symbols-outlined text-primary text-3xl">upload</span>
        <p className="font-label-md text-label-md text-on-surface">{uploading ? "Uploading…" : "Click to upload an image"}</p>
        <p className="text-label-sm text-on-surface-variant">JPG, PNG, WEBP, GIF or SVG — up to 8MB</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
          className="hidden"
          disabled={uploading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload(file);
          }}
        />
      </label>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-gutter">
        {assets.map((a) => (
          <div key={a.id} className="glass-card rounded-xl p-2 space-y-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={a.url} alt={a.fileName} className="w-full h-24 object-cover rounded-lg bg-surface-container-high" />
            <p className="text-label-sm text-on-surface-variant truncate">{a.fileName}</p>
            <div className="flex items-center justify-between">
              <button onClick={() => copyUrl(a.url)} className="text-label-sm text-primary hover:underline">Copy URL</button>
              <button onClick={() => remove(a.id)} className="text-label-sm text-error hover:underline">Delete</button>
            </div>
          </div>
        ))}
      </div>
      {assets.length === 0 && <p className="text-center text-on-surface-variant font-body-md py-8">No media uploaded yet.</p>}
    </div>
  );
}
