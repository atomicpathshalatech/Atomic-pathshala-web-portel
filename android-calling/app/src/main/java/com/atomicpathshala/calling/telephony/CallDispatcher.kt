package com.atomicpathshala.calling.telephony

import android.Manifest
import android.annotation.SuppressLint
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.telecom.TelecomManager
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import com.atomicpathshala.calling.AtomicCallingApp
import com.atomicpathshala.calling.data.api.ApiClient
import com.atomicpathshala.calling.data.model.CallEventRequest
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class CallDispatcher(private val context: Context) {

    private val simManager = SimManager(context)

    /**
     * Attempts direct call placement if permissions are present and conditions met;
     * otherwise falls back to a high-priority heads-up notification with action intent.
     */
    fun dispatchCall(
        serverUrl: String,
        requestId: String,
        phoneNumber: String,
        studentName: String,
        preferredSim: String?
    ) {
        val cleanNumber = phoneNumber.replace(Regex("[^0-9+]"), "")
        val targetSim = simManager.getSimByPreference(preferredSim)

        // Post DELIVERED event to backend
        notifyBackendEvent(serverUrl, requestId, "DELIVERED")

        val hasCallPermission = ActivityCompat.checkSelfPermission(
            context,
            Manifest.permission.CALL_PHONE
        ) == PackageManager.PERMISSION_GRANTED

        if (hasCallPermission) {
            executeDirectCall(serverUrl, requestId, cleanNumber, targetSim)
        } else {
            postCallingNotificationFallback(serverUrl, requestId, cleanNumber, studentName, targetSim)
        }
    }

    @SuppressLint("MissingPermission")
    private fun executeDirectCall(
        serverUrl: String,
        requestId: String,
        phoneNumber: String,
        simInfo: SimInfo?
    ) {
        try {
            val callIntent = Intent(Intent.ACTION_CALL).apply {
                data = Uri.parse("tel:$phoneNumber")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK

                // Multi-SIM targeting
                if (simInfo?.phoneAccountHandle != null) {
                    putExtra(TelecomManager.EXTRA_PHONE_ACCOUNT_HANDLE, simInfo.phoneAccountHandle)
                }
                putExtra("com.android.phone.force.slot", true)
                putExtra("Cdma_Supp", true)
                putExtra("simSlot", simInfo?.slotIndex ?: 0)
            }

            context.startActivity(callIntent)

            notifyBackendEvent(
                serverUrl = serverUrl,
                requestId = requestId,
                status = "CALLING",
                remarks = "Direct call launched via SIM slot ${simInfo?.slotIndex ?: 0} (${simInfo?.carrierName ?: "Default"})"
            )

        } catch (e: Exception) {
            e.printStackTrace()
            // Fallback to DIAL
            executeDialIntent(serverUrl, requestId, phoneNumber, e.message)
        }
    }

    private fun executeDialIntent(
        serverUrl: String,
        requestId: String,
        phoneNumber: String,
        errorDetail: String?
    ) {
        try {
            val dialIntent = Intent(Intent.ACTION_DIAL).apply {
                data = Uri.parse("tel:$phoneNumber")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(dialIntent)

            notifyBackendEvent(
                serverUrl = serverUrl,
                requestId = requestId,
                status = "DIALER_OPENED",
                remarks = "Native dialer opened (Fallback: $errorDetail)"
            )
        } catch (e: Exception) {
            notifyBackendEvent(
                serverUrl = serverUrl,
                requestId = requestId,
                status = "FAILED",
                failureReason = "Could not open phone dialer: ${e.message}"
            )
        }
    }

    private fun postCallingNotificationFallback(
        serverUrl: String,
        requestId: String,
        phoneNumber: String,
        studentName: String,
        simInfo: SimInfo?
    ) {
        val notificationManager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        val callIntent = Intent(Intent.ACTION_DIAL).apply {
            data = Uri.parse("tel:$phoneNumber")
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }

        val pendingIntent = PendingIntent.getActivity(
            context,
            requestId.hashCode(),
            callIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(context, AtomicCallingApp.CALL_NOTIFICATION_CHANNEL_ID)
            .setSmallIcon(android.R.drawable.sym_action_call)
            .setContentTitle("CRM Call: $studentName")
            .setContentText("Tap to call $phoneNumber via ${simInfo?.carrierName ?: "SIM"}")
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setAutoCancel(true)
            .addAction(android.R.drawable.sym_action_call, "Call Student Now", pendingIntent)
            .setContentIntent(pendingIntent)
            .build()

        notificationManager.notify(requestId.hashCode(), notification)

        notifyBackendEvent(
            serverUrl = serverUrl,
            requestId = requestId,
            status = "DELIVERED",
            remarks = "Call prompt posted as high-priority notification on mobile"
        )
    }

    private fun notifyBackendEvent(
        serverUrl: String,
        requestId: String,
        status: String,
        durationSeconds: Int? = null,
        failureReason: String? = null,
        outcome: String? = null,
        remarks: String? = null
    ) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val api = ApiClient.getService(serverUrl)
                api.postCallEvent(
                    requestId = requestId,
                    request = CallEventRequest(
                        status = status,
                        durationSeconds = durationSeconds,
                        failureReason = failureReason,
                        outcome = outcome,
                        remarks = remarks
                    )
                )
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }
}
