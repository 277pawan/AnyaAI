# AnyaAI Mobile Application

Welcome to the **AnyaAI** mobile application codebase! This is a state-of-the-art React Native voice-assistant app styled with a premium futuristic dark theme, dynamic mic visualizers, IST-aware history logs, and a fully visual vertical cockpit dashboard.

This guide provides a comprehensive, step-by-step walkthrough for **running**, **debugging**, and **building the production APK** on your mobile device.

---

## 📱 Quick Start Checklist
Before starting, ensure you have:
1. **JDK 17** installed and configured (`java -version`).
2. **Android SDK** installed with matching platform tools.
3. Your `ANDROID_HOME` path correctly exported in your shell config (e.g., `~/.bashrc` or `~/.zshrc`):
   ```bash
   export ANDROID_HOME=$HOME/Android/Sdk
   export PATH=$PATH:$ANDROID_HOME/emulator
   export PATH=$PATH:$ANDROID_HOME/tools
   export PATH=$PATH:$ANDROID_HOME/tools/bin
   export PATH=$PATH:$ANDROID_HOME/platform-tools
   ```

---

## ⚡ Step 1: Preparing Your Physical Android Device

To run the app directly on your physical Android phone:
1. **Enable Developer Options**: Go to `Settings -> About Phone -> Software Information` and tap **Build Number** 7 times until you see "Developer mode has been enabled".
2. **Enable USB Debugging**: Go back to `Settings -> Developer Options` and toggle **USB Debugging** to ON.
3. **Connect Your Phone**: Plug your phone into your computer via a high-quality USB cable.
4. **Confirm Connection**: Open your terminal and run:
   ```bash
   adb devices
   ```
   You should see your device listed (e.g., `R9ZN70WTT1T  device`).

---

## 🚀 Step 2: Bridge Connectivity (CRITICAL)

Because the mobile app runs inside your physical phone and the backend Anya MCP server runs on your laptop's `localhost` (Port `3000`), you must **reverse forward** the ports so the phone can communicate with your computer:

```bash
# Reverse forward the Metro bundler port
adb reverse tcp:8081 tcp:8081

# Reverse forward the Backend API port
adb reverse tcp:3000 tcp:3000
```
> [!IMPORTANT]
> Run these `adb reverse` commands every time you reconnect your phone to ensure the app doesn't show connection errors.

---

## 🛠️ Step 3: Run the Development Server

1. **Start the Metro Bundler**:
   ```bash
   npm start
   ```
   Keep this terminal window open.

2. **Build and Run the App on Android**:
   Open a separate terminal window and run:
   ```bash
   npm run android
   ```
   This will compile the native code, install the debug APK on your connected device, and launch the application.

---

## 📦 Step 4: Compiling & Packaging the APKs

When you are ready to compile standalone installer packages (`.apk`) that can be shared or permanently installed on phones without running a Metro dev server, follow these instructions:

### A. Compile a Standalone Debug APK
If you just want a test APK to share with others that runs independently:
1. Navigate to the `android` folder:
   ```bash
   cd android
   ```
2. Clean existing caches:
   ```bash
   ./gradlew clean
   ```
3. Assemble the debug APK:
   ```bash
   ./gradlew assembleDebug
   ```
4. **Where to find the APK**:
   Your newly compiled installer is located at:
   `android/app/build/outputs/apk/debug/app-debug.apk`

---

### B. Compile the Production Release APK (Optimized)
To build a highly optimized, fully minified, and lightweight Production Release APK:
1. Navigate to the `android` folder:
   ```bash
   cd android
   ```
2. Clean existing caches:
   ```bash
   ./gradlew clean
   ```
3. Compile the production binary:
   ```bash
   ./gradlew assembleRelease
   ```
4. **Where to find the Release APK**:
   Your production installer is located at:
   `android/app/build/outputs/apk/release/app-release.apk`

---

## 🔍 Troubleshooting Guide

### 1. `TypeError: Network request failed` / WebSocket Errors
- Ensure the backend service is running locally (`npm run dev` in `/anya-mcp-server`).
- Make sure you ran:
  ```bash
  adb reverse tcp:3000 tcp:3000
  ```

### 2. Device Unreachable or Emulator Issues
- Toggle your USB Debugging off and back on in your phone's Developer settings.
- Run `adb kill-server && adb start-server` to reset the ADB connection bridge.

### 3. Gradle Build Cache Failures
- If native packages are not compiling correctly after changing permissions or versions, clean the build cache:
  ```bash
  cd /home/pawan-bisht/Documents/Anya-\)/AnyaAI/android
./gradlew clean
./gradlew assembleDebug
  cd android && ./gradlew clean
  ```
  Then rebuild using `npm run android`.
