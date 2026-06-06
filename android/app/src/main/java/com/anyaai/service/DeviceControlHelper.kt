package com.anyaai.service

import android.app.SearchManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.MediaStore
import android.util.Log

object DeviceControlHelper {
    private const val TAG = "DeviceControlHelper"

    fun executeCommand(context: Context, command: String, query: String?, packageName: String?, url: String?) {
        Log.d(TAG, "Executing device command: $command (query=$query, package=$packageName, url=$url)")
        try {
            when (command.lowercase()) {
                "play_music" -> {
                    playMusic(context, query ?: "", url)
                }
                "open_app" -> {
                    if (!packageName.isNullOrBlank()) {
                        openApp(context, packageName)
                    }
                }
                "open_url" -> {
                    if (!url.isNullOrBlank()) {
                        openUrl(context, url)
                    }
                }
                else -> {
                    Log.w(TAG, "Unknown command: $command")
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to execute command $command: ${e.message}")
        }
    }

    private fun playMusic(context: Context, songQuery: String, musicUrl: String?) {
        // If we have a direct play URL (resolved video ID), launch it directly for autoplay!
        if (!musicUrl.isNullOrBlank() && musicUrl.contains("watch?v=")) {
            try {
                val intent = Intent(Intent.ACTION_VIEW, Uri.parse(musicUrl)).apply {
                    `package` = "com.google.android.apps.youtube.music"
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                context.startActivity(intent)
                Log.d(TAG, "Successfully started YouTube Music autoplay via URL: $musicUrl")
                return
            } catch (e: Exception) {
                Log.w(TAG, "Failed to launch YouTube Music via deep link: ${e.message}")
            }
        }

        // Fallback to standard Media Play search intent
        try {
            val intent = Intent(MediaStore.INTENT_ACTION_MEDIA_PLAY_FROM_SEARCH).apply {
                if (songQuery.isNotBlank()) {
                    putExtra(SearchManager.QUERY, songQuery)
                    putExtra(MediaStore.EXTRA_MEDIA_FOCUS, "vnd.android.cursor.item/audio")
                }
                `package` = "com.google.android.apps.youtube.music"
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(intent)
            Log.d(TAG, "Launched YouTube Music search for: $songQuery")
        } catch (e: Exception) {
            Log.w(TAG, "YouTube Music app failed to start, falling back to browser: ${e.message}")
            // Fallback: open YouTube Music in browser or standard YouTube search
            try {
                val searchUrl = if (!musicUrl.isNullOrBlank()) {
                    musicUrl
                } else if (songQuery.isNotBlank()) {
                    "https://music.youtube.com/search?q=" + Uri.encode(songQuery)
                } else {
                    "https://music.youtube.com"
                }
                val browserIntent = Intent(Intent.ACTION_VIEW, Uri.parse(searchUrl)).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                context.startActivity(browserIntent)
            } catch (ex: Exception) {
                Log.e(TAG, "Fallback to browser failed: ${ex.message}")
            }
        }
    }

    private fun openApp(context: Context, packageName: String) {
        try {
            val launchIntent = context.packageManager.getLaunchIntentForPackage(packageName)
            if (launchIntent != null) {
                launchIntent.flags = Intent.FLAG_ACTIVITY_NEW_TASK
                context.startActivity(launchIntent)
                Log.d(TAG, "Successfully opened app: $packageName")
            } else {
                Log.w(TAG, "App $packageName not installed, redirecting to Play Store")
                // Not installed, open Play Store details page
                val playStoreIntent = Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=$packageName")).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK
                }
                context.startActivity(playStoreIntent)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to open app $packageName: ${e.message}")
        }
    }

    private fun openUrl(context: Context, url: String) {
        try {
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(intent)
            Log.d(TAG, "Successfully opened URL: $url")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to open URL $url: ${e.message}")
        }
    }
}
