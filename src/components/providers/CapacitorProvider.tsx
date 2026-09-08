'use client';

import React, { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { toast } from 'sonner';
import { isNativeApp, isAndroid } from '@/lib/platform';
import { initAppListeners } from '@/lib/platform/app-listener';
import { initDeepLinks } from '@/lib/platform/deep-links';
import { registerPushNotifications } from '@/lib/platform/notifications';
import { StatusBar, Style } from '@capacitor/status-bar';

const ROOT_PATHS = ['/', '/dashboard', '/login', '/signup', '/student', '/teacher', '/admin'];

export function CapacitorProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  const pushRegisteredRef = useRef(false);

  // 1. Initialize Native StatusBar & Android Hardware Back Button
  useEffect(() => {
    if (!isNativeApp()) return;

    // Configure Status Bar
    if (isAndroid()) {
      StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
      StatusBar.setBackgroundColor({ color: '#090D16' }).catch(() => {});
      StatusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
    }

    // Configure Hardware Back Button
    const cleanupBack = initAppListeners({
      canNavigateBack: () => {
        const isRoot = ROOT_PATHS.includes(pathname || '/');
        return !isRoot && window.history.length > 1;
      },
      onNavigateBack: () => {
        router.back();
      },
      showExitToast: (message) => {
        toast(message, {
          duration: 2000,
          position: 'bottom-center',
        });
      },
    });

    // Configure Deep Links
    const cleanupDeepLinks = initDeepLinks((path) => {
      router.push(path);
    });

    return () => {
      cleanupBack();
      cleanupDeepLinks();
    };
  }, [router, pathname]);

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
        router.push(path);
      },
    }).catch((err) => {
      console.warn('[CapacitorProvider] Push registration failed:', err);
    });
  }, [session]);

  return <>{children}</>;
}
