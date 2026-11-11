package com.atomicpathshala.calling

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build

class AtomicCallingApp : Application() {

    companion object {
        const val CALL_NOTIFICATION_CHANNEL_ID = "atomic_crm_calls_channel"
        const val SYSTEM_NOTIFICATION_CHANNEL_ID = "atomic_crm_system_channel"
        lateinit var instance: AtomicCallingApp
            private set
    }

    override fun onCreate() {
        super.onCreate()
        instance = this
        createNotificationChannels()
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val notificationManager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

            // High Priority Channel for Incoming Calling Requests
            val callChannel = NotificationChannel(
                CALL_NOTIFICATION_CHANNEL_ID,
                "CRM Incoming Calls",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "High priority notifications to trigger cellular SIM student calls"
                enableVibration(true)
                setShowBadge(true)
            }

            // System Heartbeat / Status Channel
            val sysChannel = NotificationChannel(
                SYSTEM_NOTIFICATION_CHANNEL_ID,
                "CRM Device Status",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Heartbeat and background device status notifications"
            }

            notificationManager.createNotificationChannel(callChannel)
            notificationManager.createNotificationChannel(sysChannel)
        }
    }
}
