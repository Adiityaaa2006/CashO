# CashO Android Companion 📲

The CashO Android Companion is a lightweight, local-first bridge app designed for personal use to automatically ingest bank and transactional SMS messages directly into your local CashO financial dashboard.

---

## 🔒 Security & Privacy Architecture

1. **Local Filtering First**:
   - The app runs a sender check (`HDFC`, `SBI`, `ICICI`, `AXIS`, `KOTAK`, `PAYTM`, `SWIGGY`, etc.) and a transactional keyword filter (`debited`, `credited`, `spent`, `paid`, `INR`, `Rs`).
   - Personal SMS, OTPs without transactions, and general communications are **never transmitted**.
2. **Explicit User Authorization**:
   - Uses Android runtime permission (`READ_SMS`) requested with a clear in-app rationale modal.
3. **Bearer Token Authentication**:
   - Every request to `/api/sync/android/ingest` requires the companion API Key (`ANDROID_API_KEY`) configured in your backend `.env`.
4. **Idempotent Ingestion**:
   - Each SMS is tagged with its local telephony ID (`sms_<id>`). Re-syncs or retries never result in duplicate database entries.

---

## 🚀 Building & Running

### Requirements
- Android Studio Hedgehog (2023.1.1) or newer
- JDK 17
- Android SDK 34 (Android 14)
- Physical device or Android Emulator with Google APIs

### Quick Setup

1. **Open in Android Studio**:
   - Open the `android/` directory in Android Studio.
   - Let Gradle sync dependencies (`androidx.compose`, `androidx.work:work-runtime-ktx`, `okhttp3`, `gson`).

2. **Run on Emulator / Phone**:
   - For Android Emulator: The default Server URL is `http://10.0.2.2:8000`.
   - For Physical Phone: Connect to the same Wi-Fi network and set Server URL to `http://<your-computer-lan-ip>:8000` (e.g. `http://192.168.1.15:8000`).

3. **Pair Companion**:
   - In CashO Web Dashboard, open the **Connections** tab.
   - Copy the Companion API Key (`casho_android_sync_key_98765` by default) into the Android app.
   - Tap **"Grant SMS Permission"** when prompted.
   - Tap **"Sync Bank SMS Now"** or enable **"Periodic Auto-Sync (1 hr)"**.
