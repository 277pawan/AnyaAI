package com.anyaai.tile

import android.content.Intent
import android.os.Build
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService
import android.util.Log
import androidx.annotation.RequiresApi
import com.anyaai.service.MicrophoneService

/**
 * AnyaQSTileService — Quick Settings Tile
 *
 * Adds an "Anya AI" toggle tile to the Android Quick Settings panel
 * (the area with Bluetooth, WiFi, Flashlight, etc.)
 *
 * How to add the tile (one-time setup by user):
 *   1. Pull down notification twice to open Quick Settings
 *   2. Tap the pencil/edit icon (bottom-left)
 *   3. Find "Anya AI" in the inactive tiles list
 *   4. Drag it up into the active tiles area
 *   5. Tap Done
 *
 * Behavior:
 *   - Tile OFF  → MicrophoneService not running
 *   - Tile ON   → MicrophoneService starts as foreground service
 *                  (persistent notification + voice capture active)
 *   - Tile tap when ON → triggers a new listening session immediately
 *
 * Requires Android 7.0 (API 24)+
 */
@RequiresApi(Build.VERSION_CODES.N)
class AnyaQSTileService : TileService() {

    companion object {
        const val TAG = "AnyaQSTile"
    }

    // ─── TileService Lifecycle ─────────────────────────────────────────────────

    /**
     * Called when the tile is added to the Quick Settings panel for the first time.
     * Good place to set initial state.
     */
    override fun onTileAdded() {
        super.onTileAdded()
        Log.d(TAG, "Tile added to Quick Settings")
        refreshTile(isActive = false)
    }

    /**
     * Called when Quick Settings panel is opened and the tile becomes visible.
     * Sync tile state with actual service state here.
     */
    override fun onStartListening() {
        super.onStartListening()
        // Reflect real service state when panel opens
        val serviceRunning = MicrophoneService.isRunning
        Log.d(TAG, "Tile visible, service running: $serviceRunning")
        refreshTile(isActive = serviceRunning)
    }

    /**
     * Called when Quick Settings panel is closed.
     */
    override fun onStopListening() {
        super.onStopListening()
        Log.d(TAG, "Tile hidden")
    }

    /**
     * Called when user taps the tile.
     *
     * Toggle logic:
     *   - If service OFF  → start it (tile goes ACTIVE)
     *   - If service ON   → trigger a new listening session instantly
     *   - Long press to stop handled via notification "Stop" button
     */
    override fun onClick() {
        super.onClick()
        Log.d(TAG, "Tile tapped")

        if (!MicrophoneService.isRunning) {
            // Start the foreground service
            startMicrophoneService()
            refreshTile(isActive = true)
        } else {
            // Service already running → trigger a new listen immediately
            triggerListening()
            // Show listening state briefly in tile subtitle
            refreshTile(isActive = true, subtitle = "Listening...")
        }
    }

    /**
     * Called when tile is removed from Quick Settings by the user.
     */
    override fun onTileRemoved() {
        super.onTileRemoved()
        Log.d(TAG, "Tile removed, stopping service")
        stopMicrophoneService()
    }

    // ─── Service Control ──────────────────────────────────────────────────────

    private fun startMicrophoneService() {
        val intent = Intent(this, MicrophoneService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
        Log.d(TAG, "MicrophoneService started from QS tile")
    }

    private fun stopMicrophoneService() {
        val intent = Intent(this, MicrophoneService::class.java).apply {
            action = MicrophoneService.ACTION_STOP_SERVICE
        }
        startService(intent)
        Log.d(TAG, "MicrophoneService stopped from QS tile")
    }

    private fun triggerListening() {
        val intent = Intent(this, MicrophoneService::class.java).apply {
            action = MicrophoneService.ACTION_START_LISTENING
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
    }

    // ─── Tile UI ─────────────────────────────────────────────────────────────

    /**
     * Updates the visual state of the QS tile.
     *
     * @param isActive  true = tile glows (like Bluetooth enabled)
     * @param subtitle  Optional subtitle text below the tile label (Android 10+)
     */
    private fun refreshTile(isActive: Boolean, subtitle: String? = null) {
        val tile = qsTile ?: return
        tile.state = if (isActive) Tile.STATE_ACTIVE else Tile.STATE_INACTIVE
        tile.label = "Anya AI"

        // Subtitle shows status (Android 10 / Q+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            tile.subtitle = subtitle ?: if (isActive) "Listening active" else "Tap to activate"
        }

        tile.updateTile()
    }
}
