package com.atomicpathshala.app;

import android.content.pm.ActivityInfo;
import android.graphics.Color;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebChromeClient;
import android.widget.FrameLayout;
import androidx.activity.OnBackPressedCallback;
import androidx.core.graphics.Insets;
import androidx.core.splashscreen.SplashScreen;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;

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

    /** The launch splash stays this long, so the page has painted before it goes (no white / half-drawn flash). */
    private static final long SPLASH_MIN_MS = 1200;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        final long start = SystemClock.uptimeMillis();
        SplashScreen.installSplashScreen(this).setKeepOnScreenCondition(() -> SystemClock.uptimeMillis() - start < SPLASH_MIN_MS);
        super.onCreate(savedInstanceState);
        getOnBackPressedDispatcher().addCallback(this, exitFullscreenOnBack);
        keepPageClearOfSystemBars();
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
