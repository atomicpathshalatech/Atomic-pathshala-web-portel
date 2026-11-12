package com.atomicpathshala.calling.ui

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import com.atomicpathshala.calling.data.api.ApiClient
import com.atomicpathshala.calling.data.model.DeviceRegisterRequest
import com.atomicpathshala.calling.data.model.HeartbeatRequest
import com.atomicpathshala.calling.telephony.CallDispatcher
import com.atomicpathshala.calling.telephony.SimManager
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class MainActivity : ComponentActivity() {

    private val requiredPermissions = mutableListOf(
        Manifest.permission.CALL_PHONE,
        Manifest.permission.READ_PHONE_STATE,
        Manifest.permission.CAMERA
    ).apply {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            add(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { /* Handled in Compose */ }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        requestAppPermissions()

        setContent {
            MaterialTheme(
                colorScheme = lightColorScheme(
                    primary = Color(0xFF0052CC),
                    onPrimary = Color.White,
                    background = Color(0xFFF8FAFC),
                    surface = Color.White,
                    onSurface = Color(0xFF0F172A)
                )
            ) {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    CallingMainScreen(
                        context = this,
                        onRequestPermissions = { requestAppPermissions() }
                    )
                }
            }
        }
    }

    private fun requestAppPermissions() {
        val permissionsToRequest = requiredPermissions.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }
        if (permissionsToRequest.isNotEmpty()) {
            permissionLauncher.launch(permissionsToRequest.toTypedArray())
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CallingMainScreen(context: Context, onRequestPermissions: () -> Unit) {
    val prefs = remember { context.getSharedPreferences("atomic_calling_prefs", Context.MODE_PRIVATE) }
    var isPaired by remember { mutableStateOf(prefs.getBoolean("is_paired", false)) }
    var deviceId by remember { mutableStateOf(prefs.getString("device_id", "") ?: "") }
    var deviceName by remember { mutableStateOf(prefs.getString("device_name", "Handset") ?: "Handset") }
    var serverUrl by remember { mutableStateOf(prefs.getString("server_url", "https://ap.atomicpathshala.in") ?: "https://ap.atomicpathshala.in") }

    val scope = rememberCoroutineScope()
    val simManager = remember { SimManager(context) }
    val sims = remember { simManager.getAvailableSims() }

    // Pairing inputs
    var inputCode by remember { mutableStateOf("") }
    var inputServer by remember { mutableStateOf(serverUrl) }
    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var statusText by remember { mutableStateOf("Online & Listening for CRM calls") }

    val callDispatcher = remember { CallDispatcher(context) }
    var lastHandledRequestId by remember { mutableStateOf("") }

    // Automatic Live Heartbeat & Instant Call Dispatch Loop (every 2.5 seconds)
    LaunchedEffect(isPaired, deviceId, serverUrl) {
        if (!isPaired || deviceId.isBlank()) return@LaunchedEffect
        while (isActive) {
            try {
                val api = ApiClient.getService(serverUrl)
                val bm = context.getSystemService(Context.BATTERY_SERVICE) as? android.os.BatteryManager
                val battery = bm?.getIntProperty(android.os.BatteryManager.BATTERY_PROPERTY_CAPACITY) ?: 88

                val response = api.sendHeartbeat(
                    deviceId = deviceId,
                    request = HeartbeatRequest(
                        fcmToken = null,
                        batteryLevel = battery,
                        networkType = "CELLULAR",
                        sim1Carrier = sims.firstOrNull()?.carrierName,
                        sim2Carrier = sims.getOrNull(1)?.carrierName
                    )
                )

                if (response.isSuccessful && response.body()?.success == true) {
                    val pending = response.body()?.data?.pendingCall
                    if (pending != null && pending.requestId != lastHandledRequestId) {
                        lastHandledRequestId = pending.requestId
                        statusText = "Placing cellular call to ${pending.studentName ?: pending.phone}..."
                        callDispatcher.dispatchCall(
                            serverUrl = serverUrl,
                            requestId = pending.requestId,
                            phoneNumber = pending.phone,
                            studentName = pending.studentName ?: "Student",
                            preferredSim = pending.preferredSim
                        )
                    } else if (!statusText.startsWith("Placing")) {
                        statusText = "Online & Listening for CRM calls"
                    }
                }
            } catch (e: Exception) {
                // Background retry
            }
            delay(2500)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(
                            Icons.Default.PhoneInTalk,
                            contentDescription = null,
                            tint = Color(0xFF0052CC),
                            modifier = Modifier.size(24.dp)
                        )
                        Spacer(modifier = Modifier.width(10.dp))
                        Text(
                            "Atomic Calling",
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF0F172A)
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.White)
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            if (!isPaired) {
                // UNPAIRED STATE — PAIRING FORM
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(24.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                ) {
                    Column(
                        modifier = Modifier.padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally
                    ) {
                        Box(
                            modifier = Modifier
                                .size(64.dp)
                                .clip(CircleShape)
                                .background(Color(0xFFEBF3FF)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                Icons.Default.QrCodeScanner,
                                contentDescription = null,
                                tint = Color(0xFF0052CC),
                                modifier = Modifier.size(32.dp)
                            )
                        }

                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            "Pair with Atomic CRM",
                            fontSize = 18.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF0F172A)
                        )
                        Text(
                            "Enter the 6-digit code generated in your CRM laptop dashboard to connect this physical SIM.",
                            fontSize = 12.sp,
                            color = Color(0xFF64748B),
                            lineHeight = 18.sp,
                            modifier = Modifier.padding(top = 4.dp, bottom = 20.dp)
                        )

                        OutlinedTextField(
                            value = inputCode,
                            onValueChange = { if (it.length <= 6) inputCode = it },
                            label = { Text("6-Digit Pairing PIN") },
                            placeholder = { Text("e.g. 482910") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(14.dp)
                        )

                        Spacer(modifier = Modifier.height(12.dp))

                        OutlinedTextField(
                            value = inputServer,
                            onValueChange = { inputServer = it },
                            label = { Text("CRM Server URL") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(14.dp)
                        )

                        if (errorMessage != null) {
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(errorMessage!!, color = Color.Red, fontSize = 12.sp)
                        }

                        Spacer(modifier = Modifier.height(20.dp))

                        Button(
                            onClick = {
                                if (inputCode.length != 6) {
                                    errorMessage = "Please enter a valid 6-digit PIN"
                                    return@Button
                                }
                                isLoading = true
                                errorMessage = null

                                FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
                                    val fcmToken = if (task.isSuccessful) task.result else null
                                    val androidId = Settings.Secure.getString(
                                        context.contentResolver,
                                        Settings.Secure.ANDROID_ID
                                    ) ?: "android-${System.currentTimeMillis()}"

                                    scope.launch(Dispatchers.IO) {
                                        try {
                                            val api = ApiClient.getService(inputServer)
                                            val sim1 = sims.firstOrNull()?.carrierName
                                            val sim2 = sims.getOrNull(1)?.carrierName

                                            val response = api.registerDevice(
                                                DeviceRegisterRequest(
                                                    pairingCode = inputCode,
                                                    deviceIdentifier = androidId,
                                                    deviceName = "${Build.MANUFACTURER.capitalize()} ${Build.MODEL}",
                                                    fcmToken = fcmToken,
                                                    androidVersion = "Android ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})",
                                                    appVersion = "1.0.0",
                                                    batteryLevel = 90,
                                                    networkType = "CELLULAR",
                                                    sim1Carrier = sim1,
                                                    sim1Number = null,
                                                    sim2Carrier = sim2,
                                                    sim2Number = null
                                                )
                                            )

                                            withContext(Dispatchers.Main) {
                                                isLoading = false
                                                if (response.isSuccessful && response.body()?.success == true) {
                                                    val data = response.body()?.data
                                                    deviceId = data?.deviceId ?: ""
                                                    deviceName = data?.deviceName ?: "Handset"
                                                    serverUrl = inputServer
                                                    isPaired = true

                                                    prefs.edit()
                                                        .putBoolean("is_paired", true)
                                                        .putString("device_id", deviceId)
                                                        .putString("device_name", deviceName)
                                                        .putString("server_url", serverUrl)
                                                        .apply()
                                                } else {
                                                    errorMessage = "Pairing failed. Please check the PIN."
                                                }
                                            }
                                        } catch (e: Exception) {
                                            withContext(Dispatchers.Main) {
                                                isLoading = false
                                                errorMessage = "Error: ${e.message}"
                                            }
                                        }
                                    }
                                }
                            },
                            enabled = !isLoading,
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(50.dp),
                            shape = RoundedCornerShape(14.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0052CC))
                        ) {
                            if (isLoading) {
                                CircularProgressIndicator(color = Color.White, modifier = Modifier.size(20.dp))
                            } else {
                                Text("Verify & Connect Device", fontWeight = FontWeight.Bold)
                            }
                        }
                    }
                }
            } else {
                // PAIRED ACTIVE DASHBOARD
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(24.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                ) {
                    Column(modifier = Modifier.padding(20.dp)) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(12.dp)
                                    .clip(CircleShape)
                                    .background(Color(0xFF10B981))
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                "DEVICE ONLINE & READY",
                                fontSize = 11.sp,
                                fontWeight = FontWeight.ExtraBold,
                                color = Color(0xFF059669),
                                letterSpacing = 1.sp
                            )
                        }

                        Spacer(modifier = Modifier.height(14.dp))

                        Text(
                            deviceName,
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF0F172A)
                        )
                        Text(
                            "Device ID: $deviceId",
                            fontSize = 11.sp,
                            color = Color(0xFF64748B),
                            fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace
                        )

                        Spacer(modifier = Modifier.height(18.dp))
                        HorizontalDivider(color = Color(0xFFF1F5F9))
                        Spacer(modifier = Modifier.height(18.dp))

                        Text(
                            "ACTIVE CELLULAR SIM CARDS",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF64748B)
                        )

                        Spacer(modifier = Modifier.height(10.dp))

                        if (sims.isEmpty()) {
                            Text(
                                "No active SIM detected or phone permission not granted.",
                                fontSize = 12.sp,
                                color = Color(0xFFEF4444)
                            )
                        } else {
                            sims.forEach { sim ->
                                Row(
                                    modifier = Modifier
                                        .fillMaxWidth()
                                        .padding(vertical = 4.dp)
                                        .clip(RoundedCornerShape(12.dp))
                                        .background(Color(0xFFF8FAFC))
                                        .padding(12.dp),
                                    verticalAlignment = Alignment.CenterVertically
                                ) {
                                    Icon(
                                        Icons.Default.SimCard,
                                        contentDescription = null,
                                        tint = Color(0xFF0052CC),
                                        modifier = Modifier.size(20.dp)
                                    )
                                    Spacer(modifier = Modifier.width(10.dp))
                                    Column {
                                        Text(
                                            "Slot ${sim.slotIndex + 1}: ${sim.carrierName}",
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 13.sp,
                                            color = Color(0xFF0F172A)
                                        )
                                        if (!sim.number.isNullOrBlank()) {
                                            Text(
                                                sim.number,
                                                fontSize = 11.sp,
                                                color = Color(0xFF64748B)
                                            )
                                        }
                                    }
                                }
                            }
                        }

                        Spacer(modifier = Modifier.height(24.dp))

                        Button(
                            onClick = {
                                scope.launch(Dispatchers.IO) {
                                    try {
                                        val api = ApiClient.getService(serverUrl)
                                        api.sendHeartbeat(
                                            deviceId = deviceId,
                                            request = HeartbeatRequest(
                                                fcmToken = null,
                                                batteryLevel = 88,
                                                networkType = "WIFI",
                                                sim1Carrier = sims.firstOrNull()?.carrierName,
                                                sim2Carrier = sims.getOrNull(1)?.carrierName
                                            )
                                        )
                                        withContext(Dispatchers.Main) {
                                            statusText = "Heartbeat synced just now"
                                        }
                                    } catch (e: Exception) {
                                        withContext(Dispatchers.Main) {
                                            statusText = "Sync failed: ${e.message}"
                                        }
                                    }
                                }
                            },
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFF1F5F9))
                        ) {
                            Icon(Icons.Default.Sync, contentDescription = null, tint = Color(0xFF0F172A))
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Send Manual Heartbeat", color = Color(0xFF0F172A), fontSize = 12.sp)
                        }

                        Spacer(modifier = Modifier.height(10.dp))

                        OutlinedButton(
                            onClick = {
                                prefs.edit().clear().apply()
                                isPaired = false
                            },
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(12.dp),
                            colors = ButtonDefaults.outlinedButtonColors(contentColor = Color(0xFFEF4444))
                        ) {
                            Icon(Icons.Default.LinkOff, contentDescription = null)
                            Spacer(modifier = Modifier.width(6.dp))
                            Text("Unpair Device from CRM", fontSize = 12.sp)
                        }
                    }
                }
            }
        }
    }
}
