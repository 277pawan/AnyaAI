import { Platform, NativeModules, Linking } from 'react-native';
import { CONFIG } from '../config/index';
import messaging from '@react-native-firebase/messaging';

/**
 * Service to handle OS-level push notifications via Firebase Cloud Messaging.
 * Uses only @react-native-firebase/messaging (no notifee — Gradle path issue).
 * Firebase automatically shows system-tray notifications when app is in background/killed.
 */
export const NotificationService = {

  /**
   * Request notification permissions and get the real FCM device token.
   * Automatically syncs the token to the backend user profile DB on boot.
   */
  async requestPermissionAndGetToken() {
    console.log('🔔 [FCM] Requesting notification permissions...');
    try {
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (!enabled) {
        console.warn('[FCM] Notification permission denied by user.');
        return null;
      }

      const token = await messaging().getToken();
      console.log('✅ [FCM] Real device token acquired:', token.substring(0, 30) + '...');

      // Automatically register device token in backend profile
      try {
        const USER_ID = '89968338-6678-48e0-be01-f8472e550e1d';
        const res = await fetch(`${CONFIG.API_BASE_URL}/api/user/profile`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': USER_ID,
          },
          body: JSON.stringify({ fcm_token: token }),
        });
        if (res.ok) {
          console.log('✅ [FCM] Token synced to user profile in DB.');
        } else {
          console.warn('[FCM] Backend token sync returned status:', res.status);
        }
      } catch (dbErr: any) {
        console.warn('[FCM] DB sync failed (server offline?):', dbErr.message);
      }

      return token;
    } catch (error: any) {
      console.error('[FCM] Token acquisition failed:', error.message);
      return null;
    }
  },

  /**
   * Set up FCM listeners.
   * - Background/Killed: Firebase shows system tray notification automatically.
   * - Foreground: Log only (no in-app toast or banner).
   */
  setupListeners() {
    console.log('🔔 [FCM] Setting up message listeners...');

    // Foreground message handler — just log, OS tray delivery handled by Firebase when in bg
    messaging().onMessage(async remoteMessage => {
      console.log('📡 [FCM] Foreground message received:', JSON.stringify({
        title: remoteMessage.notification?.title,
        body: remoteMessage.notification?.body,
        data: remoteMessage.data,
      }));
      const title =
        remoteMessage.data?.title ||
        remoteMessage.notification?.title ||
        'Anya Update';
      const body =
        remoteMessage.data?.body ||
        remoteMessage.notification?.body ||
        '';
      const url = remoteMessage.data?.url || null;
      const imageUrl = remoteMessage.data?.image_url || null;
      const { AnyaService } = NativeModules;
      if (AnyaService && typeof AnyaService.showNotification === 'function') {
        AnyaService.showNotification(title, body, url, imageUrl);
      }
    });

    // Background message handler (app in background or killed)
    messaging().setBackgroundMessageHandler(async remoteMessage => {
      console.log('📡 [FCM] Background message handled:', remoteMessage.notification?.title);
    });

    // Handle notification tap when app is in background (but not killed)
    messaging().onNotificationOpenedApp(remoteMessage => {
      console.log('📡 [FCM] Notification caused app to open from background:', remoteMessage);
      const url = remoteMessage?.data?.url;
      if (typeof url === 'string') {
        console.log('🔗 [FCM] Opening URL from notification data:', url);
        Linking.openURL(url).catch(err => {
          console.error('Failed to open link:', err);
        });
      }
    });

    // Handle notification tap when app is launched from a killed state
    messaging().getInitialNotification().then(remoteMessage => {
      if (remoteMessage) {
        console.log('📡 [FCM] Notification caused app to open from killed state:', remoteMessage);
        const url = remoteMessage?.data?.url;
        if (typeof url === 'string') {
          console.log('🔗 [FCM] Opening initial URL:', url);
          setTimeout(() => {
            Linking.openURL(url).catch(err => {
              console.error('Failed to open initial link:', err);
            });
          }, 1500); // Give the app enough time to boot & settle
        }
      }
    });

    // Handle deep links when MainActivity launches with data URI
    Linking.getInitialURL().then(url => {
      if (url) {
        console.log('🔗 [App] Initial deep link URL received:', url);
        if (url.startsWith('http')) {
          Linking.openURL(url).catch(err => console.error('Failed to open deep link URL:', err));
        }
      }
    });

    Linking.addEventListener('url', ({ url }) => {
      if (url) {
        console.log('🔗 [App] Dynamic deep link URL received:', url);
        if (url.startsWith('http')) {
          Linking.openURL(url).catch(err => console.error('Failed to open deep link URL:', err));
        }
      }
    });
  },
};
