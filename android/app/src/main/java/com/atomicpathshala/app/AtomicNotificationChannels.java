package com.atomicpathshala.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;

public class AtomicNotificationChannels {
    private static final String TAG = "AtomicNotifChannels";

    public static final String CHANNEL_CLASS_REMINDERS = "class_reminders";
    public static final String CHANNEL_CLASS_UPDATES = "class_updates";
    public static final String CHANNEL_TEST_REMINDERS = "test_reminders";
    public static final String CHANNEL_IMPORTANT_ANNOUNCEMENTS = "important_announcements";
    public static final String CHANNEL_GENERAL_UPDATES = "general_updates";
    public static final String CHANNEL_LEGACY_MAIN = "atomic_pathshala_main";

    /**
     * Initializes all standard notification channels required by Atomic Pathshala.
     * Safe to call repeatedly (idempotent on Android O+).
     */
    public static void createAllChannels(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }

        try {
            NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager == null) return;

            AudioAttributes audioAttrs = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .build();
            Uri defaultSoundUri = Settings.System.DEFAULT_NOTIFICATION_URI;

            // 1. Class Reminders (High importance for 15-min countdown & class starting heads-up)
            NotificationChannel classReminders = new NotificationChannel(
                CHANNEL_CLASS_REMINDERS,
                "Class Reminders",
                NotificationManager.IMPORTANCE_HIGH
            );
            classReminders.setDescription("15-minute class countdowns and class starting alerts");
            classReminders.enableLights(true);
            classReminders.setLightColor(Color.parseColor("#3B82F6"));
            classReminders.enableVibration(true);
            classReminders.setVibrationPattern(new long[]{0, 250, 150, 250});
            classReminders.setSound(defaultSoundUri, audioAttrs);
            manager.createNotificationChannel(classReminders);

            // 2. Class Updates (Schedule changes, cancellations, new classes)
            NotificationChannel classUpdates = new NotificationChannel(
                CHANNEL_CLASS_UPDATES,
                "Class Updates",
                NotificationManager.IMPORTANCE_HIGH
            );
            classUpdates.setDescription("New classes scheduled, class rescheduling, and cancellations");
            classUpdates.enableLights(true);
            classUpdates.setLightColor(Color.parseColor("#3B82F6"));
            classUpdates.enableVibration(true);
            classUpdates.setSound(defaultSoundUri, audioAttrs);
            manager.createNotificationChannel(classUpdates);

            // 3. Test Reminders (Test schedule, countdown, and results)
            NotificationChannel testReminders = new NotificationChannel(
                CHANNEL_TEST_REMINDERS,
                "Test Reminders",
                NotificationManager.IMPORTANCE_HIGH
            );
            testReminders.setDescription("Test schedules, test starting alerts, and exam deadlines");
            testReminders.enableLights(true);
            testReminders.setLightColor(Color.parseColor("#8B5CF6"));
            testReminders.enableVibration(true);
            testReminders.setSound(defaultSoundUri, audioAttrs);
            manager.createNotificationChannel(testReminders);

            // 4. Important Announcements (High priority broadcast & alerts)
            NotificationChannel announcements = new NotificationChannel(
                CHANNEL_IMPORTANT_ANNOUNCEMENTS,
                "Important Announcements",
                NotificationManager.IMPORTANCE_HIGH
            );
            announcements.setDescription("Urgent updates, admissions, and system announcements");
            announcements.enableLights(true);
            announcements.setLightColor(Color.parseColor("#EF4444"));
            announcements.enableVibration(true);
            announcements.setSound(defaultSoundUri, audioAttrs);
            manager.createNotificationChannel(announcements);

            // 5. General Updates (DPPs, study materials, motivation)
            NotificationChannel general = new NotificationChannel(
                CHANNEL_GENERAL_UPDATES,
                "General Updates",
                NotificationManager.IMPORTANCE_DEFAULT
            );
            general.setDescription("DPP assignments, notes, study materials, and daily motivation");
            general.enableLights(true);
            general.enableVibration(true);
            manager.createNotificationChannel(general);

            // 6. Legacy compatibility channel
            NotificationChannel legacy = new NotificationChannel(
                CHANNEL_LEGACY_MAIN,
                "General Announcements",
                NotificationManager.IMPORTANCE_HIGH
            );
            legacy.setDescription("General alerts and class notifications");
            legacy.enableVibration(true);
            manager.createNotificationChannel(legacy);

            Log.d(TAG, "[Channels] All 6 Atomic Pathshala notification channels registered successfully.");
        } catch (Exception e) {
            Log.e(TAG, "[Channels] Error registering notification channels: " + e.getMessage(), e);
        }
    }
}
