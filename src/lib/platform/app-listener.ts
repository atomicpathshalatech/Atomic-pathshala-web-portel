import { App } from '@capacitor/app';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { isNativeApp } from './index';

type BackButtonHandler = () => boolean | Promise<boolean>;

// Registry of modal / sheet / overlay dismiss handlers
const backHandlers: BackButtonHandler[] = [];

/**
 * Register a priority back button handler (e.g. for closing a modal or drawer).
 * If the handler returns `true`, it marks the back event as handled and prevents navigation.
 */
export function registerBackHandler(handler: BackButtonHandler): () => void {
  backHandlers.push(handler);
  return () => {
    const index = backHandlers.indexOf(handler);
    if (index > -1) {
      backHandlers.splice(index, 1);
    }
  };
}

let lastBackPressTime = 0;
const DOUBLE_PRESS_EXIT_WINDOW_MS = 2000;

/**
 * Initialize native Android hardware back button & app lifecycle listeners
 */
export function initAppListeners(options: {
  onNavigateBack: () => void;
  canNavigateBack: () => boolean;
  showExitToast?: (message: string) => void;
}) {
  if (!isNativeApp()) return () => {};

  // 1. Android Hardware Back Button
  const backListenerPromise = App.addListener('backButton', async ({ canGoBack }) => {
    // A. Check registered priority handlers (active modals / dialogs)
    if (backHandlers.length > 0) {
      const topHandler = backHandlers[backHandlers.length - 1];
      if (topHandler) {
        const handled = await topHandler();
        if (handled) {
          return;
        }
      }
    }

    // B. Check standard modal dialogs in DOM (HTML5 dialogs or Radix UI overlays)
    const openModals = document.querySelectorAll(
      '[data-state="open"][role="dialog"], [aria-modal="true"], .modal-open'
    );
    if (openModals.length > 0) {
      // Trigger escape key event to let UI libraries close the modal naturally
      const escapeEvent = new KeyboardEvent('keydown', {
        key: 'Escape',
        code: 'Escape',
        keyCode: 27,
        which: 27,
        bubbles: true,
        cancelable: true,
      });
      document.dispatchEvent(escapeEvent);
      return;
    }

    // C. Check router history navigation
    if (options.canNavigateBack() || canGoBack) {
      options.onNavigateBack();
      return;
    }

    // D. Exit Guard: Double-tap back button to exit app on root page
    const now = Date.now();
    if (now - lastBackPressTime < DOUBLE_PRESS_EXIT_WINDOW_MS) {
      await App.exitApp();
    } else {
      lastBackPressTime = now;
      try {
        await Haptics.impact({ style: ImpactStyle.Light });
      } catch {
        // Haptics optional
      }
      if (options.showExitToast) {
        options.showExitToast('Press back again to exit');
      }
    }
  });

  // 2. App State Change Listener (Resume / Pause)
  const stateListenerPromise = App.addListener('appStateChange', (state) => {
    if (state.isActive) {
      // Re-connected to foreground: dispatch custom event for data freshness
      window.dispatchEvent(new CustomEvent('app:foreground'));
    } else {
      window.dispatchEvent(new CustomEvent('app:background'));
    }
  });

  return () => {
    backListenerPromise.then((handle) => handle.remove()).catch(() => {});
    stateListenerPromise.then((handle) => handle.remove()).catch(() => {});
  };
}
