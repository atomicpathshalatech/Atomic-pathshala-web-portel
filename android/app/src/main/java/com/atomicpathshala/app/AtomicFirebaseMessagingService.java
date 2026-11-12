package com.atomicpathshala.app;

import android.content.Intent;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;
import androidx.annotation.NonNull;
import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.util.Map;

public class AtomicFirebaseMessagingService extends MessagingService {

    private static final String TAG = "AtomicFloatingPoll";

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);

        try {
            Map<String, String> data = remoteMessage.getData();
            Log.d(TAG, "[FCM] Background push notification received: " + data);

            String eventType = data.get("eventType");
            String classId = data.get("classId");
            if (classId == null || classId.isEmpty()) {
                classId = data.get("entityId");
            }
            String deepLink = data.get("deepLink");
            if ((classId == null || classId.isEmpty()) && deepLink != null && deepLink.contains("/live-class/")) {
                classId = deepLink.substring(deepLink.lastIndexOf("/") + 1);
            }

            // If a live class started notification is received, automatically launch FloatingPollService!
            if ("LIVE_CLASS_STARTED".equals(eventType) || (classId != null && !classId.isEmpty())) {
                boolean hasOverlayPerm = true;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    hasOverlayPerm = Settings.canDrawOverlays(this);
                }

                if (hasOverlayPerm) {
                    Log.d(TAG, "[FCM] Live Class push received! Auto-activating FloatingPollService for class: " + classId);
                    Intent serviceIntent = new Intent(this, FloatingPollService.class);
                    serviceIntent.setAction(FloatingPollService.ACTION_START_SESSION);
                    serviceIntent.putExtra("sessionId", classId);
                    serviceIntent.putExtra("apiUrl", "https://ap.atomicpathshala.in");

                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        startForegroundService(serviceIntent);
                    } else {
                        startService(serviceIntent);
                    }
                } else {
                    Log.d(TAG, "[FCM] Overlay permission not granted; cannot auto-start floating poll over other apps.");
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "[FCM] Error in background push processing: " + e.getMessage(), e);
        }
    }
}
