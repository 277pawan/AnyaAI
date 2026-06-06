// src/utils/audioHelper.ts
//
// JS-side wrapper for the native AnyaService AudioManager controls.
//
// Call setVoiceCommunicationMode() BEFORE starting microphone capture.
// This switches Android into MODE_IN_COMMUNICATION — the same audio
// pipeline used by phone calls — which activates:
//   ✓ Hardware Automatic Gain Control  (AGC)   — fixes far-field hearing
//   ✓ Noise Suppression                (NS)    — removes background noise
//   ✓ Acoustic Echo Cancellation       (AEC)   — prevents speaker feedback
//   ✓ Bluetooth SCO mic routing               — enables earbud mic from afar
//
// On iOS this is a no-op; AVAudioSession is configured in AppDelegate.mm.

import { NativeModules, Platform } from 'react-native';

const { AnyaService } = NativeModules;

/**
 * Activate phone-call audio mode before starting mic capture.
 *
 * Safe to call even if AnyaService native module is unavailable —
 * it will warn in console but not throw.
 */
export function setVoiceCommunicationMode(): void {
  if (Platform.OS !== 'android') return;
  if (!AnyaService?.setVoiceCommunicationMode) {
    console.warn('[audioHelper] setVoiceCommunicationMode not available — rebuild app.');
    return;
  }
  AnyaService.setVoiceCommunicationMode();
}

/**
 * Restore normal audio mode after mic capture ends.
 *
 * Call this in your stop / cleanup path so other audio (music,
 * notifications) returns to normal routing.
 */
export function resetAudioMode(): void {
  if (Platform.OS !== 'android') return;
  if (!AnyaService?.resetAudioMode) {
    console.warn('[audioHelper] resetAudioMode not available — rebuild app.');
    return;
  }
  AnyaService.resetAudioMode();
}
