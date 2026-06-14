package com.anyaai.service

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.graphics.BitmapFactory
import android.util.Log
import androidx.core.app.NotificationCompat
import com.anyaai.MainActivity
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import java.net.URL
import kotlin.math.absoluteValue

/**
 * Builds rich notifications with full body text + optional hero image (no clipping).
 */
class AnyaFirebaseMessagingService : FirebaseMessagingService() {

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        val data = remoteMessage.data
        if (data.isEmpty() && remoteMessage.notification == null) return

        val title = data["title"] ?: remoteMessage.notification?.title ?: "Anya"
        val body = data["body"] ?: remoteMessage.notification?.body ?: ""
        val imageUrl = data["image_url"]?.takeIf { it.isNotEmpty() }
        val url = data["url"]?.takeIf { it.isNotEmpty() }

        AnyaNotificationHelper.show(
            context = this,
            title = title,
            body = body,
            imageUrl = imageUrl,
            linkUrl = url,
        )
    }
}

object AnyaNotificationHelper {
    private const val CHANNEL_ID = "default_notification_channel"

    fun show(
        context: android.content.Context,
        title: String,
        body: String,
        imageUrl: String? = null,
        linkUrl: String? = null,
    ) {
        try {
            val notificationManager =
                context.getSystemService(android.content.Context.NOTIFICATION_SERVICE) as NotificationManager
            val notificationId = (title.hashCode() + body.hashCode()).absoluteValue

            val intent = Intent(context, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
                if (!linkUrl.isNullOrEmpty()) {
                    data = android.net.Uri.parse(linkUrl)
                }
            }
            val pendingIntent = PendingIntent.getActivity(
                context,
                0,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )

            val iconResId =
                context.resources.getIdentifier("ic_anya_notif", "drawable", context.packageName)
            val finalIconResId =
                if (iconResId != 0) iconResId else android.R.drawable.ic_dialog_info

            val builder = NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(finalIconResId)
                .setContentTitle(title)
                .setContentText(body)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setDefaults(NotificationCompat.DEFAULT_ALL)
                .setContentIntent(pendingIntent)
                .setAutoCancel(true)
                .setStyle(NotificationCompat.BigTextStyle().bigText(body))

            if (!imageUrl.isNullOrEmpty()) {
                try {
                    val bitmap = URL(imageUrl).openStream().use { stream ->
                        BitmapFactory.decodeStream(stream)
                    }
                    if (bitmap != null) {
                        builder.setLargeIcon(bitmap)
                    }
                } catch (e: Exception) {
                    Log.w("AnyaNotif", "Image load failed, using text-only: ${e.message}")
                }
            }

            if (!linkUrl.isNullOrEmpty()) {
                val actionIntent = Intent(Intent.ACTION_VIEW, android.net.Uri.parse(linkUrl))
                val actionPendingIntent = PendingIntent.getActivity(
                    context,
                    1,
                    actionIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
                )
                builder.addAction(
                    android.R.drawable.ic_menu_view,
                    "Open Link",
                    actionPendingIntent,
                )
            }

            notificationManager.notify(notificationId, builder.build())
        } catch (e: Exception) {
            Log.e("AnyaNotif", "Failed to show notification: ${e.message}")
        }
    }
}
