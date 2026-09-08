import {
  PushNotifications,
  Token,
  PushNotificationSchema,
  ActionPerformed,
} from '@capacitor/push-notifications';
import { isNativeApp, isAndroid } from './index';

export interface PushNotificationCallbacks {
  onTokenReceived?: (token: string) => void;
  onNotificationReceived?: (notification: PushNotificationSchema) => void;
  onNotificationActionPerformed?: (action: ActionPerformed) => void;
  onNavigate?: (path: string) => void;
}

export const MAIN_NOTIFICATION_CHANNEL_ID = 'atomic_pathshala_main';

/**
 * Register device for Push Notifications (FCM).
 * Handles Android 13+ runtime permissions, high-priority channels, token exchange, and notification clicks.
 */
export async function registerPushNotifications(
  callbacks?: PushNotificationCallbacks
): Promise<string | null> {
  if (!isNativeApp()) return null;

  try {
    // 1. Create Android Notification Channel
    if (isAndroid()) {
      try {
        await PushNotifications.createChannel({
          id: MAIN_NOTIFICATION_CHANNEL_ID,
          name: 'General Announcements & Live Classes',
          description: 'Live classes, test series, DPP assignments, and doubt solving alerts',
          importance: 5, // High importance (heads-up notification)
          visibility: 1, // Public on lockscreen
          sound: 'default',
          vibration: true,
        });
      } catch (channelErr) {
        console.warn('[PushNotifications] Could not create notification channel:', channelErr);
      }
    }

    // 2. Check & Request Permissions
    let permStatus = await PushNotifications.checkPermissions();

    if (permStatus.receive === 'prompt' || permStatus.receive === 'prompt-with-rationale') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      console.warn('[PushNotifications] Push permission was not granted:', permStatus.receive);
      return null;
    }

    // 3. Setup Listeners
    PushNotifications.addListener('registration', async (token: Token) => {
      console.log('[PushNotifications] Device registered with FCM token:', token.value);
      if (callbacks?.onTokenReceived) {
        callbacks.onTokenReceived(token.value);
      }

      // Sync with backend API
      try {
        await fetch('/api/notifications/devices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fcmToken: token.value,
            platform: 'ANDROID',
            deviceInfo: 'Android Capacitor Native App',
          }),
        });
      } catch (err) {
        console.warn('[PushNotifications] Failed to sync token with backend:', err);
      }
    });

    PushNotifications.addListener('registrationError', (error: any) => {
      console.error('[PushNotifications] Registration error:', error);
    });

    PushNotifications.addListener(
      'pushNotificationReceived',
      (notification: PushNotificationSchema) => {
        console.log('[PushNotifications] Push received in foreground:', notification);
        if (callbacks?.onNotificationReceived) {
          callbacks.onNotificationReceived(notification);
        }
      }
    );

    PushNotifications.addListener(
      'pushNotificationActionPerformed',
      (action: ActionPerformed) => {
        console.log('[PushNotifications] Push action performed:', action);
        if (callbacks?.onNotificationActionPerformed) {
          callbacks.onNotificationActionPerformed(action);
        }

        // Extract deep link route
        const data = action.notification.data || {};
        const targetRoute =
          data.deepLink ||
          data.click_action ||
          data.url ||
          data.route ||
          action.notification.click_action;

        if (targetRoute && typeof targetRoute === 'string') {
          if (callbacks?.onNavigate) {
            callbacks.onNavigate(targetRoute);
          } else {
            window.location.href = targetRoute;
          }
        }
      }
    );

    // 4. Register with Apple / Google APNs/FCM
    await PushNotifications.register();
    return 'REGISTERED';
  } catch (err) {
    console.warn('[PushNotifications] Failed to initialize push notifications:', err);
    return null;
  }
}
