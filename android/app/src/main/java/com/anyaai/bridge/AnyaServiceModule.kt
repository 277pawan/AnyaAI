package com.anyaai.bridge

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.media.AudioManager
import android.os.Build
import android.app.NotificationManager
import android.app.PendingIntent
import androidx.core.app.NotificationCompat
import com.anyaai.service.DeviceControlHelper
import com.anyaai.service.MicrophoneService
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import kotlin.math.absoluteValue

/**
 * AnyaServiceModule — React Native Native Module Bridge
 *
 * Exposes MicrophoneService control to JavaScript.
 *
 * JS Usage (from any screen):
 *   import { NativeModules } from 'react-native';
 *   const { AnyaService } = NativeModules;
 *
 *   AnyaService.startService();     // Start background mic service
 *   AnyaService.stopService();      // Stop it
 *   AnyaService.startListening();   // Trigger a voice capture session
 *
 * Events emitted to JS via DeviceEventEmitter:
 *   'onAnyaSpeechResult'  → string transcript of what was spoken
 *   'onAnyaResponse'      → string of Anya's API reply
 */
class AnyaServiceModule(private val reactContext: ReactApplicationContext)
    : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "AnyaService"

    private var listenerCount = 0

    // ─── Broadcast Receivers ──────────────────────────────────────────────────

    private val speechReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            val transcript = intent?.getStringExtra(MicrophoneService.EXTRA_TRANSCRIPT) ?: return
            emitEvent("onAnyaSpeechResult", transcript)
        }
    }

    private val responseReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            val response = intent?.getStringExtra(MicrophoneService.EXTRA_RESPONSE) ?: return
            emitEvent("onAnyaResponse", response)
        }
    }

    // ─── Listener Lifecycle (required for NativeEventEmitter) ─────────────────

    @ReactMethod
    fun addListener(eventName: String) {
        if (listenerCount == 0) registerReceivers()
        listenerCount++
    }

    @ReactMethod
    fun removeListeners(count: Int) {
        listenerCount = maxOf(0, listenerCount - count)
        if (listenerCount == 0) unregisterReceivers()
    }

    private fun registerReceivers() {
        try {
            val speechFilter   = IntentFilter(MicrophoneService.ACTION_SPEECH_RESULT)
            val responseFilter = IntentFilter(MicrophoneService.ACTION_ANYA_RESPONSE)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                reactContext.registerReceiver(speechReceiver,   speechFilter,   Context.RECEIVER_NOT_EXPORTED)
                reactContext.registerReceiver(responseReceiver, responseFilter, Context.RECEIVER_NOT_EXPORTED)
            } else {
                reactContext.registerReceiver(speechReceiver,   speechFilter)
                reactContext.registerReceiver(responseReceiver, responseFilter)
            }
        } catch (_: Exception) { /* already registered */ }
    }

    private fun unregisterReceivers() {
        try { reactContext.unregisterReceiver(speechReceiver)   } catch (_: Exception) {}
        try { reactContext.unregisterReceiver(responseReceiver) } catch (_: Exception) {}
    }

    // ─── Service Control Methods (callable from JS) ───────────────────────────

    @ReactMethod
    fun startService() {
        val intent = Intent(reactContext, MicrophoneService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            reactContext.startForegroundService(intent)
        } else {
            reactContext.startService(intent)
        }
    }

    @ReactMethod
    fun stopService() {
        reactContext.startService(
            Intent(reactContext, MicrophoneService::class.java).apply {
                action = MicrophoneService.ACTION_STOP_SERVICE
            }
        )
    }

    @ReactMethod
    fun startListening() {
        val intent = Intent(reactContext, MicrophoneService::class.java).apply {
            action = MicrophoneService.ACTION_START_LISTENING
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            reactContext.startForegroundService(intent)
        } else {
            reactContext.startService(intent)
        }
    }

    // ─── Audio Mode Management ────────────────────────────────────────────────
    // Switches the Android audio stack to phone-call mode BEFORE starting
    // speech recognition — identical to what a real phone call uses.
    // This unlocks: full mic gain, noise suppression, echo cancellation, and
    // automatic Bluetooth earbud mic routing.

    @ReactMethod
    fun setVoiceCommunicationMode() {
        try {
            val audioManager = reactContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager

            // 1. Switch to phone-call audio pipeline (enables noise suppression,
            //    echo cancellation, and full hardware mic gain)
            audioManager.mode = AudioManager.MODE_IN_COMMUNICATION
            audioManager.isSpeakerphoneOn = false

            // 2. Unmute mic explicitly — some phones/ROMs mute it between calls
            audioManager.isMicrophoneMute = false

            // 3. Maximize the voice-call stream volume so the mic hardware
            //    operates at its highest sensitivity setting
            val maxVol = audioManager.getStreamMaxVolume(AudioManager.STREAM_VOICE_CALL)
            audioManager.setStreamVolume(
                AudioManager.STREAM_VOICE_CALL,
                maxVol,
                0 // no UI indicator
            )

            // 4. Also boost the music/media volume so TTS playback stays loud
            val maxMedia = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
            audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, maxMedia, 0)

            // 5. HAL-level hint: tell the audio hardware to apply max mic gain
            //    (supported on Qualcomm/MediaTek HALs — silently ignored on others)
            audioManager.setParameters("noise_suppression=auto")
            audioManager.setParameters("mic_gain=15")

            // 6. Activate Bluetooth earbud mic via SCO channel if connected
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val btDevice = audioManager.availableCommunicationDevices
                    .firstOrNull { it.type == android.media.AudioDeviceInfo.TYPE_BLUETOOTH_SCO }
                if (btDevice != null) {
                    audioManager.setCommunicationDevice(btDevice)
                }
            } else {
                @Suppress("DEPRECATION")
                if (audioManager.isBluetoothScoAvailableOffCall) {
                    @Suppress("DEPRECATION")
                    audioManager.startBluetoothSco()
                    @Suppress("DEPRECATION")
                    audioManager.isBluetoothScoOn = true
                }
            }
        } catch (e: Exception) { /* Non-fatal — speech works from phone mic */ }
    }

    @ReactMethod
    fun resetAudioMode() {
        try {
            val audioManager = reactContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                audioManager.clearCommunicationDevice()
            } else {
                @Suppress("DEPRECATION")
                if (audioManager.isBluetoothScoOn) {
                    @Suppress("DEPRECATION")
                    audioManager.stopBluetoothSco()
                    @Suppress("DEPRECATION")
                    audioManager.isBluetoothScoOn = false
                }
            }
            audioManager.mode = AudioManager.MODE_NORMAL
        } catch (e: Exception) { /* Non-fatal */ }
    }

    @ReactMethod
    fun makeDirectCall(phoneNumber: String) {
        try {
            val intent = Intent(Intent.ACTION_CALL).apply {
                data = android.net.Uri.parse("tel:$phoneNumber")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            reactContext.startActivity(intent)
        } catch (e: Exception) {
            // Fallback to normal dial if permission is missing or it fails
            val dialIntent = Intent(Intent.ACTION_DIAL).apply {
                data = android.net.Uri.parse("tel:$phoneNumber")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            reactContext.startActivity(dialIntent)
        }
    }

    @ReactMethod
    fun executeDeviceCommand(command: String, query: String?, packageName: String?, url: String?) {
        try {
            DeviceControlHelper.executeCommand(reactContext, command, query, packageName, url)
        } catch (e: Exception) {
            android.util.Log.e("AnyaService", "Failed to execute device command: ${e.message}")
        }
    }

    @ReactMethod
    fun showNotification(title: String, body: String, url: String?, imageUrl: String?) {
        try {
            com.anyaai.service.AnyaNotificationHelper.show(
                context = reactContext,
                title = title,
                body = body,
                imageUrl = imageUrl,
                linkUrl = url,
            )
        } catch (e: Exception) {
            android.util.Log.e("AnyaService", "Failed to show notification: ${e.message}")
        }
    }

    // ─── Event Emitter ────────────────────────────────────────────────────────


    private fun emitEvent(eventName: String, data: String) {
        try {
            if (reactContext.hasActiveCatalystInstance()) {
                reactContext
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    ?.emit(eventName, data)
            } else {
                android.util.Log.w("AnyaService", "Cannot emit event '$eventName': Catalyst instance not active")
            }
        } catch (e: Exception) {
            android.util.Log.e("AnyaService", "Failed to emit event '$eventName': ${e.message}")
        }
    }
}
