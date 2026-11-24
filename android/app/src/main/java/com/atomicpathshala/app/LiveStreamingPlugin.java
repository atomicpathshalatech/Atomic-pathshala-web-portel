package com.atomicpathshala.app;

import android.content.Context;
import android.content.Intent;
import android.os.BatteryManager;
import android.os.Build;
import android.os.PowerManager;
import android.util.Log;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "LiveStreaming")
public class LiveStreamingPlugin extends Plugin {

    private static final String TAG = "LiveStreamingPlugin";

    @PluginMethod
    public void startLiveService(PluginCall call) {
        try {
            Context context = getContext();
            String title = call.getString("title", "Atomic Pathshala Live Class");
            String status = call.getString("status", "Live streaming active");

            Intent intent = new Intent(context, LiveClassStreamingService.class);
            intent.setAction(LiveClassStreamingService.ACTION_START);
            intent.putExtra("classTitle", title);
            intent.putExtra("status", status);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent);
            } else {
                context.startService(intent);
            }

            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("foreground", true);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Failed to start LiveClassStreamingService", e);
            call.reject("Could not start foreground streaming service: " + e.getMessage());
        }
    }

    @PluginMethod
    public void updateLiveService(PluginCall call) {
        try {
            Context context = getContext();
            String status = call.getString("status", "Broadcasting to students");

            Intent intent = new Intent(context, LiveClassStreamingService.class);
            intent.setAction(LiveClassStreamingService.ACTION_UPDATE);
            intent.putExtra("status", status);

            context.startService(intent);

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Failed to update LiveClassStreamingService", e);
            call.reject("Could not update streaming service: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stopLiveService(PluginCall call) {
        try {
            Context context = getContext();
            Intent intent = new Intent(context, LiveClassStreamingService.class);
            intent.setAction(LiveClassStreamingService.ACTION_STOP);
            context.startService(intent);

            JSObject ret = new JSObject();
            ret.put("success", true);
            call.resolve(ret);
        } catch (Exception e) {
            Log.e(TAG, "Failed to stop LiveClassStreamingService", e);
            call.reject("Could not stop streaming service: " + e.getMessage());
        }
    }

    @PluginMethod
    public void checkDeviceStatus(PluginCall call) {
        try {
            Context context = getContext();
            BatteryManager bm = (BatteryManager) context.getSystemService(Context.BATTERY_SERVICE);
            int batteryLevel = -1;
            if (bm != null) {
                batteryLevel = bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY);
            }

            PowerManager pm = (PowerManager) context.getSystemService(Context.POWER_SERVICE);
            boolean isPowerSave = false;
            boolean isIgnoringBatteryOptimizations = true;
            if (pm != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                isPowerSave = pm.isPowerSaveMode();
            }
            if (pm != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                isIgnoringBatteryOptimizations = pm.isIgnoringBatteryOptimizations(context.getPackageName());
            }

            JSObject ret = new JSObject();
            ret.put("batteryLevel", batteryLevel);
            ret.put("isPowerSave", isPowerSave);
            ret.put("isIgnoringBatteryOptimizations", isIgnoringBatteryOptimizations);
            ret.put("deviceModel", Build.MODEL);
            ret.put("androidVersion", Build.VERSION.RELEASE);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Device status check failed: " + e.getMessage());
        }
    }
}
