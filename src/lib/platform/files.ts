import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { isNativeApp } from './index';

/**
 * Universal File Downloader & Sharing Utility
 * Handles S3/R2 presigned download URLs seamlessly across Web and Native Android.
 */
export async function downloadAndOpenFile(
  url: string,
  filename: string,
  options?: {
    mimeType?: string;
    shareDirectly?: boolean;
  }
): Promise<{ success: boolean; filePath?: string; error?: string }> {
  try {
    // 1. Web Browser Fallback
    if (!isNativeApp()) {
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return { success: true };
    }

    // 2. Native Android / iOS Download via Capacitor Filesystem
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch file: ${response.statusText}`);
    }

    const blob = await response.blob();
    const base64Data = await blobToBase64(blob);

    const savedFile = await Filesystem.writeFile({
      path: filename,
      data: base64Data,
      directory: Directory.Documents,
      recursive: true,
    });

    // 3. Trigger native share sheet if requested or share file
    if (options?.shareDirectly) {
      await Share.share({
        title: filename,
        url: savedFile.uri,
        dialogTitle: `Share ${filename}`,
      });
    }

    return { success: true, filePath: savedFile.uri };
  } catch (err: any) {
    console.error('[Platform:Files] Download failed:', err);
    return { success: false, error: err?.message || 'File download failed' };
  }
}

/**
 * Download file with automated UI feedback (Sonner toast notifications)
 */
export async function downloadFileWithToast(
  url: string,
  filename: string,
  toastNotifier?: {
    loading: (msg: string) => string | number;
    success: (msg: string, opts?: any) => void;
    error: (msg: string) => void;
    dismiss: (id: string | number) => void;
  }
) {
  let toastId: string | number | undefined;
  if (toastNotifier) {
    toastId = toastNotifier.loading(`Downloading ${filename}...`);
  }

  const result = await downloadAndOpenFile(url, filename, { shareDirectly: isNativeApp() });

  if (toastNotifier && toastId !== undefined) {
    toastNotifier.dismiss(toastId);
    if (result.success) {
      toastNotifier.success(`Downloaded ${filename}`, {
        description: isNativeApp() ? 'Saved to device Documents folder' : 'Saved to Downloads',
      });
    } else {
      toastNotifier.error(result.error || `Failed to download ${filename}`);
    }
  }

  return result;
}

/**
 * Helper to convert Blob to Base64
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const dataUrl = reader.result as string;
      // Extract base64 portion after comma
      const base64 = dataUrl.split(',')[1] || dataUrl;
      resolve(base64);
    };
    reader.readAsDataURL(blob);
  });
}
