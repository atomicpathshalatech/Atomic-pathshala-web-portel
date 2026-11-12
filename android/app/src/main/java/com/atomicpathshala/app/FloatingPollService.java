package com.atomicpathshala.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.CountDownTimer;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.provider.Settings;
import android.util.DisplayMetrics;
import android.util.Log;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.widget.Button;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;
import androidx.core.app.NotificationCompat;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.TimeZone;
import org.json.JSONArray;
import org.json.JSONObject;

public class FloatingPollService extends Service {

    private static final String TAG = "AtomicFloatingPoll";

    public static final String ACTION_START_SESSION = "com.atomicpathshala.app.ACTION_START_SESSION";
    public static final String ACTION_SHOW_POLL = "com.atomicpathshala.app.ACTION_SHOW_POLL";
    public static final String ACTION_UPDATE_RESULTS = "com.atomicpathshala.app.ACTION_UPDATE_RESULTS";
    public static final String ACTION_DISMISS_POLL = "com.atomicpathshala.app.ACTION_DISMISS_POLL";
    public static final String ACTION_STOP_SERVICE = "com.atomicpathshala.app.ACTION_STOP_SERVICE";

    private static final String CHANNEL_ID = "atomic_live_poll_channel";
    private static final int NOTIFICATION_ID = 8842;

    private WindowManager windowManager;
    private View floatingView;
    private WindowManager.LayoutParams params;

