import { App, URLOpenListenerEvent } from '@capacitor/app';
import { isNativeApp } from './index';

/**
 * Universal Deep Link & Android App Link Parser
 * Converts incoming native URLs (e.g. `atomicpathshala://live-class/123`, `atomicpathshala:///tests/456`, `https://app.atomicpathshala.com/watch/abc?t=120`)
 * into internal Next.js App Router paths.
 */
export function parseDeepLinkUrl(rawUrl: string): string | null {
  try {
    // Handle custom scheme: atomicpathshala://...
    if (rawUrl.startsWith('atomicpathshala://')) {
      const withoutScheme = rawUrl.replace(/^atomicpathshala:\/\//, '');
      const cleanPath = withoutScheme.startsWith('/') ? withoutScheme : `/${withoutScheme}`;
      return cleanPath;
    }

    // Handle standard HTTP / HTTPS URLs
    const url = new URL(rawUrl);
    return `${url.pathname}${url.search}${url.hash}`;
  } catch (err) {
    console.warn('[DeepLinks] Failed to parse URL:', rawUrl, err);
    return null;
  }
}

/**
 * Initialize Deep Links and App Links listener.
 */
export function initDeepLinks(onNavigate: (path: string) => void) {
  if (!isNativeApp()) return () => {};

  const listenerPromise = App.addListener('appUrlOpen', (event: URLOpenListenerEvent) => {
    const targetPath = parseDeepLinkUrl(event.url);
    if (targetPath) {
      console.log('[DeepLinks] Navigating to target path:', targetPath);
      onNavigate(targetPath);
    }
  });

  return () => {
    listenerPromise.then((handle) => handle.remove()).catch(() => {});
  };
}
