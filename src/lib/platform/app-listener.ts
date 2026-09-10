import { App } from '@capacitor/app';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { isNativeApp } from './index';
import { runBackGuards, registerBackGuard } from '@/lib/navigation/back-guards';

type BackButtonHandler = () => boolean | Promise<boolean>;

/**
 * Kept for the existing call sites that register modal/sheet dismissers.
 * It now forwards to the shared registry in @/lib/navigation/back-guards, so
 * the hardware key, the on-screen Back button and the browser gesture all
 * consult one list instead of three.
 *
 * Overlays run at a higher priority than screen-level guards: a sheet opened
 * on top of a running quiz must close before the quiz asks "exit?".
 */
export function registerBackHandler(handler: BackButtonHandler): () => void {
  return registerBackGuard(handler, 100);
}

let lastBackPressTime = 0;
const DOUBLE_PRESS_EXIT_WINDOW_MS = 2000;

/**
 * Android hardware back + app lifecycle listeners.
 *
 * MUST be initialised exactly once for the app's lifetime. The previous
 * version was re-initialised on every route change (its effect depended on
 * `pathname`), and because Capacitor's addListener/remove are both async,
 * a fast navigation could leave the old listener alive alongside the new one
 * - one back press then navigated twice, skipping a page. Live state is read
 * through the callbacks below instead of through the closure, so this can
 * safely register once and stay.
 */
export function initAppListeners(options: {
  onNavigateBack: () => void;
  canNavigateBack: () => boolean;
  showExitToast?: (message: string) => void;
}) {
  if (!isNativeApp()) return () => {};

  const backListenerPromise = App.addListener('backButton', async ({ canGoBack }) => {
    // A. Registered guards: overlays first, then screen-level guards
    //    (running quiz, live class, unsaved editor). A guard returning true
    //    means it handled the press - it closed itself, or it put a
    //    confirmation on screen and is waiting for the answer.
    if (await runBackGuards()) return;

    // B. Un-registered overlays that libraries render straight into the DOM.
    //    Dispatching Escape lets them close through their own logic rather
    //    than us reaching into their internals.
    const openModals = document.querySelectorAll(
      '[data-state="open"][role="dialog"], [aria-modal="true"], .modal-open'
    );
    if (openModals.length > 0) {
      document.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Escape',
          code: 'Escape',
          keyCode: 27,
          which: 27,
          bubbles: true,
          cancelable: true,
        })
      );
      return;
    }

    // C. Fullscreen video: leave fullscreen before leaving the page, so the
    //    first back press does what the user expects and does not skip the
    //    player entirely.
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
        return;
      } catch {
        // fall through to navigation
      }
    }

    // D. Normal navigation. `canNavigateBack()` reflects this app's own
    //    history; `canGoBack` is the WebView's view of the same stack.
    if (options.canNavigateBack() || canGoBack) {
      options.onNavigateBack();
      return;
    }

    // E. At a root screen with nothing behind it: confirm before exiting,
    //    so a stray press does not close the app.
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
      options.showExitToast?.('Press back again to exit');
    }
  });

  const stateListenerPromise = App.addListener('appStateChange', (state) => {
    if (state.isActive) {
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
