package com.anyaai.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.util.Log
import androidx.core.app.NotificationCompat
import com.anyaai.MainActivity
import com.anyaai.R
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

/**
 * AnyaMicrophoneService — Android Foreground Service
 *
 * Responsibilities:
 *  1. Show persistent notification card (with Speak / Stop buttons)
 *  2. Capture voice via Android SpeechRecognizer
 *  3. Send transcript to Anya MCP Server via REST
 *  4. Broadcast results back to React Native layer
 *  5. Update notification text with live status
 *
 * Started by:
 *  - MainActivity on app launch
 *  - AnyaQSTileService when QS tile is toggled ON
 *  - AnyaServiceModule (JS bridge) via startService()
 */
class MicrophoneService : Service() {

    companion object {
        const val NOTIFICATION_ID = 1001
        const val CHANNEL_ID     = "anya_mic_channel"
        const val TAG            = "AnyaMicService"

        // Intent actions (used internally + from QS tile)
        const val ACTION_STOP_SERVICE    = "com.anyaai.STOP_SERVICE"
        const val ACTION_START_LISTENING = "com.anyaai.START_LISTENING"

        // Broadcast actions (received by AnyaServiceModule → React Native)
        const val ACTION_SPEECH_RESULT = "com.anyaai.SPEECH_RESULT"
        const val ACTION_ANYA_RESPONSE = "com.anyaai.ANYA_RESPONSE"
        const val EXTRA_TRANSCRIPT     = "transcript"
        const val EXTRA_RESPONSE       = "response"

        // Must match chatSocket.ts + api.ts USER_ID
        const val USER_ID  = "89968338-6678-48e0-be01-f8472e550e1d"
        // const val API_BASE = "http://127.0.0.1:3000"  // adb reverse tcp:3000 tcp:3000
        const val API_BASE = "https://anya-mcp-server.onrender.com"

        /** Tracks whether the service is currently alive (read by QSTileService) */
        @Volatile
        var isRunning = false
            private set
    }

    private var speechRecognizer: SpeechRecognizer? = null
    private val mainHandler = Handler(Looper.getMainLooper())
    var isListening  = false
    var isProcessing = false
    private var sessionId: String? = null

    // ─── Audio Mode Helpers ───────────────────────────────────────────────────

