package com.casho.companion.ui

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.work.*
import com.casho.companion.service.ManualImportHelper
import com.casho.companion.service.ManualImportResult
import com.casho.companion.service.SyncRepository
import com.casho.companion.service.SyncWorker
import kotlinx.coroutines.launch
import java.util.concurrent.TimeUnit

class MainActivity : ComponentActivity() {

    private lateinit var repository: SyncRepository
    private val sharedTextState = mutableStateOf<String?>(null)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        repository = SyncRepository(this)
        handleSendIntent(intent)

        setContent {
            CashOCompanionTheme {
                CompanionScreen(
                    repository = repository,
                    initialImportText = sharedTextState.value,
                    onClearInitialImportText = { sharedTextState.value = null },
                    onSyncNow = { triggerOneTimeSync() }
                )
            }
        }
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleSendIntent(intent)
    }

    private fun handleSendIntent(intent: Intent?) {
        if (intent?.action == Intent.ACTION_SEND && intent.type?.startsWith("text/") == true) {
            val shared = intent.getStringExtra(Intent.EXTRA_TEXT)
            if (!shared.isNullOrBlank()) {
                sharedTextState.value = shared
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
    initialImportText: String? = null,
    onClearInitialImportText: () -> Unit = {},
    onSyncNow: () -> Unit
) {
    val context = LocalContext.current
    val clipboardManager = LocalClipboardManager.current
    val coroutineScope = rememberCoroutineScope()

    var serverUrl by remember { mutableStateOf(repository.serverUrl) }
    var apiKey by remember { mutableStateOf(repository.apiKey) }
    var autoSync by remember { mutableStateOf(repository.isAutoSyncEnabled) }
    var syncStatus by remember { mutableStateOf(repository.lastSyncStatus) }

    // Manual Import State
    var manualInputText by remember { mutableStateOf("") }
    var isSubmittingManual by remember { mutableStateOf(false) }
    var manualImportResult by remember { mutableStateOf<ManualImportResult?>(null) }

    // Prefill shared text when launched via ACTION_SEND
    LaunchedEffect(initialImportText) {
        if (!initialImportText.isNullOrBlank()) {
            manualInputText = initialImportText
            manualImportResult = null
            onClearInitialImportText()
            Toast.makeText(context, "Shared transaction message loaded", Toast.LENGTH_SHORT).show()
        }
    }

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
                    text = "Bank SMS Ingestion & Manual Import",
                    fontSize = 13.sp,
                    color = Color(0xFF94A3B8)
                )
            }
            Badge(
                containerColor = if (apiKey.isNotBlank()) Color(0xFF10B981) else Color(0xFFEF4444),
                contentColor = Color.White
            ) {
                Text(
                    text = if (apiKey.isNotBlank()) "Configured" else "Key Missing",
                    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold
                )
            }
        }

        // Section 1: Manual UPI / SMS Import Card (No READ_SMS permission needed)
        Card(
            colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "1. Manual UPI / SMS Import",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = Color.White
                    )
                    Badge(
                        containerColor = Color(0xFF0EA5E9),
                        contentColor = Color.White
                    ) {
                        Text(
                            text = "No Permission Required",
                            modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                            fontSize = 11.sp
                        )
                    }
                }

                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Paste a transaction SMS or share it directly from your SMS/UPI app into CashO. Preview extracted details before importing.",
                    fontSize = 13.sp,
                    color = Color(0xFF94A3B8)
                )

                Spacer(modifier = Modifier.height(12.dp))

                // Multiline Input Field
                OutlinedTextField(
                    value = manualInputText,
                    onValueChange = {
                        manualInputText = it
                        // Clear previous submission result when input changes
                        if (manualImportResult != null) {
                            manualImportResult = null
                        }
                    },
                    label = { Text("Transaction Message (SMS / UPI Text)", color = Color(0xFF94A3B8)) },
                    placeholder = {
                        Text(
                            "e.g. Paid Rs 350 at Swiggy on 10-Oct-2026 via UPI Ref: 1234567890",
                            color = Color(0xFF64748B),
                            fontSize = 13.sp
                        )
                    },
                    minLines = 3,
                    maxLines = 6,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = Color.White,
                        unfocusedTextColor = Color.White,
                        focusedBorderColor = Color(0xFF38BDF8),
                        unfocusedBorderColor = Color(0xFF475569)
                    ),
                    modifier = Modifier.fillMaxWidth()
                )

                // Character counter & length limit warning
                val textLength = manualInputText.length
                val isOverLimit = textLength > ManualImportHelper.MAX_MESSAGE_LENGTH
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 4.dp),
                    horizontalArrangement = Arrangement.End
                ) {
                    Text(
                        text = "$textLength / ${ManualImportHelper.MAX_MESSAGE_LENGTH}",
                        fontSize = 11.sp,
                        color = if (isOverLimit) Color(0xFFEF4444) else Color(0xFF64748B)
                    )
                }

                Spacer(modifier = Modifier.height(8.dp))

                // Actions: Paste, Clear
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedButton(
                        onClick = {
                            val clip = clipboardManager.getText()
                            if (clip != null && clip.text.isNotBlank()) {
                                manualInputText = clip.text
                                manualImportResult = null
                                Toast.makeText(context, "Pasted from clipboard", Toast.LENGTH_SHORT).show()
                            } else {
                                Toast.makeText(context, "Clipboard is empty", Toast.LENGTH_SHORT).show()
                            }
                        },
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text("📋 Paste", fontSize = 13.sp)
                    }

                    OutlinedButton(
                        onClick = {
                            manualInputText = ""
                            manualImportResult = null
                        },
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text("🧹 Clear", fontSize = 13.sp)
                    }
                }

                // Safe Preview Box (if text is present)
                if (manualInputText.isNotBlank()) {
                    Spacer(modifier = Modifier.height(12.dp))
                    val preview = remember(manualInputText) {
                        ManualImportHelper.parsePreview(manualInputText)
                    }

                    Card(
                        colors = CardDefaults.cardColors(containerColor = Color(0xFF0F172A)),
                        shape = RoundedCornerShape(8.dp),
                        modifier = Modifier
                            .fillMaxWidth()
                            .border(1.dp, Color(0xFF334155), RoundedCornerShape(8.dp))
                    ) {
                        Column(modifier = Modifier.padding(12.dp)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically
                            ) {
                                Text(
                                    text = "Preview (Local Extraction)",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = Color(0xFF38BDF8)
                                )
                                if (preview.isAmbiguous) {
                                    Badge(containerColor = Color(0xFFF59E0B), contentColor = Color.Black) {
                                        Text("Review Required", fontSize = 10.sp, fontWeight = FontWeight.Bold)
                                    }
                                } else {
                                    Badge(containerColor = Color(0xFF10B981), contentColor = Color.White) {
                                        Text("Complete", fontSize = 10.sp, fontWeight = FontWeight.Bold)
                                    }
                                }
                            }

                            Spacer(modifier = Modifier.height(8.dp))

                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("Amount:", fontSize = 12.sp, color = Color(0xFF94A3B8))
                                Text(
                                    text = preview.amount?.let { "₹%.2f".format(it) } ?: "Ambiguous / Not Found",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = if (preview.amount != null) Color(0xFF34D399) else Color(0xFFF87171)
                                )
                            }

                            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                Text("Direction:", fontSize = 12.sp, color = Color(0xFF94A3B8))
                                Text(
                                    text = preview.transactionType ?: "UNKNOWN (Ambiguous)",
                                    fontSize = 12.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    color = when (preview.transactionType) {
                                        "DEBIT" -> Color(0xFFFB923C)
                                        "CREDIT", "REFUND" -> Color(0xFF34D399)
                                        "FAILED" -> Color(0xFFEF4444)
                                        else -> Color(0xFFF87171)
                                    }
                                )
                            }

                            if (preview.merchantCandidate != null) {
                                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                    Text("Merchant:", fontSize = 12.sp, color = Color(0xFF94A3B8))
                                    Text(preview.merchantCandidate, fontSize = 12.sp, color = Color.White)
                                }
                            }

                            if (preview.dateCandidate != null) {
                                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                                    Text("Date:", fontSize = 12.sp, color = Color(0xFF94A3B8))
                                    Text(preview.dateCandidate, fontSize = 12.sp, color = Color.White)
                                }
                            }

                            Spacer(modifier = Modifier.height(6.dp))
                            Text(
                                text = "Notice: Preliminary preview. Final classification, normalization, and AI rule reasoning are evaluated on the CashO backend server.",
                                fontSize = 10.sp,
                                color = Color(0xFF64748B)
                            )
                        }
                    }
                }

                Spacer(modifier = Modifier.height(14.dp))

                // Submit / Import Button
                Button(
                    onClick = {
                        if (manualInputText.isBlank()) {
                            Toast.makeText(context, "Please paste or enter transaction text.", Toast.LENGTH_SHORT).show()
                            return@Button
                        }
                        if (isOverLimit) {
                            Toast.makeText(context, "Message exceeds character limit.", Toast.LENGTH_SHORT).show()
                            return@Button
                        }
                        if (apiKey.isBlank()) {
                            Toast.makeText(context, "Please set Companion API Key in Connection Settings below.", Toast.LENGTH_LONG).show()
                            return@Button
                        }

                        isSubmittingManual = true
                        manualImportResult = null

                        coroutineScope.launch {
                            val result = ManualImportHelper.submitManualImport(
                                serverUrl = serverUrl,
                                apiKey = apiKey,
                                rawText = manualInputText
                            )
                            manualImportResult = result
                            isSubmittingManual = false
                        }
                    },
                    enabled = !isSubmittingManual && manualInputText.isNotBlank() && !isOverLimit,
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF0284C7)),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    if (isSubmittingManual) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(18.dp),
                            color = Color.White,
                            strokeWidth = 2.dp
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text("Importing to CashO...", fontWeight = FontWeight.Bold)
                    } else {
                        Text("Import Transaction", fontWeight = FontWeight.Bold)
                    }
                }

                // Result Feedback Display
                manualImportResult?.let { res ->
                    Spacer(modifier = Modifier.height(12.dp))
                    when (res) {
                        is ManualImportResult.Success -> {
                            val (cardBg, borderColor, titleColor, titleText) = when (res.status) {
                                "inserted" -> Quadruple(
                                    Color(0xFF064E3B),
                                    Color(0xFF10B981),
                                    Color(0xFF34D399),
                                    "✓ Transaction Confirmed & Recorded"
                                )
                                "duplicate" -> Quadruple(
                                    Color(0xFF451A03),
                                    Color(0xFFF59E0B),
                                    Color(0xFFFBBF24),
                                    "ℹ Already Recorded (Duplicate)"
                                )
                                "review_queue" -> Quadruple(
                                    Color(0xFF1E3A5F),
                                    Color(0xFF38BDF8),
                                    Color(0xFF7DD3FC),
                                    "⚠ Sent to CashO Review Queue"
                                )
                                else -> Quadruple(
                                    Color(0xFF334155),
                                    Color(0xFF64748B),
                                    Color(0xFFCBD5E1),
                                    "Processed (Status: ${res.status})"
                                )
                            }

                            Card(
                                colors = CardDefaults.cardColors(containerColor = cardBg),
                                shape = RoundedCornerShape(8.dp),
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .border(1.dp, borderColor, RoundedCornerShape(8.dp))
                            ) {
                                Column(modifier = Modifier.padding(12.dp)) {
                                    Text(
                                        text = titleText,
                                        fontWeight = FontWeight.Bold,
                                        fontSize = 13.sp,
                                        color = titleColor
                                    )
                                    Spacer(modifier = Modifier.height(4.dp))
                                    Text(
                                        text = res.summaryText,
                                        fontSize = 12.sp,
                                        color = Color.White
                                    )
                                }
                            }
                        }
                        is ManualImportResult.AuthError -> {
                            ErrorFeedbackCard(
                                title = "Authentication Error (401/403)",
                                message = res.message
                            )
                        }
                        is ManualImportResult.ValidationError -> {
                            ErrorFeedbackCard(
                                title = "Validation Error",
                                message = res.message
                            )
                        }
                        is ManualImportResult.NetworkError -> {
                            ErrorFeedbackCard(
                                title = "Network / Connection Error",
                                message = res.message
                            )
                        }
                    }
                }
            }
        }

        // Section 2: Automated SMS Ingestion Card (Requires READ_SMS)
        Card(
            colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(
                    text = "2. Automated Inbox SMS Ingestion",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = Color.White
                )
                Spacer(modifier = Modifier.height(4.dp))
                Text(
                    text = "Automatically scan device inbox for bank transaction SMS (HDFC, SBI, ICICI, etc.). Personal texts are never read or uploaded.",
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

                Spacer(modifier = Modifier.height(16.dp))

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

                Spacer(modifier = Modifier.height(12.dp))

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

                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = "Status: $syncStatus",
                    color = Color(0xFF94A3B8),
                    fontSize = 12.sp
                )
            }
        }

        // Section 3: Connection Settings Card
        Card(
            colors = CardDefaults.cardColors(containerColor = Color(0xFF1E293B)),
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(
                    text = "3. Connection Settings",
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
    }
}

@Composable
private fun ErrorFeedbackCard(title: String, message: String) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color(0xFF450A0A)),
        shape = RoundedCornerShape(8.dp),
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, Color(0xFFEF4444), RoundedCornerShape(8.dp))
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text(
                text = title,
                fontWeight = FontWeight.Bold,
                fontSize = 13.sp,
                color = Color(0xFFFCA5A5)
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = message,
                fontSize = 12.sp,
                color = Color.White
            )
        }
    }
}

private data class Quadruple<A, B, C, D>(val first: A, val second: B, val third: C, val fourth: D)

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
