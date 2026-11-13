package com.atomicpathshala.app;

import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ActivityInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;
import android.webkit.CookieManager;
import android.webkit.URLUtil;
import android.widget.Toast;
import android.graphics.Color;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebChromeClient;
import android.widget.FrameLayout;
import androidx.activity.OnBackPressedCallback;
import androidx.appcompat.app.AlertDialog;
import androidx.core.graphics.Insets;
import androidx.core.splashscreen.SplashScreen;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.widget.Button;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;
import com.getcapacitor.BridgeWebViewClient;

/**
 * Video full screen inside the app. Capacitor's own WebChromeClient cancels
 * every full-screen request at once, so a player's full-screen button left
 * the video upright in the page. Here a full-screen request shows the video
 * over the whole screen, turned to landscape (either way round, by the
 * sensor), with the status / navigation bars hidden; Back or the player's
 * exit button returns to the page in portrait. Works for every player in
 * the app (recorded lectures, class recordings, YouTube).
 */
public class MainActivity extends BridgeActivity {
    private View fullscreenView;
    private WebChromeClient.CustomViewCallback fullscreenCallback;
    private final OnBackPressedCallback exitFullscreenOnBack = new OnBackPressedCallback(false) {
        @Override
        public void handleOnBackPressed() {
            exitFullscreen();
        }
    };

    /**
     * The launch splash stays until the first page has loaded (at least
     * SPLASH_MIN_MS, at most SPLASH_MAX_MS): no white or half-drawn page
     * flashes between the logo and the app.
     */
    private static final long SPLASH_MIN_MS = 1200;
    private static final long SPLASH_MAX_MS = 5000;

    private static final String PREFS_NAME = "atomic_prefs";
    private static final String KEY_OVERLAY_ASKED = "overlay_permission_prompted";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(FloatingPollPlugin.class);
        AtomicNotificationChannels.createAllChannels(this);

        final long start = SystemClock.uptimeMillis();
        SplashScreen.installSplashScreen(this).setKeepOnScreenCondition(() -> {
            long shown = SystemClock.uptimeMillis() - start;
            if (shown < SPLASH_MIN_MS) return true;
            if (shown > SPLASH_MAX_MS) return false;
            return bridge == null || bridge.getWebView().getProgress() < 100;
        });
        super.onCreate(savedInstanceState);
        getOnBackPressedDispatcher().addCallback(this, exitFullscreenOnBack);
        // The page keeps its own text size: with the phone set to large text,
        // Android scaled every font up and headers, bottom bars and buttons
        // spilled off the screen. 90 %: a little smaller than designed, so
        // everything fits on small phones too.
        bridge.getWebView().getSettings().setTextZoom(90);
        keepPageClearOfSystemBars();
        handleDownloads();
        checkAndPromptOverlayPermission();

