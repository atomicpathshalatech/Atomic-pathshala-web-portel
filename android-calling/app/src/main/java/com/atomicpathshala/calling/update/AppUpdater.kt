package com.atomicpathshala.calling.update

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.core.content.FileProvider
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.TimeUnit

data class VersionInfo(
    val versionCode: Int,
    val versionName: String,
    val downloadUrl: String,
    val releaseNotes: String?
)

object AppUpdater {
    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .build()

    suspend fun checkForUpdate(serverUrl: String, currentVersionCode: Int): VersionInfo? {
        return withContext(Dispatchers.IO) {
            try {
                val cleanUrl = serverUrl.trimEnd('/')
                val req = Request.Builder()
                    .url("$cleanUrl/api/calling/version")
                    .get()
                    .build()

                val resp = client.newCall(req).execute()
                if (!resp.isSuccessful) return@withContext null

                val bodyStr = resp.body?.string() ?: return@withContext null
                val json = JSONObject(bodyStr)
                if (!json.optBoolean("success", false)) return@withContext null

                val data = json.getJSONObject("data")
                val remoteCode = data.getInt("versionCode")
                val remoteName = data.getString("versionName")
                val downloadUrl = data.getString("downloadUrl")
                val notes = data.optString("releaseNotes", "")

                if (remoteCode > currentVersionCode) {
                    VersionInfo(
                        versionCode = remoteCode,
                        versionName = remoteName,
                        downloadUrl = downloadUrl,
                        releaseNotes = notes
                    )
                } else {
                    null
                }
            } catch (e: Exception) {
                e.printStackTrace()
                null
            }
        }
    }

    suspend fun downloadAndInstallApk(
        context: Context,
        downloadUrl: String,
        onProgress: (Int) -> Unit
    ): Result<Unit> {
        return withContext(Dispatchers.IO) {
            try {
                val req = Request.Builder().url(downloadUrl).get().build()
                val resp = client.newCall(req).execute()

                if (!resp.isSuccessful) {
                    return@withContext Result.failure(Exception("Failed to download APK: HTTP ${resp.code}"))
                }

                val body = resp.body ?: return@withContext Result.failure(Exception("Empty download body"))
                val totalBytes = body.contentLength()

                val updateDir = File(context.cacheDir, "updates")
                if (!updateDir.exists()) updateDir.mkdirs()
                val apkFile = File(updateDir, "AtomicCalling_latest.apk")
                if (apkFile.exists()) apkFile.delete()

                val input = body.byteStream()
                val output = FileOutputStream(apkFile)

                val buffer = ByteArray(8 * 1024)
                var bytesRead: Int
                var downloadedBytes: Long = 0

                while (input.read(buffer).also { bytesRead = it } != -1) {
                    output.write(buffer, 0, bytesRead)
                    downloadedBytes += bytesRead
                    if (totalBytes > 0) {
                        val pct = ((downloadedBytes * 100) / totalBytes).toInt()
                        withContext(Dispatchers.Main) {
                            onProgress(pct)
                        }
                    }
                }

                output.flush()
                output.close()
                input.close()

                withContext(Dispatchers.Main) {
                    installApk(context, apkFile)
                }
                Result.success(Unit)
            } catch (e: Exception) {
                e.printStackTrace()
                Result.failure(e)
            }
        }
    }

    fun installApk(context: Context, apkFile: File) {
        try {
            val contentUri: Uri = FileProvider.getUriForFile(
                context,
                "${context.packageName}.fileprovider",
                apkFile
            )

            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(contentUri, "application/vnd.android.package-archive")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }

            context.startActivity(intent)
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }
}
