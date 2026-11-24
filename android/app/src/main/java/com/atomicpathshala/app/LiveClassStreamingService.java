package com.atomicpathshala.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;
import android.util.Log;
import androidx.core.app.NotificationCompat;

/**
 * Foreground Service for Atomic Pathshala Live Teaching Session.
 * 
 * Ensures continuous, uninterrupted live class execution on Android tablets
 * (specifically OPPO Pad Air / ColorOS 13) when the teacher minimizes the app,
 * opens other documents, switches between apps, or turns the screen off.
 * 
 * Holds Partial WakeLock and High-Performance WifiLock to prevent OS process killing.
 */
public class LiveClassStreamingService extends Service {

    private static final String TAG = "LiveStreamingService";
    public static final String CHANNEL_ID = "live_class_session_channel";
    public static final int NOTIFICATION_ID = 9001;

    public static final String ACTION_START = "com.atomicpathshala.app.ACTION_START_STREAM";
    public static final String ACTION_UPDATE = "com.atomicpathshala.app.ACTION_UPDATE_STREAM";
    public static final String ACTION_STOP = "com.atomicpathshala.app.ACTION_STOP_STREAM";
    public static final String ACTION_MUTE_TOGGLE = "com.atomicpathshala.app.ACTION_MUTE_TOGGLE";

    private PowerManager.WakeLock wakeLock;
    private WifiManager.WifiLock wifiLock;
    private boolean isMuted = false;
    private String currentClassTitle = "Live Class Active";
    private String currentStatus = "Broadcasting to students";

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        acquireLocks();
        Log.d(TAG, "LiveClassStreamingService created and wake/wifi locks acquired.");
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String action = intent.getAction();
            if (ACTION_START.equals(action)) {
                String title = intent.getStringExtra("classTitle");
                if (title != null && !title.isEmpty()) currentClassTitle = title;
                String status = intent.getStringExtra("status");
                if (status != null && !status.isEmpty()) currentStatus = status;

                startForegroundServiceWithNotification();
            } else if (ACTION_UPDATE.equals(action)) {
                String status = intent.getStringExtra("status");
                if (status != null && !status.isEmpty()) {
                    currentStatus = status;
                    updateNotification();
                }
            } else if (ACTION_MUTE_TOGGLE.equals(action)) {
                isMuted = !isMuted;
                updateNotification();
            } else if (ACTION_STOP.equals(action)) {
                stopForegroundService();
            }
        }
        return START_STICKY;
    }

    private void startForegroundServiceWithNotification() {
        Notification notification = buildNotification();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            int serviceType = 0;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                serviceType |= ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE;
                serviceType |= ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA;
            }
            if (Build.VERSION.SDK_INT >= 34) { // Android 14+
                serviceType |= ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE;
            }
            startForeground(NOTIFICATION_ID, notification, serviceType);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
        Log.d(TAG, "LiveClassStreamingService running in foreground.");
    }

    private Notification buildNotification() {
        Intent openAppIntent = new Intent(this, MainActivity.class);
        openAppIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent openAppPendingIntent = PendingIntent.getActivity(
            this,
            0,
            openAppIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Intent muteIntent = new Intent(this, LiveClassStreamingService.class);
        muteIntent.setAction(ACTION_MUTE_TOGGLE);
        PendingIntent mutePendingIntent = PendingIntent.getService(
            this,
            1,
            muteIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Intent stopIntent = new Intent(this, LiveClassStreamingService.class);
        stopIntent.setAction(ACTION_STOP);
        PendingIntent stopPendingIntent = PendingIntent.getService(
            this,
            2,
            stopIntent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(currentClassTitle)
            .setContentText(currentStatus)
            .setSmallIcon(R.drawable.ic_notification)
            .setColor(getColor(R.color.colorPrimary))
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setContentIntent(openAppPendingIntent)
            .addAction(R.drawable.ic_notification, isMuted ? "Unmute Mic" : "Mute Mic", mutePendingIntent)
            .addAction(R.drawable.ic_notification, "Return to Class", openAppPendingIntent)
            .addAction(R.drawable.ic_notification, "End Session", stopPendingIntent)
            .build();
    }

    private void updateNotification() {
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) {
            manager.notify(NOTIFICATION_ID, buildNotification());
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Atomic Pathshala Live Teaching Service",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Maintains live stream, camera, microphone, and whiteboard active during teaching.");
            channel.setShowBadge(true);
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);

            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private void acquireLocks() {
        try {
            PowerManager powerManager = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (powerManager != null) {
                wakeLock = powerManager.newWakeLock(
                    PowerManager.PARTIAL_WAKE_LOCK,
                    "AtomicPathshala:LiveStreamWakeLock"
                );
                wakeLock.acquire(4 * 60 * 60 * 1000L); // Max 4 hours safety window
            }

            WifiManager wifiManager = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
            if (wifiManager != null) {
                wifiLock = wifiManager.createWifiLock(
                    WifiManager.WIFI_MODE_FULL_HIGH_PERF,
                    "AtomicPathshala:LiveStreamWifiLock"
                );
                wifiLock.acquire();
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to acquire WakeLock / WifiLock", e);
        }
    }

    private void releaseLocks() {
        try {
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
                wakeLock = null;
            }
            if (wifiLock != null && wifiLock.isHeld()) {
                wifiLock.release();
                wifiLock = null;
            }
        } catch (Exception e) {
            Log.e(TAG, "Error releasing WakeLock / WifiLock", e);
        }
    }

    private void stopForegroundService() {
        releaseLocks();
        stopForeground(true);
        stopSelf();
        Log.d(TAG, "LiveClassStreamingService stopped.");
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        releaseLocks();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