    /**
     * Switch audio stack to phone-call mode BEFORE listening.
     * Unlocks hardware AGC, noise suppression, echo cancellation, and
     * full mic gain — identical to what a real phone call uses.
     */
    private fun setVoiceCommunicationMode() {
        try {
            val am = getSystemService(AUDIO_SERVICE) as AudioManager
            am.mode = AudioManager.MODE_IN_COMMUNICATION
            am.isSpeakerphoneOn = false          // route to earpiece / earphone
            am.isMicrophoneMute = false           // unmute in case a prior app muted it

            // Maximize voice-call volume so TTS stays audible
            val maxVol = am.getStreamMaxVolume(AudioManager.STREAM_VOICE_CALL)
            am.setStreamVolume(AudioManager.STREAM_VOICE_CALL, maxVol, 0)

            // HAL-level hints (Qualcomm / MediaTek — silent on others)
            am.setParameters("noise_suppression=auto")
            am.setParameters("mic_gain=15")

            // Route to Bluetooth earbud mic if connected
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val btDev = am.availableCommunicationDevices
                    .firstOrNull { it.type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO }
                if (btDev != null) am.setCommunicationDevice(btDev)
            } else {
                @Suppress("DEPRECATION")
                if (am.isBluetoothScoAvailableOffCall) {
                    @Suppress("DEPRECATION") am.startBluetoothSco()
                    @Suppress("DEPRECATION") am.isBluetoothScoOn = true
                }
            }
        } catch (e: Exception) {
            Log.w(TAG, "setVoiceCommunicationMode failed (non-fatal): ${e.message}")
        }
    }

    private fun resetAudioMode() {
        try {
            val am = getSystemService(AUDIO_SERVICE) as AudioManager
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                am.clearCommunicationDevice()
            } else {
                @Suppress("DEPRECATION")
                if (am.isBluetoothScoOn) {
                    @Suppress("DEPRECATION") am.stopBluetoothSco()
                    @Suppress("DEPRECATION") am.isBluetoothScoOn = false
                }
            }
            am.mode = AudioManager.MODE_NORMAL
        } catch (e: Exception) {
            Log.w(TAG, "resetAudioMode failed (non-fatal): ${e.message}")
        }
    }

    // ─── Lifecycle ────────────────────────────────────────────────────────────

    override fun onCreate() {
        super.onCreate()
        isRunning = true
        Log.d(TAG, "Service created")
        startForeground(NOTIFICATION_ID, buildNotification("Anya is ready", "Tap mic to speak"))
        fetchOrCreateSession()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP_SERVICE -> {
                stopListening()
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    stopForeground(STOP_FOREGROUND_REMOVE)
                } else {
                    @Suppress("DEPRECATION")
                    stopForeground(true)
                }
                stopSelf()
            }
            ACTION_START_LISTENING -> {
                if (!isListening && !isProcessing) startListening()
            }
        }
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        super.onDestroy()
        isRunning = false
        stopListening()
        Log.d(TAG, "Service destroyed")
    }

    // ─── Session Management ───────────────────────────────────────────────────

    private fun fetchOrCreateSession() {
        Thread {
            try {
                val url  = URL("$API_BASE/api/chat/session")
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json")
                conn.setRequestProperty("x-user-id", USER_ID)
                conn.doOutput = true
                OutputStreamWriter(conn.outputStream).use {
                    it.write("""{"title":"Anya Background Session"}""")
                }
                val response = BufferedReader(InputStreamReader(conn.inputStream)).use { it.readText() }
                val json     = JSONObject(response)
                sessionId    = json.getJSONObject("data").getString("id")
                Log.d(TAG, "Session ready: $sessionId")
                conn.disconnect()
            } catch (e: Exception) {
                Log.e(TAG, "Session create failed: ${e.message}")
            }
        }.start()
    }

    // ─── Speech Recognition ───────────────────────────────────────────────────

    fun startListening() {
        if (!SpeechRecognizer.isRecognitionAvailable(this)) {
            updateNotification("Anya", "Speech recognition not available")
            return
        }
        isListening = true

        // ── Activate phone-call audio pipeline BEFORE starting the mic ──────
        // This enables hardware AGC, noise suppression, echo cancellation, and
        // correct Bluetooth earbud mic routing — same as a real phone call.
        setVoiceCommunicationMode()

        updateNotification("Anya is listening...", "Speak now — I'm all ears 👂")

        mainHandler.post {
            speechRecognizer?.destroy()
            speechRecognizer = SpeechRecognizer.createSpeechRecognizer(applicationContext)
            speechRecognizer?.setRecognitionListener(recognitionListener)

            val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                putExtra(RecognizerIntent.EXTRA_LANGUAGE, "en-IN")
                putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
                putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
            }
            speechRecognizer?.startListening(intent)
        }
    }

    fun stopListening() {
        isListening = false
        resetAudioMode()          // restore normal audio pipeline after each session
        mainHandler.post {
            speechRecognizer?.stopListening()
            speechRecognizer?.destroy()
            speechRecognizer = null
        }
    }

    private val recognitionListener = object : RecognitionListener {
        override fun onReadyForSpeech(params: Bundle?) {}
        override fun onBeginningOfSpeech() {}
        override fun onRmsChanged(rmsdB: Float)      {}
        override fun onBufferReceived(buffer: ByteArray?) {}
        override fun onEvent(eventType: Int, params: Bundle?) {}

        override fun onEndOfSpeech() {
            isListening = false
        }

        override fun onError(error: Int) {
            isListening = false
            val msg = when (error) {
                SpeechRecognizer.ERROR_NO_MATCH        -> "Didn't catch that, try again"
                SpeechRecognizer.ERROR_SPEECH_TIMEOUT  -> "No speech detected"
                SpeechRecognizer.ERROR_NETWORK         -> "Network error during recognition"
                SpeechRecognizer.ERROR_AUDIO           -> "Audio recording error"
                else                                   -> "Recognition error ($error)"
            }
            Log.e(TAG, "Recognition error: $msg")
            updateNotification("Anya is ready", msg)
        }

        override fun onResults(results: Bundle?) {
            isListening = false
            val transcript = results
                ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                ?.firstOrNull()?.trim() ?: return

            Log.d(TAG, "Recognized: $transcript")
            broadcastSpeechResult(transcript)
            sendToAnya(transcript)
        }

        override fun onPartialResults(partialResults: Bundle?) {
            val partial = partialResults
                ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                ?.firstOrNull() ?: return
            updateNotification("Anya is listening...", "\"$partial\"")
        }
    }

    // ─── API Call ─────────────────────────────────────────────────────────────

    private fun sendToAnya(text: String) {
        isProcessing = true
        updateNotification("Anya is thinking...", "\"$text\"")

        Thread {
            try {
                if (sessionId == null) {
                    fetchOrCreateSession()
                    Thread.sleep(1500)
                }
                val sid = sessionId ?: run {
                    updateNotification("Anya is ready", "Could not connect to server")
                    isProcessing = false
                    return@Thread
                }

                val url  = URL("$API_BASE/api/chat/message")
                val conn = url.openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json")
                conn.setRequestProperty("x-user-id", USER_ID)
                conn.connectTimeout = 15_000
                conn.readTimeout   = 30_000
                conn.doOutput = true

                OutputStreamWriter(conn.outputStream).use {
                    it.write(JSONObject().apply {
                        put("sessionId", sid)
                        put("content", text)
                    }.toString())
                }

                val code = conn.responseCode
                val responseText = BufferedReader(
                    InputStreamReader(if (code in 200..299) conn.inputStream else conn.errorStream ?: conn.inputStream)
                ).use { it.readText() }
                conn.disconnect()

                val json  = JSONObject(responseText)
                val reply = json.optString("response")
                    .ifBlank { json.optJSONObject("data")?.optString("content") ?: "" }
                    .ifBlank { json.optString("message") }
                    .ifBlank { "I heard you, but couldn't get a response." }

                Log.d(TAG, "Anya replied: $reply")
                isProcessing = false
                broadcastAnyaResponse(reply)
                updateNotification("Anya says:", truncate(reply, 80))

                // Parse and execute device control commands
                val dataObj = json.optJSONObject("data")
                val cmdObj = dataObj?.optJSONObject("deviceCommand")
                if (cmdObj != null) {
                    val command = cmdObj.optString("command")
                    val query = cmdObj.optString("query").ifBlank { null }
                    val packageName = cmdObj.optString("packageName").ifBlank { null }
                    val url = cmdObj.optString("url").ifBlank { null }
                    if (!command.isNullOrBlank()) {
                        mainHandler.post {
                            DeviceControlHelper.executeCommand(applicationContext, command, query, packageName, url)
                        }
                    }
                }

            } catch (e: Exception) {
                isProcessing = false
                Log.e(TAG, "API call failed: ${e.message}")
                updateNotification("Anya is ready", "Couldn't reach server. Try again.")
            }
        }.start()
    }

    // ─── Notification ─────────────────────────────────────────────────────────

    fun buildNotification(title: String, content: String): Notification {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Anya Background Assistant",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Keeps Anya active for voice commands"
                setShowBadge(false)
                enableLights(false)
                enableVibration(false)
            }
            getSystemService(NotificationManager::class.java)?.createNotificationChannel(channel)
        }

        // Tap → open app
        val openPendingIntent = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // 🎤 Speak action
        val micPendingIntent = PendingIntent.getService(
            this, 1,
            Intent(this, MicrophoneService::class.java).apply { action = ACTION_START_LISTENING },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // ⏻ Stop action
        val stopPendingIntent = PendingIntent.getService(
            this, 2,
            Intent(this, MicrophoneService::class.java).apply { action = ACTION_STOP_SERVICE },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_anya_notif)
            .setContentTitle(title)
            .setContentText(content)
            .setContentIntent(openPendingIntent)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .addAction(R.drawable.ic_mic_action,  "Speak", micPendingIntent)
            .addAction(R.drawable.ic_stop_action, "Stop",  stopPendingIntent)
            .setStyle(NotificationCompat.BigTextStyle().bigText(content))
            .build()
    }

    fun updateNotification(title: String, content: String) {
        getSystemService(NotificationManager::class.java)
            ?.notify(NOTIFICATION_ID, buildNotification(title, content))
    }

    // ─── Broadcasts ───────────────────────────────────────────────────────────

    private fun broadcastSpeechResult(transcript: String) {
        sendBroadcast(Intent(ACTION_SPEECH_RESULT).apply {
            putExtra(EXTRA_TRANSCRIPT, transcript)
        })
    }

    private fun broadcastAnyaResponse(response: String) {
        sendBroadcast(Intent(ACTION_ANYA_RESPONSE).apply {
            putExtra(EXTRA_RESPONSE, response)
        })
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private fun truncate(text: String, max: Int): String =
        if (text.length <= max) text else text.take(max - 3) + "..."
}
