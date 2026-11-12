package com.atomicpathshala.app;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "FloatingPoll")
public class FloatingPollPlugin extends Plugin {

    private static final String TAG = "AtomicFloatingPoll";

    @PluginMethod
    public void checkPermission(PluginCall call) {
        JSObject ret = new JSObject();
        Context context = getContext();
        boolean granted = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            granted = Settings.canDrawOverlays(context);
        }
        Log.d(TAG, "[Permission] checkPermission: granted=" + granted);
        ret.put("granted", granted);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestPermission(PluginCall call) {
        JSObject ret = new JSObject();
        Context context = getContext();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (!Settings.canDrawOverlays(context)) {
                Log.d(TAG, "[Permission] Launching ACTION_MANAGE_OVERLAY_PERMISSION settings screen");
                Intent intent = new Intent(
                    Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:" + context.getPackageName())
                );
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(intent);
                ret.put("requested", true);
            } else {
                Log.d(TAG, "[Permission] Permission already granted");
                ret.put("requested", false);
            }
        } else {
            ret.put("requested", false);
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void startSession(PluginCall call) {
        Context context = getContext();
        String sessionId = call.getString("sessionId", "");
        String apiUrl = call.getString("apiUrl", "");
        Log.d(TAG, "[Lifecycle] startSession called: sessionId=" + sessionId + " apiUrl=" + apiUrl);

        Intent intent = new Intent(context, FloatingPollService.class);
        intent.setAction(FloatingPollService.ACTION_START_SESSION);
        intent.putExtra("sessionId", sessionId);
        intent.putExtra("apiUrl", apiUrl);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent);
        } else {
            context.startService(intent);
        }

        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void showPoll(PluginCall call) {
        Context context = getContext();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(context)) {
            Log.w(TAG, "[Overlay] Cannot show poll: Overlay permission denied by system.");
            call.reject("Display over other apps permission is not granted.");
            return;
        }

        String id = call.getString("id");
        String questionText = call.getString("questionText", "Live Class Poll");
        Integer timeLimitSec = call.getInt("timeLimitSec", 30);
        String startedAt = call.getString("startedAt", "");
        String sessionId = call.getString("sessionId", "");
        String apiUrl = call.getString("apiUrl", "");
        String mySelection = call.getString("mySelection", "");

        com.getcapacitor.JSArray optionsArr = call.getArray("options");
        String optionsJson = optionsArr != null ? optionsArr.toString() : "[]";

        Log.d(TAG, "[Event] showPoll: pollId=" + id + " timeLimitSec=" + timeLimitSec);

        Intent intent = new Intent(context, FloatingPollService.class);
        intent.setAction(FloatingPollService.ACTION_SHOW_POLL);
        intent.putExtra("id", id);
        intent.putExtra("questionText", questionText);
        intent.putExtra("timeLimitSec", timeLimitSec != null ? timeLimitSec : 30);
        intent.putExtra("startedAt", startedAt);
        intent.putExtra("sessionId", sessionId);
        intent.putExtra("apiUrl", apiUrl);
        intent.putExtra("optionsJson", optionsJson);
        intent.putExtra("mySelection", mySelection);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent);
        } else {
            context.startService(intent);
        }

        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void updateResults(PluginCall call) {
        Context context = getContext();
        String id = call.getString("id");
        String correctOption = call.getString("correctOption", "");
        Integer totalResponses = call.getInt("totalResponses", 0);
        JSObject countsObj = call.getObject("counts");
        String countsJson = countsObj != null ? countsObj.toString() : "{}";

        Log.d(TAG, "[Event] updateResults: pollId=" + id + " correctOption=" + correctOption + " total=" + totalResponses);

        Intent intent = new Intent(context, FloatingPollService.class);
        intent.setAction(FloatingPollService.ACTION_UPDATE_RESULTS);
        intent.putExtra("id", id);
        intent.putExtra("correctOption", correctOption);
        intent.putExtra("totalResponses", totalResponses != null ? totalResponses : 0);
        intent.putExtra("countsJson", countsJson);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent);
        } else {
            context.startService(intent);
        }

        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void dismissPoll(PluginCall call) {
        Context context = getContext();
        String id = call.getString("id", "");
        Log.d(TAG, "[Event] dismissPoll: pollId=" + id);

        Intent intent = new Intent(context, FloatingPollService.class);
        intent.setAction(FloatingPollService.ACTION_DISMISS_POLL);
        intent.putExtra("id", id);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent);
        } else {
            context.startService(intent);
        }

        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void stopService(PluginCall call) {
        Context context = getContext();
        Log.d(TAG, "[Lifecycle] stopService requested");
        Intent intent = new Intent(context, FloatingPollService.class);
        intent.setAction(FloatingPollService.ACTION_STOP_SERVICE);
        context.stopService(intent);

        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }
}
