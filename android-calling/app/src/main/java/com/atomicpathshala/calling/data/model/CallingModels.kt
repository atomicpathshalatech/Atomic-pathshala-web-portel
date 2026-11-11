package com.atomicpathshala.calling.data.model

import com.google.gson.annotations.SerializedName

data class DeviceRegisterRequest(
    @SerializedName("pairingCode") val pairingCode: String,
    @SerializedName("deviceIdentifier") val deviceIdentifier: String,
    @SerializedName("deviceName") val deviceName: String,
    @SerializedName("fcmToken") val fcmToken: String?,
    @SerializedName("androidVersion") val androidVersion: String?,
    @SerializedName("appVersion") val appVersion: String?,
    @SerializedName("batteryLevel") val batteryLevel: Int?,
    @SerializedName("networkType") val networkType: String?,
    @SerializedName("sim1Carrier") val sim1Carrier: String?,
    @SerializedName("sim1Number") val sim1Number: String?,
    @SerializedName("sim2Carrier") val sim2Carrier: String?,
    @SerializedName("sim2Number") val sim2Number: String?
)

data class DeviceRegisterResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("data") val data: DeviceData?
)

data class DeviceData(
    @SerializedName("deviceId") val deviceId: String,
    @SerializedName("deviceName") val deviceName: String,
    @SerializedName("assignedUserId") val assignedUserId: String?
)

data class HeartbeatRequest(
    @SerializedName("fcmToken") val fcmToken: String?,
    @SerializedName("batteryLevel") val batteryLevel: Int?,
    @SerializedName("networkType") val networkType: String?,
    @SerializedName("sim1Carrier") val sim1Carrier: String?,
    @SerializedName("sim2Carrier") val sim2Carrier: String?
)

data class CallEventRequest(
    @SerializedName("status") val status: String, // DELIVERED, DIALER_OPENED, CALLING, COMPLETED, FAILED
    @SerializedName("durationSeconds") val durationSeconds: Int? = null,
    @SerializedName("failureReason") val failureReason: String? = null,
    @SerializedName("outcome") val outcome: String? = null,
    @SerializedName("remarks") val remarks: String? = null
)

data class ApiResponse<T>(
    @SerializedName("success") val success: Boolean,
    @SerializedName("data") val data: T?,
    @SerializedName("error") val error: String?
)
