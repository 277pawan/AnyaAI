package com.anyaai

import android.os.Bundle
import android.content.Intent
import android.os.Build
import com.anyaai.service.MicrophoneService
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(null)

    // Start the persistent background mic service on app launch
    val intent = Intent(this, MicrophoneService::class.java)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        startForegroundService(intent)
    } else {
        startService(intent)
    }
  }

  override fun getMainComponentName(): String = "AnyaAI"

  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
