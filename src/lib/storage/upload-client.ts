"use client";

export type R2UploadPrefix =
  | "pdf"
  | "dpp"
  | "modules"
  | "notes"
  | "solutions"
  | "question-images"
  | "profile-images"
  | "course-thumbnails"
  | "whiteboard"
  | "documents"
  | "exports";

export type R2FileType =
  | "PDF"
  | "IMAGE"
  | "DOCUMENT"
  | "DPP"
  | "NOTES"
  | "WHITEBOARD_SNAPSHOT"
  | "PROFILE_IMAGE"
  | "THUMBNAIL"
  | "EXPORT";

export interface DirectR2UploadOptions {
  prefix: R2UploadPrefix;
  fileType: R2FileType;
  subPath?: string;
  entityId?: string;
  visibility?: "PUBLIC" | "PROTECTED" | "PRIVATE";
  onProgress?: (percent: number) => void;
}

export interface DirectR2UploadResult {
  fileAssetId: string;
  storageKey: string;
  url?: string;
  filename: string;
  sizeBytes: number;
  mimeType: string;
}

/**
 * Uploads a file directly from the browser to Cloudflare R2 via presigned PUT URL.
 * Never passes large binary files through the Next.js server memory.
 */
export async function uploadFileToR2(
  file: File,
  options: DirectR2UploadOptions
): Promise<DirectR2UploadResult> {
  const { prefix, fileType, subPath, entityId, visibility = "PROTECTED", onProgress } = options;

  // Step 1: Request presigned upload URL from backend
  if (onProgress) onProgress(10);
  const requestRes = await fetch("/api/files/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: file.name,
      mimeType: file.type || "application/octet-stream",
      fileType,
      prefix,
      subPath,
      entityId,
      visibility,
    }),
  });

  if (!requestRes.ok) {
    const errBody = await requestRes.json().catch(() => ({}));
    throw new Error(errBody.error || "Failed to initialize secure upload.");
  }

  const { data } = await requestRes.json();
  const { fileAssetId, storageKey, uploadUrl } = data;

  // Step 2: Upload directly to R2 using XMLHttpRequest with real progress monitoring
  if (onProgress) onProgress(25);
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl, true);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        // Map upload progress between 25% and 85%
        const percent = Math.round(25 + (event.loaded / event.total) * 60);
        onProgress(percent);
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Storage upload failed with HTTP status ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error("Network error occurred during storage upload."));
    xhr.onabort = () => reject(new Error("Storage upload was aborted."));

    xhr.send(file);
  });

  // Step 3: Confirm upload with backend and activate file_assets record
  if (onProgress) onProgress(90);
  const completeRes = await fetch("/api/files/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileAssetId }),
  });

  if (!completeRes.ok) {
    const errBody = await completeRes.json().catch(() => ({}));
    throw new Error(errBody.error || "Failed to confirm file upload.");
  }

  if (onProgress) onProgress(100);

  // Return download access URL for public or protected asset
  const accessRes = await fetch(`/api/files/${fileAssetId}/access`).catch(() => null);
  let resolvedUrl: string | undefined;
  if (accessRes && accessRes.ok) {
    const accessData = await accessRes.json().catch(() => null);
    resolvedUrl = accessData?.data?.url;
  }

  return {
    fileAssetId,
    storageKey,
    url: resolvedUrl,
    filename: file.name,
    sizeBytes: file.size,
    mimeType: file.type,
  };
}
