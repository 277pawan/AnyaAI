# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# ─── 1. Keep Anya Custom Application, Services, and Native Modules ─────────
-keep class com.anyaai.** { *; }
-keepclassmembers class com.anyaai.** { *; }

# ─── 2. Keep SpeechRecognizer & RecognitionListener Callbacks ──────────────
# When R8 is enabled, it obfuscates/renames the RecognitionListener methods.
# Since the system speech service invokes these via IPC/reflection, renaming them
# causes an AbstractMethodError or NoSuchMethodError crash. We must keep them intact.
-keep class android.speech.SpeechRecognizer { *; }
-keep interface android.speech.RecognitionListener { *; }
-keep class * implements android.speech.RecognitionListener {
    public void onReadyForSpeech(android.os.Bundle);
    public void onBeginningOfSpeech();
    public void onRmsChanged(float);
    public void onBufferReceived(byte[]);
    public void onEndOfSpeech();
    public void onError(int);
    public void onResults(android.os.Bundle);
    public void onPartialResults(android.os.Bundle);
    public void onEvent(int, android.os.Bundle);
}

# ─── 3. Keep React Native Native Modules & Methods ─────────────────────────
-keepclassmembers class * {
    @com.facebook.react.bridge.ReactMethod *;
}
-keep class * extends com.facebook.react.bridge.ReactContextBaseJavaModule { *; }
-keep class * extends com.facebook.react.bridge.ReactPackage { *; }

# ─── 4. Keep Third-Party Packages (e.g. react-native-tts) ──────────────────
-keep class net.no_mad.tts.** { *; }
-keepclassmembers class net.no_mad.tts.** { *; }
