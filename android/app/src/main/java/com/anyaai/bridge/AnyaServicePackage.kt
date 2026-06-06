package com.anyaai.bridge

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * AnyaServicePackage — ReactPackage Registration
 *
 * Registers AnyaServiceModule so React Native's auto-linking
 * and PackageList can find it.
 *
 * Added manually in MainApplication.kt:
 *   add(AnyaServicePackage())
 */
class AnyaServicePackage : ReactPackage {

    override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
        listOf(AnyaServiceModule(reactContext))

    override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}
