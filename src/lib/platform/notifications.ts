import {
  PushNotifications,
  Token,
  PushNotificationSchema,
  ActionPerformed,
  Channel,
} from '@capacitor/push-notifications';
import { isNativeApp, isAndroid } from './index';

export interface PushNotificationCallbacks {
  onTokenReceived?: (token: string) => void;
  onNotificationReceived?: (notification: PushNotificationSchema) => void;
  onNotificationActionPerformed?: (action: ActionPerformed) => void;
  onNavigate?: (path: string) => void;
}

export const MAIN_NOTIFICATION_CHANNEL_ID = 'atomic_pathshala_main';
export const CHANNEL_CLASS_REMINDERS = 'class_reminders';
export const CHANNEL_CLASS_UPDATES = 'class_updates';
export const CHANNEL_TEST_REMINDERS = 'test_reminders';
export const CHANNEL_IMPORTANT_ANNOUNCEMENTS = 'important_announcements';
export const CHANNEL_GENERAL_UPDATES = 'general_updates';

/**
 * Register device for Push Notifications (FCM).
 * Handles Android 13+ runtime permissions, high-priority channels, token exchange, and notification clicks.
 */
export async function registerPushNotifications(
  callbacks?: PushNotificationCallbacks
): Promise<string | null> {
  if (!isNativeApp()) return null;

  try {
    // 1. Create Android Notification Channels (All 5 priority categories)
    if (isAndroid()) {
      const channels: Channel[] = [
        {
          id: CHANNEL_CLASS_REMINDERS,
          name: 'Class Reminders',
          description: '15-minute countdown and class starting alerts',
          importance: 5,
          visibility: 1,
          sound: 'default',
          vibration: true,
        },
        {
          id: CHANNEL_CLASS_UPDATES,
          name: 'Class Updates',
          description: 'New classes, rescheduling, and cancellations',
          importance: 5,
          visibility: 1,
          sound: 'default',
          vibration: true,
        },
        {
          id: CHANNEL_TEST_REMINDERS,
          name: 'Test Reminders',
          description: 'Test schedules, starting alerts, and exam deadlines',
          importance: 5,
          visibility: 1,
          sound: 'default',
          vibration: true,
        },
        {
          id: CHANNEL_IMPORTANT_ANNOUNCEMENTS,
          name: 'Important Announcements',
          description: 'Urgent announcements and high-priority notices',
          importance: 5,
          visibility: 1,
          sound: 'default',
          vibration: true,
        },
        {
          id: CHANNEL_GENERAL_UPDATES,
          name: 'General Updates',
          description: 'DPP assignments, notes, study materials, and motivation',
          importance: 3,
          visibility: 1,
          sound: 'default',
          vibration: true,
        },
        {
          id: MAIN_NOTIFICATION_CHANNEL_ID,
          name: 'General Announcements & Live Classes',
          description: 'Live classes, test series, DPP assignments, and alerts',
          importance: 5,
          visibility: 1,
          sound: 'default',
          vibration: true,
        },
      ];

      for (const ch of channels) {
        try {
          await PushNotifications.createChannel(ch);
        } catch (channelErr) {
          console.warn(`[PushNotifications] Could not create channel ${ch.id}:`, channelErr);
        }
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
        const data = notification.data || {};
        if (data.notificationId) {
          fetch('/api/notifications/track-action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              notificationId: data.notificationId,
              actionType: 'PUSH_DISPLAYED',
              source: 'ANDROID_PUSH',
              metadata: data,
            }),
          }).catch(() => {});
        }
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
        const notificationId = data.notificationId || data.id;

        // Record real CLICKED analytics
        if (notificationId) {
          fetch('/api/notifications/track-action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              notificationId,
              actionType: 'PUSH_CLICKED',
              source: 'ANDROID_PUSH',
              metadata: data,
            }),
          }).catch(() => {});
        }

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