        final String liveUrl = "https://ap.atomicpathshala.in/dashboard";
        bridge.getWebView().setWebViewClient(new BridgeWebViewClient(bridge) {
            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request != null && request.isForMainFrame()) {
                    String failingUrl = request.getUrl() != null ? request.getUrl().toString() : "";
                    if (failingUrl.contains("atomicpathshala.com") || failingUrl.isEmpty()) {
                        view.post(() -> {
                            view.clearCache(true);
                            view.loadUrl(liveUrl);
                        });
                        return;
                    }
                }
                super.onReceivedError(view, request, error);
            }
        });

        bridge.getWebView().post(() -> {
            String current = bridge.getWebView().getUrl();
            if (current == null || current.contains("atomicpathshala.com") || current.equals("about:blank")) {
                bridge.getWebView().clearCache(true);
                bridge.getWebView().loadUrl(liveUrl);
            }
        });

        bridge.getWebView().setWebChromeClient(new BridgeWebChromeClient(bridge) {
            @Override
            public void onShowCustomView(View view, CustomViewCallback callback) {
                enterFullscreen(view, callback);
            }

            @Override
            public void onHideCustomView() {
                exitFullscreen();
            }
        });
    }

    /**
     * Prompt student at install/first launch time for 'Display over other apps'
     * so polls float directly over YouTube without requiring in-class permission dialogs.
     */
    private void checkAndPromptOverlayPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (!Settings.canDrawOverlays(this)) {
                SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
                boolean alreadyAsked = prefs.getBoolean(KEY_OVERLAY_ASKED, false);
                if (!alreadyAsked) {
                    prefs.edit().putBoolean(KEY_OVERLAY_ASKED, true).apply();
                    try {
                        View dialogView = getLayoutInflater().inflate(R.layout.dialog_overlay_permission, null);
                        AlertDialog dialog = new AlertDialog.Builder(this)
                            .setView(dialogView)
                            .setCancelable(false)
                            .create();

                        if (dialog.getWindow() != null) {
                            dialog.getWindow().setBackgroundDrawableResource(android.R.color.transparent);
                        }

                        Button btnAllow = dialogView.findViewById(R.id.btnAllow);
                        Button btnCancel = dialogView.findViewById(R.id.btnCancel);

                        btnAllow.setOnClickListener(v -> {
                            dialog.dismiss();
                            try {
                                Intent intent = new Intent(
                                    Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                                    Uri.parse("package:" + getPackageName())
                                );
                                startActivity(intent);
                            } catch (Exception e) {
                                Intent fallback = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION);
                                startActivity(fallback);
                            }
                        });

                        btnCancel.setOnClickListener(v -> dialog.dismiss());
                        dialog.show();
                    } catch (Exception e) {
                        // Fallback in case of inflation exception
                        new AlertDialog.Builder(this, android.R.style.Theme_DeviceDefault_Light_Dialog_Alert)
                            .setTitle("Enable Live Polls Over YouTube")
                            .setMessage("Jab aap live class YouTube app me dekh rahe honge, tab bhi Teacher ke polls aapki screen par floating card me aayenge! Iske liye 'Display over other apps' allow karein.")
                            .setPositiveButton("Allow Permission", (dialog, which) -> {
                                try {
                                    Intent intent = new Intent(
                                        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                                        Uri.parse("package:" + getPackageName())
                                    );
                                    startActivity(intent);
                                } catch (Exception ex) {
                                    Intent fallback = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION);
                                    startActivity(fallback);
                                }
                            })
                            .setNegativeButton("Maybe Later", null)
                            .setCancelable(false)
                            .show();
                    }
                }
            }
        }
    }

    /**
     * Android 15+ draws apps edge to edge: the page went under the status bar
     * and the phone's bottom navigation bar (the live-class chat box sat
     * behind it and could not be tapped), and the keyboard covered inputs.
     * The page area is kept clear of the bars, the screen cutout and the
     * keyboard here, natively, so no web page has to handle it. Full-screen
     * video is added above all this and still uses the whole screen.
     */
    private void keepPageClearOfSystemBars() {
        View page = (View) bridge.getWebView().getParent();
        ViewCompat.setOnApplyWindowInsetsListener(page, (v, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());
            v.setPadding(bars.left, bars.top, bars.right, Math.max(bars.bottom, ime.bottom));
            return WindowInsetsCompat.CONSUMED;
        });
        ViewCompat.requestApplyInsets(page);
    }

    /**
     * File downloads (study PDFs, DPP / test PDFs, notes). A WebView ignores a
     * download link unless the app handles it — "Save" did nothing. Android's
     * DownloadManager saves the file to the phone's Downloads folder (with a
     * notification), sending the student's login cookie so private files work.
     */
    private void handleDownloads() {
        bridge.getWebView().setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> {
            try {
                String fileName = URLUtil.guessFileName(url, contentDisposition, mimeType);
                DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
                String cookies = CookieManager.getInstance().getCookie(url);
                if (cookies != null) request.addRequestHeader("Cookie", cookies);
                request.addRequestHeader("User-Agent", userAgent);
                request.setMimeType(mimeType);
                request.setTitle(fileName);
                request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName);
                DownloadManager dm = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
                dm.enqueue(request);
                Toast.makeText(this, "Downloading " + fileName, Toast.LENGTH_SHORT).show();
            } catch (Exception e) {
                Toast.makeText(this, "Could not download this file.", Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void enterFullscreen(View view, WebChromeClient.CustomViewCallback callback) {
        if (fullscreenView != null) {
            callback.onCustomViewHidden();
            return;
        }
        fullscreenView = view;
        fullscreenCallback = callback;
        view.setBackgroundColor(Color.BLACK);
        ViewGroup decor = (ViewGroup) getWindow().getDecorView();
        decor.addView(view, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        WindowInsetsControllerCompat bars = WindowCompat.getInsetsController(getWindow(), decor);
        bars.hide(WindowInsetsCompat.Type.systemBars());
        bars.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE);
        exitFullscreenOnBack.setEnabled(true);
    }

    private void exitFullscreen() {
        if (fullscreenView == null) return;
        ViewGroup decor = (ViewGroup) getWindow().getDecorView();
        decor.removeView(fullscreenView);
        fullscreenView = null;
        WindowCompat.getInsetsController(getWindow(), decor).show(WindowInsetsCompat.Type.systemBars());
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
        exitFullscreenOnBack.setEnabled(false);
        if (fullscreenCallback != null) {
            fullscreenCallback.onCustomViewHidden();
            fullscreenCallback = null;
        }
    }
}
