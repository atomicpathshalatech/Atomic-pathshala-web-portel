package com.atomicpathshala.calling.telephony

import android.annotation.SuppressLint
import android.content.Context
import android.os.Build
import android.telecom.PhoneAccountHandle
import android.telecom.TelecomManager
import android.telephony.SubscriptionInfo
import android.telephony.SubscriptionManager
import android.telephony.TelephonyManager

data class SimInfo(
    val slotIndex: Int,
    val subscriptionId: Int,
    val carrierName: String,
    val number: String?,
    val phoneAccountHandle: PhoneAccountHandle? = null
)

class SimManager(private val context: Context) {

    @SuppressLint("MissingPermission")
    fun getAvailableSims(): List<SimInfo> {
        val simList = mutableListOf<SimInfo>()
        try {
            val subscriptionManager = context.getSystemService(Context.TELEPHONY_SUBSCRIPTION_SERVICE) as? SubscriptionManager
                ?: return emptyList()

            val activeSubscriptions: List<SubscriptionInfo>? = subscriptionManager.activeSubscriptionInfoList

            if (!activeSubscriptions.isNullOrEmpty()) {
                val telecomManager = context.getSystemService(Context.TELECOM_SERVICE) as? TelecomManager
                val phoneAccountHandles = telecomManager?.callCapablePhoneAccounts ?: emptyList()

                activeSubscriptions.forEach { sub ->
                    val accountHandle = phoneAccountHandles.find { handle ->
                        handle.id.contains(sub.subscriptionId.toString()) || 
                        handle.id.contains(sub.iccId ?: "")
                    }

                    simList.add(
                        SimInfo(
                            slotIndex = sub.simSlotIndex,
                            subscriptionId = sub.subscriptionId,
                            carrierName = sub.carrierName?.toString() ?: "SIM ${sub.simSlotIndex + 1}",
                            number = sub.number?.takeIf { it.isNotBlank() },
                            phoneAccountHandle = accountHandle
                        )
                    )
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
        return simList
    }

    fun getSimByPreference(preference: String?): SimInfo? {
        val sims = getAvailableSims()
        if (sims.isEmpty()) return null

        return when (preference?.uppercase()) {
            "SIM_1" -> sims.find { it.slotIndex == 0 } ?: sims.firstOrNull()
            "SIM_2" -> sims.find { it.slotIndex == 1 } ?: sims.getOrNull(1) ?: sims.firstOrNull()
            else -> sims.firstOrNull()
        }
    }
}