    private String currentPollId = null;
    private String currentSessionId = null;
    private String currentApiUrl = null;
    private String userSelection = null;
    private CountDownTimer countDownTimer;
    private TextView timerView;
    private TextView statusView;
    private LinearLayout optionsLayout;
    private List<Button> optionButtons = new ArrayList<>();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    private volatile boolean isRunning = false;
    private Thread syncWorkerThread = null;

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "[Lifecycle] FloatingPollService onCreate");
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        startAsForeground();
        isRunning = true;
    }

    private void startAsForeground() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Atomic Pathshala Live Poll",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Floating Poll Sync during Live Class");
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }

        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Atomic Pathshala Live Class")
            .setContentText("YouTube Floating Poll active")
            .setSmallIcon(R.mipmap.ic_launcher)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .build();

        startForeground(NOTIFICATION_ID, notification);
        Log.d(TAG, "[Lifecycle] startForeground notification established");
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) return START_NOT_STICKY;

        String action = intent.getAction();
        Log.d(TAG, "[Command] onStartCommand action=" + action);

        if (ACTION_START_SESSION.equals(action)) {
            handleStartSession(intent);
        } else if (ACTION_SHOW_POLL.equals(action)) {
            handleShowPoll(intent);
        } else if (ACTION_UPDATE_RESULTS.equals(action)) {
            handleUpdateResults(intent);
        } else if (ACTION_DISMISS_POLL.equals(action)) {
            handleDismissPoll();
        } else if (ACTION_STOP_SERVICE.equals(action)) {
            handleStopService();
        }

        return START_NOT_STICKY;
    }

    private int dpToPx(float dp) {
        DisplayMetrics metrics = getResources().getDisplayMetrics();
        return Math.round(dp * metrics.density);
    }

    private int dpToPx(int dp) {
        return dpToPx((float) dp);
    }

    private void handleStartSession(Intent intent) {
        currentSessionId = intent.getStringExtra("sessionId");
        currentApiUrl = intent.getStringExtra("apiUrl");
        Log.d(TAG, "[Session] Class session initialized: sessionId=" + currentSessionId + " apiUrl=" + currentApiUrl);

        startBackgroundSyncWorker();
    }

    private synchronized void startBackgroundSyncWorker() {
        if (syncWorkerThread != null && syncWorkerThread.isAlive()) return;

        syncWorkerThread = new Thread(() -> {
            Log.d(TAG, "[SyncWorker] Background poll syncer started for YouTube compatibility");
            while (isRunning) {
                try {
                    if (currentSessionId != null && currentApiUrl != null) {
                        pollBackendClassQuiz();
                    }
                    Thread.sleep(1500); // Check every 1.5 seconds while outside app
                } catch (InterruptedException e) {
                    break;
                } catch (Exception e) {
                    Log.w(TAG, "[SyncWorker] Sync loop warning: " + e.getMessage());
                }
            }
            Log.d(TAG, "[SyncWorker] Background poll syncer stopped");
        });
        syncWorkerThread.setDaemon(true);
        syncWorkerThread.start();
    }

    private void pollBackendClassQuiz() {
        try {
            String base = currentApiUrl;
            if (base.endsWith("/")) base = base.substring(0, base.length() - 1);
            URL url = new URL(base + "/api/whiteboard/sessions/" + currentSessionId + "/quiz");
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(4000);
            conn.setReadTimeout(4000);

            String cookie = CookieManager.getInstance().getCookie(base);
            if (cookie != null) {
                conn.setRequestProperty("Cookie", cookie);
            }

            int code = conn.getResponseCode();
            if (code == 200) {
                BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8));
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    sb.append(line);
                }
                reader.close();

                JSONObject res = new JSONObject(sb.toString());
                if (res.optBoolean("success", false)) {
                    JSONObject data = res.optJSONObject("data");
                    if (data != null && data.has("quiz") && !data.isNull("quiz")) {
                        JSONObject quizObj = data.getJSONObject("quiz");
                        String status = quizObj.optString("status", "");
                        String quizId = quizObj.optString("id", "");

                        if ("ACTIVE".equals(status)) {
                            if (currentPollId == null || !currentPollId.equals(quizId)) {
                                Log.d(TAG, "[SyncWorker] ACTIVE poll found over YouTube: " + quizId);
                                String question = quizObj.optString("questionText", "Live Class Poll");
                                int timeLimit = quizObj.optInt("timeLimitSec", 30);
                                String startedAt = quizObj.optString("startedAt", "");
                                String optionsJson = quizObj.optJSONArray("options") != null ? quizObj.getJSONArray("options").toString() : "[]";
                                String mySelection = data.optString("mySelection", null);

                                currentPollId = quizId;
                                userSelection = mySelection;

                                mainHandler.post(() -> {
                                    removeFloatingView();
                                    buildAndAttachOverlay(question, optionsJson, timeLimit, startedAt);
                                });
                            }
                        } else if ("REVEALED".equals(status)) {
                            if (currentPollId != null && currentPollId.equals(quizId)) {
                                String correctOpt = quizObj.optString("correctOption", "");
                                int total = quizObj.optInt("totalVotes", 0);
                                JSONObject counts = quizObj.optJSONObject("counts");
                                String countsJson = counts != null ? counts.toString() : "{}";

                                mainHandler.post(() -> updateOverlayResults(correctOpt, total, countsJson));
                            }
                        } else if ("CLOSED".equals(status)) {
                            if (currentPollId != null && currentPollId.equals(quizId)) {
                                Log.d(TAG, "[SyncWorker] Poll closed on server: " + quizId);
                                mainHandler.post(this::removeFloatingView);
                            }
                        }
                    } else {
                        if (currentPollId != null) {
                            mainHandler.post(this::removeFloatingView);
                        }
                    }
                }
            }
        } catch (Exception e) {
            // non-fatal periodic error
        }
    }

    private void handleShowPoll(Intent intent) {
        currentPollId = intent.getStringExtra("id");
        currentSessionId = intent.getStringExtra("sessionId");
        currentApiUrl = intent.getStringExtra("apiUrl");
        userSelection = intent.getStringExtra("mySelection");
        if (userSelection != null && userSelection.isEmpty()) userSelection = null;

        String questionText = intent.getStringExtra("questionText");
        int timeLimitSec = intent.getIntExtra("timeLimitSec", 30);
        String startedAt = intent.getStringExtra("startedAt");
        String optionsJson = intent.getStringExtra("optionsJson");

        Log.d(TAG, "[Overlay] handleShowPoll: pollId=" + currentPollId + " timeLimit=" + timeLimitSec);

        mainHandler.post(() -> {
            removeFloatingView();
            buildAndAttachOverlay(questionText, optionsJson, timeLimitSec, startedAt);
        });
    }

    private void buildAndAttachOverlay(String questionText, String optionsJson, int timeLimitSec, String startedAt) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
            Log.w(TAG, "[Overlay] Cannot attach overlay: ACTION_MANAGE_OVERLAY_PERMISSION is not granted.");
            return;
        }

        optionButtons.clear();

        // Root container (Dark translucent card with blue border)
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dpToPx(12), dpToPx(10), dpToPx(12), dpToPx(12));

        GradientDrawable bg = new GradientDrawable();
        bg.setColor(Color.parseColor("#E6090D18")); // 90% dark glass
        bg.setCornerRadius(dpToPx(16));
        bg.setStroke(dpToPx(1.5f), Color.parseColor("#3B82F6"));
        root.setBackground(bg);

        // Header Bar (Brand Badge, Title, Timer, Close)
        LinearLayout header = new LinearLayout(this);
        header.setOrientation(LinearLayout.HORIZONTAL);
        header.setGravity(Gravity.CENTER_VERTICAL);
        header.setPadding(0, 0, 0, dpToPx(8));

        // Drag handle indicator
        TextView dragIcon = new TextView(this);
        dragIcon.setText("⋮⋮ ");
        dragIcon.setTextColor(Color.parseColor("#94A3B8"));
        dragIcon.setTextSize(14f);
        header.addView(dragIcon);

        // Atomic Pathshala Brand Chip
        TextView brandBadge = new TextView(this);
        brandBadge.setText("LIVE POLL");
        brandBadge.setTextColor(Color.parseColor("#60A5FA"));
        brandBadge.setTextSize(10f);
        brandBadge.setTypeface(null, Typeface.BOLD);
        brandBadge.setPadding(dpToPx(6), dpToPx(2), dpToPx(6), dpToPx(2));
        GradientDrawable badgeBg = new GradientDrawable();
        badgeBg.setColor(Color.parseColor("#263B82F6"));
        badgeBg.setCornerRadius(dpToPx(4));
        brandBadge.setBackground(badgeBg);
        header.addView(brandBadge);

        // Timer Countdown
        timerView = new TextView(this);
        timerView.setTextSize(11f);
        timerView.setTypeface(Typeface.MONOSPACE, Typeface.BOLD);
        timerView.setTextColor(Color.parseColor("#F59E0B"));
        timerView.setPadding(dpToPx(8), 0, 0, 0);
        timerView.setText("⏳ " + timeLimitSec + "s");
        header.addView(timerView);

        // Spacer
        View spacer = new View(this);
        LinearLayout.LayoutParams spacerLp = new LinearLayout.LayoutParams(0, 1, 1f);
        header.addView(spacer, spacerLp);

        // Close X button (Allows student to locally dismiss their overlay)
        TextView closeBtn = new TextView(this);
        closeBtn.setText(" ✕ ");
        closeBtn.setTextColor(Color.parseColor("#9CA3AF"));
        closeBtn.setTextSize(14f);
        closeBtn.setPadding(dpToPx(6), dpToPx(2), dpToPx(6), dpToPx(2));
        closeBtn.setOnClickListener(v -> handleDismissPoll());
        header.addView(closeBtn);

        root.addView(header);

        // Question Text
        if (questionText != null && !questionText.isEmpty()) {
            TextView qView = new TextView(this);
            qView.setText(questionText);
            qView.setTextColor(Color.WHITE);
            qView.setTextSize(12f);
            qView.setTypeface(null, Typeface.BOLD);
            qView.setMaxLines(3);
            qView.setPadding(0, 0, 0, dpToPx(8));
            root.addView(qView);
        }

        // Options List
        optionsLayout = new LinearLayout(this);
        optionsLayout.setOrientation(LinearLayout.VERTICAL);

        try {
            JSONArray arr = new JSONArray(optionsJson);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject obj = arr.getJSONObject(i);
                final String key = obj.optString("key", String.valueOf((char) ('A' + i)));
                final String label = obj.optString("label", "Option " + key);

                final Button optBtn = new Button(this);
                optBtn.setText(key + ".  " + label);
                optBtn.setTextColor(Color.WHITE);
                optBtn.setTextSize(12f);
                optBtn.setAllCaps(false);
                optBtn.setGravity(Gravity.START | Gravity.CENTER_VERTICAL);
                optBtn.setPadding(dpToPx(10), dpToPx(8), dpToPx(10), dpToPx(8));

                updateButtonAppearance(optBtn, key.equals(userSelection), false);

                final boolean hasVoted = userSelection != null;
                optBtn.setEnabled(!hasVoted);

                optBtn.setOnClickListener(v -> handleOptionClicked(key));

                LinearLayout.LayoutParams btnLp = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    dpToPx(38)
                );
                btnLp.setMargins(0, dpToPx(2), 0, dpToPx(2));
                optionsLayout.addView(optBtn, btnLp);
                optionButtons.add(optBtn);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        root.addView(optionsLayout);

        // Status view
        statusView = new TextView(this);
        statusView.setTextSize(10f);
        statusView.setTextColor(Color.parseColor("#9CA3AF"));
        statusView.setPadding(0, dpToPx(6), 0, 0);
        statusView.setText(userSelection != null ? "Voted (" + userSelection + ") ✓" : "Tap an option to vote");
        root.addView(statusView);

        // Setup Window Layout Params
        int layoutType = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            : WindowManager.LayoutParams.TYPE_PHONE;

        int screenWidth = getResources().getDisplayMetrics().widthPixels;
        int screenHeight = getResources().getDisplayMetrics().heightPixels;
        boolean isLandscape = getResources().getConfiguration().orientation == Configuration.ORIENTATION_LANDSCAPE;

        int cardWidth = isLandscape
            ? Math.min(dpToPx(480), Math.round(screenWidth * 0.70f))
            : Math.min(dpToPx(360), Math.round(screenWidth * 0.90f));

        params = new WindowManager.LayoutParams(
            cardWidth,
            WindowManager.LayoutParams.WRAP_CONTENT,
            layoutType,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE |
            WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        );

        params.gravity = Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL;
        params.x = 0;
        params.y = dpToPx(80); // Floating comfortably above bottom YouTube controls

        // Make floating card draggable using ONLY the header view to avoid blocking button taps
        header.setOnTouchListener(new View.OnTouchListener() {
            private int initialX, initialY;
            private float initialTouchX, initialTouchY;

            @Override
            public boolean onTouch(View v, MotionEvent event) {
                switch (event.getAction()) {
                    case MotionEvent.ACTION_DOWN:
                        initialX = params.x;
                        initialY = params.y;
                        initialTouchX = event.getRawX();
                        initialTouchY = event.getRawY();
                        return true;
                    case MotionEvent.ACTION_MOVE:
                        int dx = (int) (event.getRawX() - initialTouchX);
                        int dy = (int) (initialTouchY - event.getRawY());
                        params.x = initialX + dx;
                        params.y = Math.max(dpToPx(16), Math.min(screenHeight - dpToPx(120), initialY + dy));
                        if (floatingView != null) {
                            try {
                                windowManager.updateViewLayout(floatingView, params);
                            } catch (Exception ignored) {}
                        }
                        return true;
                    case MotionEvent.ACTION_UP:
                        return true;
                }
                return false;
            }
        });

        floatingView = root;
        try {
            windowManager.addView(floatingView, params);
            Log.d(TAG, "[Overlay] WindowManager.addView SUCCESS for pollId=" + currentPollId);
        } catch (Exception e) {
            Log.e(TAG, "[Overlay] WindowManager.addView FAILED: " + e.getMessage(), e);
        }

        startTimer(startedAt, timeLimitSec);
    }

    private void updateButtonAppearance(Button btn, boolean isSelected, boolean isCorrect) {
        GradientDrawable d = new GradientDrawable();
        if (isCorrect) {
            d.setColor(Color.parseColor("#15803D")); // Emerald green
            d.setStroke(dpToPx(1.5f), Color.parseColor("#4ADE80"));
        } else if (isSelected) {
            d.setColor(Color.parseColor("#1E3A8A")); // Deep blue
            d.setStroke(dpToPx(1.5f), Color.parseColor("#60A5FA"));
        } else {
            d.setColor(Color.parseColor("#1F2430")); // Charcoal
            d.setStroke(dpToPx(1), Color.parseColor("#374151"));
        }
        d.setCornerRadius(dpToPx(8));
        btn.setBackground(d);
    }

    private void startTimer(String startedAtStr, int timeLimitSec) {
        if (countDownTimer != null) {
            countDownTimer.cancel();
        }

        long elapsedSec = 0;
        try {
            if (startedAtStr != null && !startedAtStr.isEmpty()) {
                SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US);
                sdf.setTimeZone(TimeZone.getTimeZone("UTC"));
                Date started = sdf.parse(startedAtStr.replace("Z", ""));
                if (started != null) {
                    elapsedSec = Math.max(0, (System.currentTimeMillis() - started.getTime()) / 1000);
                }
            }
        } catch (Exception ignored) {}

        long remainingSec = Math.max(0, timeLimitSec - elapsedSec);

        countDownTimer = new CountDownTimer(remainingSec * 1000, 1000) {
            @Override
            public void onTick(long millisUntilFinished) {
                if (timerView != null) {
                    timerView.setText("⏳ " + (millisUntilFinished / 1000) + "s");
                }
            }

            @Override
            public void onFinish() {
                if (timerView != null) {
                    timerView.setText("Time Up");
                    timerView.setTextColor(Color.parseColor("#EF4444"));
                }
                for (Button btn : optionButtons) {
                    btn.setEnabled(false);
                }
                if (statusView != null && userSelection == null) {
                    statusView.setText("Submissions closed.");
                }
            }
        };
        countDownTimer.start();
    }

    private void handleOptionClicked(String key) {
        userSelection = key;
        for (Button btn : optionButtons) {
            btn.setEnabled(false);
            if (btn.getText().toString().startsWith(key + ".")) {
                updateButtonAppearance(btn, true, false);
            }
        }
        if (statusView != null) {
            statusView.setText("Voted (" + key + ") ✓ Submitting...");
        }

        // Post answer in background thread
        new Thread(() -> {
            boolean success = false;
            try {
                if (currentApiUrl != null && currentSessionId != null && currentPollId != null) {
                    String base = currentApiUrl;
                    if (base.endsWith("/")) base = base.substring(0, base.length() - 1);
                    URL url = new URL(base + "/api/whiteboard/sessions/" + currentSessionId + "/quiz/" + currentPollId + "/respond");
                    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                    conn.setRequestMethod("POST");
                    conn.setRequestProperty("Content-Type", "application/json");
                    conn.setDoOutput(true);
                    conn.setConnectTimeout(6000);
                    conn.setReadTimeout(6000);

                    // Forward browser cookies (session auth)
                    String cookie = CookieManager.getInstance().getCookie(base);
                    if (cookie != null) {
                        conn.setRequestProperty("Cookie", cookie);
                    }

                    JSONObject body = new JSONObject();
                    body.put("selectedOption", key);

                    try (OutputStream os = conn.getOutputStream()) {
                        os.write(body.toString().getBytes(StandardCharsets.UTF_8));
                    }

                    int code = conn.getResponseCode();
                    Log.d(TAG, "[Answer] Submitted vote " + key + " - HTTP response code: " + code);
                    success = (code >= 200 && code < 300);
                }
            } catch (Exception e) {
                Log.e(TAG, "[Answer] Vote submission error: " + e.getMessage(), e);
            }

            final boolean finalSuccess = success;
            mainHandler.post(() -> {
                if (statusView != null) {
                    statusView.setText(finalSuccess ? "Voted (" + key + ") ✓ Response recorded" : "Voted (" + key + ") · Offline");
                }
            });
        }).start();
    }

    private void handleUpdateResults(Intent intent) {
        String correctOption = intent.getStringExtra("correctOption");
        int totalResponses = intent.getIntExtra("totalResponses", 0);
        String countsJson = intent.getStringExtra("countsJson");

        mainHandler.post(() -> updateOverlayResults(correctOption, totalResponses, countsJson));
    }

    private void updateOverlayResults(String correctOption, int totalResponses, String countsJson) {
        if (countDownTimer != null) {
            countDownTimer.cancel();
            countDownTimer = null;
        }

        if (timerView != null) {
            timerView.setText("✓ Result");
            timerView.setTextColor(Color.parseColor("#4ADE80"));
        }

        JSONObject counts = null;
        try {
            if (countsJson != null) counts = new JSONObject(countsJson);
        } catch (Exception ignored) {}

        for (Button btn : optionButtons) {
            btn.setEnabled(false);
            String text = btn.getText().toString();
            String optKey = text.length() > 0 ? text.substring(0, 1) : "";

            boolean isCorrect = correctOption != null && correctOption.equalsIgnoreCase(optKey);
            boolean isSelected = userSelection != null && userSelection.equalsIgnoreCase(optKey);

            updateButtonAppearance(btn, isSelected, isCorrect);

            if (counts != null && totalResponses > 0) {
                int count = counts.optInt(optKey, 0);
                int pct = Math.round((count * 100f) / totalResponses);
                btn.setText(optKey + ". " + pct + "% (" + count + ")");
            }
        }

        if (statusView != null) {
            if (correctOption != null && !correctOption.isEmpty()) {
                boolean gotRight = userSelection != null && userSelection.equalsIgnoreCase(correctOption);
                statusView.setText(gotRight ? "🎉 Correct! Correct answer: " + correctOption : "Answer: " + correctOption + " (" + totalResponses + " responses)");
            } else {
                statusView.setText("Total responses: " + totalResponses);
            }
        }
        Log.d(TAG, "[Overlay] Overlay results updated successfully");
    }

    private void handleDismissPoll() {
        Log.d(TAG, "[Overlay] handleDismissPoll called");
        mainHandler.post(this::removeFloatingView);
    }

    private void handleStopService() {
        Log.d(TAG, "[Lifecycle] handleStopService called");
        isRunning = false;
        handleDismissPoll();
        stopForeground(true);
        stopSelf();
    }

    private void removeFloatingView() {
        if (countDownTimer != null) {
            countDownTimer.cancel();
            countDownTimer = null;
        }
        if (floatingView != null && windowManager != null) {
            try {
                windowManager.removeView(floatingView);
                Log.d(TAG, "[Overlay] windowManager.removeView success");
            } catch (Exception ignored) {}
            floatingView = null;
        }
        currentPollId = null;
    }

    @Override
    public void onConfigurationChanged(Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        if (floatingView != null && windowManager != null && params != null) {
            int screenWidth = getResources().getDisplayMetrics().widthPixels;
            boolean isLandscape = newConfig.orientation == Configuration.ORIENTATION_LANDSCAPE;
            params.width = isLandscape
                ? Math.min(dpToPx(480), Math.round(screenWidth * 0.70f))
                : Math.min(dpToPx(360), Math.round(screenWidth * 0.90f));
            try {
                windowManager.updateViewLayout(floatingView, params);
            } catch (Exception ignored) {}
        }
    }

    @Override
    public void onDestroy() {
        Log.d(TAG, "[Lifecycle] FloatingPollService onDestroy");
        isRunning = false;
        removeFloatingView();
        super.onDestroy();
    }
}
