import { Browser } from '@capacitor/browser';
import { isNativeApp } from './index';

/**
 * Open external URL safely.
 * On Native Android/iOS: Uses In-App Browser (Custom Tabs / SFSafariViewController).
 * On Web: Opens in a new browser tab (`_blank`).
 */
export async function openExternalUrl(
  url: string,
  options?: {
    toolbarColor?: string;
    target?: '_blank' | '_self';
  }
): Promise<void> {
  if (isNativeApp()) {
    try {
      await Browser.open({
        url,
        toolbarColor: options?.toolbarColor || '#090D16',
        presentationStyle: 'popover',
      });
      return;
    } catch (err) {
      console.warn('[Browser] In-App Browser failed, falling back to window.open', err);
    }
  }

  if (typeof window !== 'undefined') {
    window.open(url, options?.target || '_blank', 'noopener,noreferrer');
  }
}

/**
 * Close the In-App Browser if currently open
 */
export async function closeExternalBrowser(): Promise<void> {
  if (isNativeApp()) {
    try {
      await Browser.close();
    } catch {
      // Ignored if not open
    }
  }
}
