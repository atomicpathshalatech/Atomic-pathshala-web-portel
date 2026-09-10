'use client';

import React, { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { isNativeApp, isAndroid } from '@/lib/platform';
import { initAppListeners } from '@/lib/platform/app-listener';
import { initDeepLinks } from '@/lib/platform/deep-links';
import { registerPushNotifications } from '@/lib/platform/notifications';
import { hasInAppHistory } from '@/lib/navigation/useBackNavigation';
import { parentPathFor, isRootRoute } from '@/lib/navigation/hierarchy';
import { StatusBar, Style } from '@capacitor/status-bar';

export function CapacitorProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  const pushRegisteredRef = useRef(false);

  // The back listener is registered once (see below) but needs the current
  // route every time it fires. Refs carry that in without making the effect
  // depend on `pathname`.
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const routerRef = useRef(router);
  routerRef.current = router;

  // 1. Native StatusBar + Android hardware Back.
  //
  // Registered ONCE for the app's lifetime. It used to re-register on every
  // route change; since Capacitor's addListener and remove are both async, a
  // quick navigation could briefly leave two listeners attached and a single
  // back press would navigate twice, skipping a screen.
  useEffect(() => {
    if (!isNativeApp()) return;

    if (isAndroid()) {
      StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
      StatusBar.setBackgroundColor({ color: '#090D16' }).catch(() => {});
      StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
    }

    const cleanupBack = initAppListeners({
      // "Is there somewhere of ours to go back to" - measured against the
      // history this app actually created in this tab, not the raw
      // history.length (which counts pages from before the app was opened
      // and would send the user out of the app on a deep link).
      canNavigateBack: () => !isRootRoute(pathnameRef.current) && hasInAppHistory(),
      onNavigateBack: () => {
        const current = pathnameRef.current;
        if (hasInAppHistory()) {
          routerRef.current.back();
        } else {
          // Cold start on a deep link: no history, but the user still needs
          // a way up the hierarchy instead of being dropped out of the app.
          routerRef.current.push(parentPathFor(current));
        }
      },
      showExitToast: (message) => {
        toast(message, { duration: 2000, position: 'bottom-center' });
      },
    });

    const cleanupDeepLinks = initDeepLinks((path) => {
      routerRef.current.push(path);
    });

    return () => {
      cleanupBack();
      cleanupDeepLinks();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Register FCM Push Notifications on User Login
  useEffect(() => {
    if (!isNativeApp() || !session?.user || pushRegisteredRef.current) return;

    pushRegisteredRef.current = true;
    registerPushNotifications({
      onTokenReceived: (token) => {
        console.log('[CapacitorProvider] Push token synced:', token.slice(0, 10) + '...');
      },
      onNotificationReceived: (notification) => {
        toast.info(notification.title || 'New Notification', {
          description: notification.body,
        });
      },
      onNavigate: (path) => {
        routerRef.current.push(path);
      },
    }).catch((err) => {
      console.warn('[CapacitorProvider] Push registration failed:', err);
    });
  }, [session]);

  return <>{children}</>;
}
