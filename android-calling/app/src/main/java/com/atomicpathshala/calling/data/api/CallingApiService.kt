package com.atomicpathshala.calling.data.api

import com.atomicpathshala.calling.data.model.*
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Response
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.Body
import retrofit2.http.POST
import retrofit2.http.Path
import java.util.concurrent.TimeUnit

interface CallingApiService {

    @POST("api/calling/devices/register")
    suspend fun registerDevice(@Body request: DeviceRegisterRequest): Response<DeviceRegisterResponse>

    @POST("api/calling/devices/{id}/heartbeat")
    suspend fun sendHeartbeat(
        @Path("id") deviceId: String,
        @Body request: HeartbeatRequest
    ): Response<ApiResponse<HeartbeatResponse>>

    @POST("api/calling/request/{id}/event")
    suspend fun postCallEvent(
        @Path("id") requestId: String,
        @Body request: CallEventRequest
    ): Response<ApiResponse<Any>>
}

object ApiClient {
    private var retrofit: Retrofit? = null

    fun getService(baseUrl: String): CallingApiService {
        val cleanUrl: String = try {
            var u = baseUrl.trim()
            if (u.startsWith("atp://")) {
                u = "https://" + u.removePrefix("atp://")
            }
            if (!u.startsWith("http://") && !u.startsWith("https://")) {
                u = "https://$u"
            }
            val formatted = if (u.endsWith("/")) u else "$u/"
            val uri = java.net.URI(formatted)
            if (uri.host.isNullOrBlank() || !uri.host.contains(".")) {
                "https://ap.atomicpathshala.in/"
            } else {
                formatted
            }
        } catch (e: Exception) {
            "https://ap.atomicpathshala.in/"
        }
        
        val logging = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BODY
        }

        val okHttpClient = OkHttpClient.Builder()
            .addInterceptor(logging)
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(15, TimeUnit.SECONDS)
            .build()

        retrofit = Retrofit.Builder()
            .baseUrl(cleanUrl)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()

        return retrofit!!.create(CallingApiService::class.java)
    }
}
