# Project specific ProGuard rules for Atomic Pathshala
# Capacitor Core & Plugin Interfaces
-keep public class com.getcapacitor.** { *; }
-keep class com.getcapacitor.BridgeActivity { *; }
-keep public class * extends com.getcapacitor.Plugin { *; }

# Preserve WebView JavaScript Interfaces
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Firebase & Push Notifications
-dontwarn com.google.firebase.**
-keep class com.google.firebase.** { *; }

# Apache HTTP and JSON parsing helpers
-dontwarn org.apache.http.**
-dontwarn android.net.http.AndroidHttpClient

# Preserve Line Numbers for Crash Reporting
-keepattributes SourceFile,LineNumberTable
