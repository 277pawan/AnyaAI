// src/modules/useAnyaService.ts
// React Native bridge hook for the Anya Background Microphone Service.
//
// The native Android foreground service (MicrophoneService.kt) manages:
//   - Persistent notification panel icon (like Bluetooth / mobile data)
//   - SpeechRecognizer → voice capture
//   - REST API call to Anya MCP Server
//   - Broadcasts results back via DeviceEventEmitter
//
// This hook wires those broadcasts into React state so any screen can:
//   1. Start / stop the background service
//   2. Trigger a listening session from within the app
//   3. React to transcripts and Anya's spoken responses
//

import { useEffect, useRef, useCallback, useState } from 'react';
import {
  NativeModules,
  DeviceEventEmitter,
  Platform,
  PermissionsAndroid,
  NativeEventEmitter,
} from 'react-native';
import Tts from 'react-native-tts';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setVoiceCommunicationMode, resetAudioMode } from '../utils/audioHelper';

const { AnyaService } = NativeModules;

export interface AnyaServiceState {
  isRunning: boolean;
  isListening: boolean;
  transcript: string | null;
  lastResponse: string | null;
  error: string | null;
}

interface AnyaServiceControls {
  state: AnyaServiceState;
  startService: () => Promise<void>;
  stopService: () => void;
  startListening: () => void;
}

/**
 * useAnyaService — attach to any screen that needs background mic service control.
 *
 * @param autoStart  If true, starts the service immediately on mount (default: false)
 * @param speakReply If true, uses TTS to read Anya's reply aloud (default: true)
 */
export function useAnyaService(
  autoStart = false,
  speakReply = true,
): AnyaServiceControls {
  const [state, setState] = useState<AnyaServiceState>({
    isRunning: false,
    isListening: false,
    transcript: null,
    lastResponse: null,
    error: null,
  });

  const isMounted = useRef(true);

  // Helper to load and restore saved TTS configuration
  const loadTtsSettings = async () => {
    try {
      await Tts.getInitStatus();
      // Read saved rate/pitch from storage so ALL speech paths use the same value
      const savedRate  = await AsyncStorage.getItem('@anya_tts_rate');
      const savedPitch = await AsyncStorage.getItem('@anya_tts_pitch');
      Tts.setDefaultRate(savedRate   ? parseFloat(savedRate)  : 0.5);
      Tts.setDefaultPitch(savedPitch ? parseFloat(savedPitch) : 1.0);
      const savedVoiceId = await AsyncStorage.getItem('@anya_selected_voice');
      if (savedVoiceId) {
        console.log('[useAnyaService] ✅ Restoring saved voice preference:', savedVoiceId);
        await Tts.setDefaultVoice(savedVoiceId);
      }
    } catch (err) {
      console.warn('[useAnyaService] Error loading TTS settings:', err);
    }
  };

  // ─── Permission Check ───────────────────────────────────────────────────────

  const requestPermissions = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return false;

    const perms: string[] = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];

    if (Platform.Version >= 33) {
      perms.push(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    }

    try {
      const statuses = await PermissionsAndroid.requestMultiple(perms as any);
      const allGranted = Object.values(statuses).every(
        (s) => s === PermissionsAndroid.RESULTS.GRANTED,
      );
      return allGranted;
    } catch {
      return false;
    }
  }, []);

  // ─── Service Controls ───────────────────────────────────────────────────────

  const startService = useCallback(async () => {
    if (!AnyaService) {
      console.warn('[useAnyaService] Native module not available');
      return;
    }
    const granted = await requestPermissions();
    if (!granted) {
      setState(s => ({ ...s, error: 'Microphone permission required' }));
      return;
    }
    AnyaService.startService();
    if (isMounted.current) {
      setState(s => ({ ...s, isRunning: true, error: null }));
    }
  }, [requestPermissions]);

  const stopService = useCallback(() => {
    if (!AnyaService) return;
    AnyaService.stopService();
    resetAudioMode();   // restore normal audio pipeline
    if (isMounted.current) {
      setState(s => ({ ...s, isRunning: false, isListening: false }));
    }
  }, []);

  const startListening = useCallback(() => {
    if (!AnyaService) return;
    setVoiceCommunicationMode();   // activate AGC / NS / AEC before the mic opens
    AnyaService.startListening();
    if (isMounted.current) {
      setState(s => ({ ...s, isListening: true, transcript: null, error: null }));
    }
  }, []);

  // ─── Event Listeners ─────────────────────────────────────────────────────

  useEffect(() => {
    isMounted.current = true;

    // Load TTS settings on start so the voice is pre-configured
    loadTtsSettings();

    // Listen for speech transcript from the native service
    const transcriptSub = DeviceEventEmitter.addListener(
      'onAnyaSpeechResult',
      (transcript: string) => {
        if (!isMounted.current) return;
        console.log('[AnyaService] Transcript:', transcript);
        setState(s => ({ ...s, transcript, isListening: false }));
      },
    );

    // Listen for Anya's API response
    const responseSub = DeviceEventEmitter.addListener(
      'onAnyaResponse',
      async (response: string) => {
        if (!isMounted.current) return;
        console.log('[AnyaService] Response:', response);
        setState(s => ({ ...s, lastResponse: response }));

        // Speak the reply via TTS
        if (speakReply) {
          try {
            await loadTtsSettings(); // Double-check voice configuration before speaking
            Tts.stop();
            Tts.speak(response);
          } catch (e) {
            console.warn('[useAnyaService] Background TTS speak failed:', e);
          }
        }
      },
    );

    // Register as listener on the native module
    if (AnyaService?.addListener) {
      AnyaService.addListener('onAnyaSpeechResult');
      AnyaService.addListener('onAnyaResponse');
    }

    // Auto-start if requested
    if (autoStart) {
      startService();
    }

    return () => {
      isMounted.current = false;
      transcriptSub.remove();
      responseSub.remove();
      if (AnyaService?.removeListeners) {
        AnyaService.removeListeners(2);
      }
    };
  }, [autoStart, speakReply, startService]);

  return { state, startService, stopService, startListening };
}
