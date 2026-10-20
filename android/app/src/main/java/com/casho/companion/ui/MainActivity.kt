package com.casho.companion.ui

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import androidx.work.*
import com.casho.companion.service.SyncRepository
import com.casho.companion.service.SyncWorker
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.concurrent.TimeUnit

class MainActivity : ComponentActivity() {

    private lateinit var repository: SyncRepository

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        repository = SyncRepository(this)

        setContent {
            CashOCompanionTheme {
                CompanionScreen(repository = repository, onSyncNow = { triggerOneTimeSync() })
            }
        }
    }

    private fun triggerOneTimeSync() {
        val syncRequest = OneTimeWorkRequestBuilder<SyncWorker>().build()
        WorkManager.getInstance(this).enqueue(syncRequest)
        Toast.makeText(this, "Sync initiated in background", Toast.LENGTH_SHORT).show()
    }
}

@Composable
fun CompanionScreen(
    repository: SyncRepository,
    onSyncNow: () -> Unit
) {
    val context = LocalContext.current
    var serverUrl by remember { mutableStateOf(repository.serverUrl) }
    var apiKey by remember { mutableStateOf(repository.apiKey) }
    var autoSync by remember { mutableStateOf(repository.isAutoSyncEnabled) }
    var syncStatus by remember { mutableStateOf(repository.lastSyncStatus) }
    var hasSmsPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED
        )
    }

    val permissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        hasSmsPermission = isGranted
        if (isGranted) {
            Toast.makeText(context, "SMS access granted for bank transactions", Toast.LENGTH_SHORT).show()
        } else {
            Toast.makeText(context, "Permission denied. SMS sync requires READ_SMS.", Toast.LENGTH_LONG).show()
        }
    }

    val scrollState = rememberScrollState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF0F172A))
            .padding(16.dp)
            .verticalScroll(scrollState),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // App Header
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text(
                    text = "CashO Companion 📲",
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFF38BDF8)
                )
                Text(
                    text = "Automated Bank SMS Ingestion",
                    fontSize = 13.sp,
                    color = Color(0xFF94A3B8)
                )
            }
            Badge(
                containerColor = if (hasSmsPermission && apiKey.isNotBlank()) Color(0xFF10B981) else Color(0xFFEF4444),
                contentColor = Color.White
            ) {
                Text(
                    text = if (hasSmsPermission && apiKey.isNotBlank()) "Ready" else "Setup Needed",
                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold
                )
            }
        }

        // SMS Permission Card
        Card(
            colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(
                    text = "1. Explicit SMS Permission",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = Color.White
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "CashO filters solely financial/bank alert SMS (HDFC, SBI, ICICI, etc.) locally on device. Personal texts and non-financial messages are never read or uploaded.",
                    fontSize = 13.sp,
                    color = Color(0xFF94A3B8)
                )
                Spacer(modifier = Modifier.height(12.dp))
                if (!hasSmsPermission) {
                    Button(
                        onClick = { permissionLauncher.launch(Manifest.permission.READ_SMS) },
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0284C7))
                    ) {
                        Text("Grant SMS Permission")
                    }
                } else {
                    Text(
                        text = "✓ Permission Granted",
                        color = Color(0xFF34D399),
                        fontWeight = FontWeight.Bold,
                        fontSize = 14.sp
                    )
                }
            }
        }

        // Configuration Card
        Card(
            colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(
                    text = "2. Connection Settings",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = Color.White
                )
                Spacer(modifier = Modifier.height(12.dp))

                OutlinedTextField(
                    value = serverUrl,
                    onValueChange = {
                        serverUrl = it
                        repository.serverUrl = it
                    },
                    label = { Text("Server URL", color = Color(0xFF94A3B8)) },
                    placeholder = { Text("http://10.0.2.2:8000") },
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White,
                        focusedBorderColor = Color(0xFF38BDF8),
                        unfocusedBorderColor = Color(0xFF475569)
                    ),
                    modifier = Modifier.fillMaxWidth()
                )

                Spacer(modifier = Modifier.height(12.dp))

                OutlinedTextField(
                    value = apiKey,
                    onValueChange = {
                        apiKey = it
                        repository.apiKey = it
                    },
                    label = { Text("Companion API Key", color = Color(0xFF94A3B8)) },
                    placeholder = { Text("casho_android_sync_key_98765") },
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White,
                        focusedBorderColor = Color(0xFF38BDF8),
                        unfocusedBorderColor = Color(0xFF475569)
                    ),
                    modifier = Modifier.fillMaxWidth()
                )
            }
        }

        // Sync & Actions Card
        Card(
            colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(
                    text = "3. Sync Operations",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = Color.White
                )
                Spacer(modifier = Modifier.height(8.dp))

                Text(
                    text = "Status: $syncStatus",
                    color = Color(0xFFE2E8F0),
                    fontSize = 13.sp
                )

                Spacer(modifier = Modifier.height(12.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Periodic Auto-Sync (1 hr)",
                        color = Color.White,
                        fontSize = 14.sp
                    )
                    Switch(
                        checked = autoSync,
                        onCheckedChange = { isChecked ->
                            autoSync = isChecked
                            repository.isAutoSyncEnabled = isChecked
                            val workManager = WorkManager.getInstance(context)
                            if (isChecked) {
                                val periodicRequest = PeriodicWorkRequestBuilder<SyncWorker>(1, TimeUnit.HOURS)
                                    .setConstraints(
                                        Constraints.Builder()
                                            .setRequiredNetworkType(NetworkType.CONNECTED)
                                            .build()
                                    )
                                    .build()
                                workManager.enqueueUniquePeriodicWork(
                                    "CashO_Companion_Sync",
                                    ExistingPeriodicWorkPolicy.UPDATE,
                                    periodicRequest
                                )
                                Toast.makeText(context, "Background sync enabled", Toast.LENGTH_SHORT).show()
                            } else {
                                workManager.cancelUniqueWork("CashO_Companion_Sync")
                                Toast.makeText(context, "Background sync disabled", Toast.LENGTH_SHORT).show()
                            }
                        }
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                Button(
                    onClick = {
                        if (!hasSmsPermission) {
                            permissionLauncher.launch(Manifest.permission.READ_SMS)
                            return@Button
                        }
                        if (apiKey.isBlank()) {
                            Toast.makeText(context, "Please enter Companion API Key", Toast.LENGTH_SHORT).show()
                            return@Button
                        }
                        onSyncNow()
                        syncStatus = "Sync requested..."
                    },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0284C7)),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    Text("Sync Bank SMS Now", fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}

@Composable
fun CashOCompanionTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = darkColorScheme(
            primary = Color(0xFF38BDF8),
            background = Color(0xFF0F172A),
            surface = Color(0xFF1E293B)
        ),
        content = content
    )
}
