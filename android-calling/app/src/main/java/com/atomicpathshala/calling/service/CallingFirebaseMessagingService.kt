package com.atomicpathshala.calling.service

import android.content.Context
import android.util.Log
import com.atomicpathshala.calling.telephony.CallDispatcher
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class CallingFirebaseMessagingService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Log.d("AtomicCalling", "New FCM Token received: $token")
        val prefs = getSharedPreferences("atomic_calling_prefs", Context.MODE_PRIVATE)
        prefs.edit().putString("fcm_token", token).apply()
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)
        Log.d("AtomicCalling", "Message received from: ${remoteMessage.from}")

        val data = remoteMessage.data
        val messageType = data["type"]

        if (messageType == "CRM_CALL_REQUEST") {
            val requestId = data["requestId"] ?: return
            val phone = data["phone"] ?: return
            val studentName = data["studentName"] ?: "Student"
            val preferredSim = data["preferredSim"]

            val prefs = getSharedPreferences("atomic_calling_prefs", Context.MODE_PRIVATE)
            val serverUrl = prefs.getString("server_url", "https://ap.atomicpathshala.in") ?: "https://ap.atomicpathshala.in"

            // Dispatch cellular SIM call
            val dispatcher = CallDispatcher(applicationContext)
            dispatcher.dispatchCall(
                serverUrl = serverUrl,
                requestId = requestId,
                phoneNumber = phone,
                studentName = studentName,
                preferredSim = preferredSim
            )
        }
    }
}
