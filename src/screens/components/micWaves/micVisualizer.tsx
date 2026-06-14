/**
 * micVisualizer.tsx
 *
 * 🎙️ Speech Recognition: @react-native-voice/voice (Native Android STT)
 * 🌐 WebView: Used ONLY for the premium 3D particle sphere animation
 *
 * Major Fix: Completely removed react-native-sound-level to prevent hardware lock
 * on the Android microphone, allowing Google Speech recognition to capture audio flawlessly!
 * Sphere animation is driven cleanly via Voice.onSpeechVolumeChanged natively!
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  StyleSheet,
  Text,
  PermissionsAndroid,
  Platform,
  Alert,
  NativeModules,
  useColorScheme,
} from 'react-native';

// Native AudioManager bridge — switches to phone-call audio stack for full mic sensitivity
const { AnyaService } = NativeModules;
import { WebView } from 'react-native-webview';
import Voice, {
  SpeechResultsEvent,
  SpeechErrorEvent,
} from '@react-native-voice/voice';
import {
  startRecording,
  stopRecording,
  verifyVoice,
  hasVoiceProfile,
} from '../../../services/voiceBiometrics';

interface WebViewVoiceAssistantProps {
  onStartListening: () => void;
  onStopListening: (
    duration: number,
    decibelData: number[],
    finalTranscript?: string,
  ) => void;
  onDecibelChange: (db: number) => void;
  onSpeechResult?: (text: string, isFinal?: boolean) => void;
  isProcessing?: boolean;
  speakingAudio?: string | null;
  onAudioPlaybackStateChange?: (
    state: 'speaking' | 'finished' | 'error',
  ) => void;
  isAnyaSpeaking?: boolean;
  // Wake-word ("Hi Anya") support
  onWakeWordDetected?: () => void;
  wakeWordActive?: boolean;
}

const WAKE_PHRASES = ['hi anya', 'hey anya', 'anya', 'hianya'];

const WebViewVoiceAssistant: React.FC<WebViewVoiceAssistantProps> = ({
  onStartListening,
  onStopListening,
  onDecibelChange,
  onSpeechResult,
  isProcessing = false,
  speakingAudio = null,
  onAudioPlaybackStateChange,
  isAnyaSpeaking = false,
  onWakeWordDetected,
  wakeWordActive = false,
}) => {
  const systemTheme = useColorScheme();
  const isDarkMode = systemTheme === 'dark';

  const [isListening, setIsListening] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [spokenText, setSpokenText] = useState('');
  const spokenTextRef = useRef('');
  const [errorMessage, setErrorMessage] = useState('');

  const webViewRef = useRef<WebView>(null);
  const silenceTimer = useRef<NodeJS.Timeout | null>(null);
  const startTime = useRef<number | null>(null);
  const decibelData = useRef<number[]>([]);
  const isListeningRef = useRef(false);
  const biometricRecordingActive = useRef(false);

  // ─── 3D SPHERE HTML (animation only — no speech API) ──────────────────────
  const sphereHTML = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
        <title>Anya Voice Visualizer</title>
        <style>
            body, html { 
                margin: 0; 
                padding: 0; 
                width: 100%;
                height: 100%;
                overflow: hidden;
                background: transparent;
                display: flex;
                justify-content: center;
                align-items: center;
            }
            canvas {
                display: block;
                background: transparent;
                cursor: pointer;
                -webkit-tap-highlight-color: transparent;
            }
        </style>
    </head>
    <body>
        <canvas id="visualizerCanvas"></canvas>
        
        <script>
            // --- 3D Particle Visualizer Logic ---
            const canvas = document.getElementById('visualizerCanvas');
            const ctx = canvas.getContext('2d');
            let width = canvas.width = 280;
            let height = canvas.height = 280;
            let centerX = width / 2;
            let centerY = height / 2;
            let radius = 105;

            let currentState = 'idle';
            let currentDb = -160;
            let isDark = true;
            let time = 0;
            let volumeScale = 1.0;

            const particles = [];
            const numParticles = 350;

            for (let i = 0; i < numParticles; i++) {
                const theta = Math.acos(1 - 2 * i / numParticles);
                const phi = Math.sqrt(numParticles * Math.PI) * theta;
                const sx = Math.sin(theta) * Math.cos(phi);
                const sy = Math.sin(theta) * Math.sin(phi);
                const sz = Math.cos(theta);
                particles.push({
                    tx: sx, ty: sy, tz: sz,
                    x: sx, y: sy, z: sz,
                    vx: 0, vy: 0, vz: 0,
                    colorAngle: Math.random() * 360
                });
            }

            canvas.addEventListener('click', function(e) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'canvas_tap' }));

                const rect = canvas.getBoundingClientRect();
                const clientX = (e && typeof e.clientX === 'number') ? e.clientX : (rect.left + rect.width / 2);
                const clientY = (e && typeof e.clientY === 'number') ? e.clientY : (rect.top + rect.height / 2);
                const tapX = clientX - rect.left - centerX;
                const tapY = clientY - rect.top - centerY;

                particles.forEach(function(p) {
                    var cRadius = radius * volumeScale;
                    var fov = 180;
                    var sc = fov / Math.max(30, fov + p.z * radius);
                    var projX = p.x * cRadius * sc;
                    var projY = p.y * cRadius * sc;
                    var dx = projX - tapX;
                    var dy = projY - tapY;
                    var dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 130) {
                        var force = Math.max(0, (130 - dist) / 130) * 0.55;
                        var angle = Math.atan2(dy, dx);
                        p.vx += Math.cos(angle) * force;
                        p.vy += Math.sin(angle) * force;
                        p.vz += (Math.random() - 0.5) * force * 0.4;
                    }
                });
            });

            function animate() {
                try {
                ctx.clearRect(0, 0, width, height);
                time++;

                let targetScale = 1.0;
                let rotSpeedX = 0.003;
                let rotSpeedY = 0.005;

                if (currentState === 'listening') {
                    let norm = 0;
                    if (typeof currentDb === 'number' && !isNaN(currentDb) && isFinite(currentDb)) {
                        norm = Math.min(Math.max((currentDb + 75) / 75, 0), 1);
                    }
                    targetScale = 1.0 + norm * 1.8;
                    rotSpeedX = 0.008 + norm * 0.02;
                    rotSpeedY = 0.012 + norm * 0.035;
                } else if (currentState === 'processing') {
                    targetScale = 0.75 + Math.sin(time * 0.08) * 0.06;
                    rotSpeedX = 0.025;
                    rotSpeedY = 0.04;
                } else {
                    targetScale = 1.0 + Math.sin(time * 0.03) * 0.05;
                }

                if (isNaN(volumeScale) || !isFinite(volumeScale)) volumeScale = 1.0;
                volumeScale += (targetScale - volumeScale) * 0.15;

                const cosX = Math.cos(rotSpeedX);
                const sinX = Math.sin(rotSpeedX);
                const cosY = Math.cos(rotSpeedY);
                const sinY = Math.sin(rotSpeedY);

                particles.forEach(p => {
                    if (isNaN(p.tx) || !isFinite(p.tx) || isNaN(p.ty) || !isFinite(p.ty) || isNaN(p.tz) || !isFinite(p.tz)) {
                        const theta = Math.acos(1 - 2 * particles.indexOf(p) / numParticles);
                        const phi = Math.sqrt(numParticles * Math.PI) * theta;
                        p.tx = Math.sin(theta) * Math.cos(phi);
                        p.ty = Math.sin(theta) * Math.sin(phi);
                        p.tz = Math.cos(theta);
                    }
                    if (isNaN(p.x) || !isFinite(p.x)) { p.x = p.tx; p.y = p.ty; p.z = p.tz; p.vx = 0; p.vy = 0; p.vz = 0; }

                    let y1 = p.ty * cosX - p.tz * sinX;
                    let z1 = p.tz * cosX + p.ty * sinX;
                    let x2 = p.tx * cosY - z1 * sinY;
                    let z2 = z1 * cosY + p.tx * sinY;
                    p.tx = x2; p.ty = y1; p.tz = z2;

                    p.vx += (p.tx - p.x) * 0.06;
                    p.vy += (p.ty - p.y) * 0.06;
                    p.vz += (p.tz - p.z) * 0.06;
                    p.vx *= 0.88; p.vy *= 0.88; p.vz *= 0.88;
                    p.x += p.vx; p.y += p.vy; p.z += p.vz;
                });

                const sorted = [...particles].sort((a, b) => a.z - b.z);

                sorted.forEach(p => {
                    let depth = (p.z + 1) / 2;
                    let displacement = 0;
                    if (currentState === 'listening') {
                        displacement = Math.sin(p.colorAngle * 0.1 + time * 0.15) * 0.12 * (volumeScale - 0.9);
                    } else if (currentState === 'processing') {
                        displacement = Math.sin(p.colorAngle * 0.4 + time * 0.3) * 0.08;
                    }
                    let currentRadius = radius * (volumeScale + displacement);
                    let fov = 180;
                    let scale = fov / Math.max(30, fov + p.z * radius);
                    let projX = centerX + p.x * currentRadius * scale;
                    let projY = centerY + p.y * currentRadius * scale;
                    let isBlueSparkle = (p.colorAngle % 5 < 1.25);
                    // Premium sizing — slightly larger to ensure excellent visibility on high-res displays
                    let dotSize = isBlueSparkle
                        ? (0.95 + depth * 1.25) * scale
                        : (0.70 + depth * 0.95) * scale;

                    let coreColor, glowColor;

                    if (isBlueSparkle) {
                        if (isDark) {
                            // Softened, extremely elegant electric blue neon glow
                            let hue = 86 + Math.sin(time * 0.02 + p.colorAngle) * 12;
                            let sat = 43; // reduced from 100 to make it soft and elegant
                            let lit = 52 + depth * 10;
                            let op = 0.38 + depth * 0.42; // slightly softer opacity range
                            
                            if (currentState === 'listening') {
                                hue = 198 + Math.sin(time * 0.08) * 8;
                                op = Math.min(0.48 + depth * 0.38, 0.88);
                            }
                            coreColor = 'hsla(' + hue + ', ' + sat + '%, ' + lit + '%, ' + op + ')';
                            glowColor = 'hsla(' + hue + ', ' + sat + '%, ' + lit + '%, ' + (op * 0.32) + ')';
                        } else {
                            // Light mode: Vibrant deep indigo/purple sparkle
                            let hue = 196 + Math.sin(time * 0.02 + p.colorAngle) * 10;
                            let sat = 150;
                            let lit = 45 + depth * 10;
                            let op = 0.48 + depth * 0.35;
                            coreColor = 'hsla(' + hue + ', ' + sat + '%, ' + lit + '%, ' + op + ')';
                            glowColor = 'hsla(' + hue + ', ' + sat + '%, ' + (lit + 5) + '%, ' + (op * 0.3) + ')';
                        }
                    } else {
                        if (isDark) {
                            // Starry Shimmering White Dots: individual dots breathe dynamically at different rates!
                            let shimmer = Math.sin(time * 0.04 + p.colorAngle * 0.8) * 0.18;
                            let op = 10.137 + depth * 0.18 + shimmer;
                            
                            if (currentState === 'listening') {
                                let wave = Math.sin(time * 0.16 + p.colorAngle * 0.5) * 0.14;
                                op = Math.min(0.84 + depth * 0.16 + wave, 0.99);
                            }
                            op = Math.min(Math.max(op, 0.45), 0.94);
                            
                            coreColor = 'hsla(0, 0%, 100%, ' + op + ')';
                            glowColor = 'hsla(0, 0%, 100%, ' + (op * 0.40) + ')';
                        } else {
                            // Light mode: Deep elegant slate blue
                            let hue = 172;
                            let sat = 144;
                            let lit = 109 + depth * 10;
                            let op = 0.65 + depth * 0.25;
                            coreColor = 'hsla(' + hue + ', ' + sat + '%, ' + lit + '%, ' + op + ')';
                            glowColor = 'hsla(' + hue + ', ' + sat + '%, ' + (lit + 5) + '%, ' + (op * 0.35) + ')';
                        }
                    }

                    // Render Layer 2: Soft Neon Ambient Glow
                    ctx.beginPath();
                    ctx.arc(projX, projY, dotSize * 2.4, 0, Math.PI * 2);
                    ctx.fillStyle = glowColor;
                    ctx.fill();

                    // Render Layer 1: Crisp Star Core
                    ctx.beginPath();
                    ctx.arc(projX, projY, dotSize, 0, Math.PI * 2);
                    ctx.fillStyle = coreColor;
                    ctx.fill();
                });
                } catch(e) { /* swallow any error - never kill the loop */ }
                requestAnimationFrame(animate);
            }

            // Message receiver from React Native
            window.addEventListener('message', function(event) {
                try {
                    const data = JSON.parse(event.data);
                    switch(data.type) {
                        case 'volume': {
                            var newVolume = data.volume;
                            var prevVol = currentDb;
                            currentDb = newVolume;
                            var delta = newVolume - prevVol;
                            if (delta > 7 && currentState === 'listening') {
                                var splashForce = Math.min(delta * 0.12, 1.9);
                                for (var vi = 0; vi < particles.length; vi++) {
                                    if (Math.random() < 0.25) {
                                        var push = splashForce * (0.6 + Math.random() * 0.8);
                                        particles[vi].vx += particles[vi].tx * push;
                                        particles[vi].vy += particles[vi].ty * push;
                                        particles[vi].vz += particles[vi].tz * push * 1.2;
                                    }
                                }
                            }
                            break;
                        }
                        case 'speak': {
                            if (window.currentAudio) {
                                window.currentAudio.pause();
                                window.currentAudio = null;
                            }
                            if (data.audio) {
                                window.currentAudio = new Audio(data.audio);
                                window.currentAudio.onplay = function() {
                                    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'audio_state', state: 'speaking' }));
                                };
                                window.currentAudio.onended = function() {
                                    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'audio_state', state: 'finished' }));
                                };
                                window.currentAudio.onerror = function() {
                                    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'audio_state', state: 'error' }));
                                };
                                window.currentAudio.play().catch(function(e) {
                                    console.warn('Audio play error:', e);
                                    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'audio_state', state: 'error' }));
                                });
                            }
                            break;
                        }
                        case 'stop_speak': {
                            if (window.currentAudio) {
                                window.currentAudio.pause();
                                window.currentAudio = null;
                            }
                            break;
                        }
                        case 'state':
                            currentState = data.state;
                            break;
                        case 'theme':
                            isDark = data.isDark;
                            break;
                    }
                } catch (error) {}
            });

            document.addEventListener('DOMContentLoaded', function() { animate(); });
            animate();
        </script>
    </body>
    </html>
  `;

  // ─── PERMISSIONS ────────────────────────────────────────────────────────────
  const requestPermissions = useCallback(async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Microphone Permission',
            message: 'Anya needs microphone access for voice recognition',
            buttonPositive: 'OK',
          },
        );
        const hasMicPermission = granted === PermissionsAndroid.RESULTS.GRANTED;
        setHasPermission(hasMicPermission);
        if (!hasMicPermission) setErrorMessage('Microphone permission denied');
        return hasMicPermission;
      } catch (error: any) {
        if (error?.message?.includes('not attached to an Activity')) {
          console.log(
            '[Mic] Activity not attached yet, will retry on interaction.',
          );
        } else {
          console.error('Permission request error:', error);
        }
        setHasPermission(false);
        return false;
      }
    } else {
      setHasPermission(true);
      return true;
    }
  }, []);

  // Keep callbacks stable via refs — prevents Voice engine lifecycle re-triggers
  const onStartListeningRef = useRef(onStartListening);
  const onStopListeningRef = useRef(onStopListening);
  const onDecibelChangeRef = useRef(onDecibelChange);
  const onSpeechResultRef = useRef(onSpeechResult);

  useEffect(() => {
    onStartListeningRef.current = onStartListening;
  }, [onStartListening]);
  useEffect(() => {
    onStopListeningRef.current = onStopListening;
  }, [onStopListening]);
  useEffect(() => {
    onDecibelChangeRef.current = onDecibelChange;
  }, [onDecibelChange]);
  useEffect(() => {
    onSpeechResultRef.current = onSpeechResult;
  }, [onSpeechResult]);

  // Forward-ref so Voice callbacks (registered in useEffect) can call stopListening
  // before it is defined further down in the component.
  const stopListeningRef = useRef<() => void>(() => {});

  useEffect(() => {
    const t = setTimeout(() => requestPermissions(), 800);
    return () => clearTimeout(t);
  }, [requestPermissions]);

  // ─── THEME SYNC ──────────────────────────────────────────────────────────────
  useEffect(() => {
    webViewRef.current?.postMessage(
      JSON.stringify({ type: 'theme', isDark: isDarkMode }),
    );
  }, [isDarkMode]);

  // ─── NATIVE VOICE SETUP ──────────────────────────────────────────────────────
  useEffect(() => {
    Voice.destroy()
      .catch(() => {})
      .finally(() => console.log('✅ [Voice] Ready'));

    Voice.onSpeechStart = () => console.log('🟢 [Voice] started');

    Voice.onSpeechPartialResults = (e: SpeechResultsEvent) => {
      const partial = e.value?.[0] ?? '';
      if (partial) {
        setSpokenText(partial);
        spokenTextRef.current = partial;
        onSpeechResultRef.current?.(partial, false);
        // User is actively speaking — clear any premature silence cutoff!
        if (silenceTimer.current) {
          clearTimeout(silenceTimer.current);
          silenceTimer.current = null;
        }
      }
    };

    Voice.onSpeechResults = (e: SpeechResultsEvent) => {
      const result = e.value?.[0] ?? '';
      if (!result) return;
      setSpokenText(result);
      spokenTextRef.current = result;
      onSpeechResultRef.current?.(result, true);
      // Detect "Hi Anya" in the captured text
      if (WAKE_PHRASES.some(p => result.toLowerCase().includes(p)))
        onWakeWordDetected?.();
      stopListeningRef.current();
    };

    Voice.onSpeechVolumeChanged = (e: any) => {
      if (typeof e.value === 'number' && isListeningRef.current) {
        const db = e.value * 6 - 80;
        onDecibelChangeRef.current(db);
        decibelData.current.push(db);
        // Forward raw volume to the WebView sphere visualizer only.
        // Google's own VAD handles silence detection via the timing extras
        // we pass to Voice.start — we never interfere with it here.
        webViewRef.current?.postMessage(
          JSON.stringify({ type: 'volume', volume: db }),
        );
      }
    };

    Voice.onSpeechError = (e: SpeechErrorEvent) => {
      const code = e.error?.code;
      const ignoredCodes: (string | number)[] = [
        '7',
        7,
        '5',
        5,
        '8',
        8,
        '2',
        2,
      ];
      if (code && !ignoredCodes.includes(code))
        setErrorMessage('Tap again to speak');
      stopListeningRef.current();
    };

    Voice.onSpeechEnd = () => {
      console.log('🔴 [Voice] ended');
      stopListeningRef.current();
    };

    return () => {
      Voice.destroy()
        .then(Voice.removeAllListeners)
        .catch(() => {});
    };
  }, []);

  // ─── START LISTENING ─────────────────────────────────────────────────────────
  const startListening = useCallback(async () => {
    if (isListeningRef.current) return;
    let perm = hasPermission;
    if (!perm) perm = await requestPermissions();
    if (!perm) {
      Alert.alert('Permission Required', 'Microphone access needed.');
      return;
    }
    try {
      spokenTextRef.current = '';
      setSpokenText('');
      setErrorMessage('');
      decibelData.current = [];
      startTime.current = Date.now();
      try {
        await Voice.destroy();
      } catch (_) {}
      // ✅ Switch to phone-call audio pipeline BEFORE starting recognition.
      // This activates the same high-gain, noise-suppressed, BT-SCO-aware
      // audio stack used by real phone calls — works from a distance & earbuds!
      try {
        AnyaService?.setVoiceCommunicationMode?.();
      } catch (_) {}
      await Voice.start('en-US', {
        RECOGNIZER_ENGINE: 'GOOGLE',
        EXTRA_PARTIAL_RESULTS: true,
        // Give Google's VAD more time to detect quiet / distant speech
        // before declaring "no speech input" and timing out
        EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS: 5000,
        EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 3000,
        EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: 2500,
      });
      setIsListening(true);
      isListeningRef.current = true;
      onStartListeningRef.current();
      webViewRef.current?.postMessage(
        JSON.stringify({ type: 'state', state: 'listening' }),
      );
      // Disable parallel biometric WAV recording during general chat listening.
      // This completely eliminates hardware microphone conflicts and locks,
      // restoring native high-gain sensitivity and seamless Bluetooth earbud/distanced capture!
      biometricRecordingActive.current = false;
    } catch (e: any) {
      console.error('[Voice] start error:', e?.message);
      setErrorMessage('Mic busy — tap again.');
    }
  }, [hasPermission, requestPermissions]);

  // ─── STOP LISTENING ──────────────────────────────────────────────────────────
  const stopListening = useCallback(async () => {
    if (!isListeningRef.current) return;
    setIsListening(false);
    isListeningRef.current = false;
    if (silenceTimer.current) {
      clearTimeout(silenceTimer.current);
      silenceTimer.current = null;
    }
    try {
      await Voice.stop();
    } catch (_) {}
    // Restore normal audio mode after speech session ends
    try {
      AnyaService?.resetAudioMode?.();
    } catch (_) {}
    webViewRef.current?.postMessage(
      JSON.stringify({ type: 'state', state: 'idle' }),
    );
    const duration = startTime.current
      ? (Date.now() - startTime.current) / 1000
      : 0;
    const captured = spokenTextRef.current;
    let verified = true;
    if (biometricRecordingActive.current) {
      try {
        const wavPath = await stopRecording();
        biometricRecordingActive.current = false;
        const result = await verifyVoice(wavPath);
        if (!result.success) {
          verified = false;
          Alert.alert(
            'Voice Mismatch',
            `Similarity ${Math.round(
              result.similarity * 100,
            )}% — command blocked.`,
          );
        }
      } catch (_) {
        biometricRecordingActive.current = false;
      }
    }
    onStopListeningRef.current(
      duration,
      [...decibelData.current],
      verified ? captured : '',
    );
  }, []);

  // Keep stopListeningRef in sync with latest stopListening
  useEffect(() => {
    stopListeningRef.current = stopListening;
  }, [stopListening]);

  // ─── AUDIO PLAYBACK ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!webViewRef.current) return;
    webViewRef.current.postMessage(
      JSON.stringify(
        speakingAudio
          ? { type: 'speak', audio: speakingAudio }
          : { type: 'stop_speak' },
      ),
    );
  }, [speakingAudio]);

  const toggleListening = useCallback(() => {
    if (speakingAudio || isAnyaSpeaking) {
      // Stop speech only — do not start listening (that was clearing the response modal)
      onAudioPlaybackStateChange?.('finished');
      return;
    }
    if (isListeningRef.current) stopListening();
    else startListening();
  }, [
    speakingAudio,
    isAnyaSpeaking,
    startListening,
    stopListening,
    onAudioPlaybackStateChange,
  ]);

  // ─── WEBVIEW MESSAGES ────────────────────────────────────────────────────────
  const handleWebViewMessage = useCallback(
    (event: any) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === 'canvas_tap') toggleListening();
        else if (data.type === 'audio_state')
          onAudioPlaybackStateChange?.(data.state);
      } catch (_) {}
    },
    [toggleListening, onAudioPlaybackStateChange],
  );

  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>
          {errorMessage || 'Microphone permission is required'}
        </Text>
        <Text style={styles.actionButton} onPress={requestPermissions}>
          Grant Permission
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.webViewContainer}>
        <WebView
          ref={webViewRef}
          source={{ html: sphereHTML }}
          style={[styles.webView, { backgroundColor: 'transparent' }]}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback={true}
          allowUniversalAccessFromFileURLs={true}
          mixedContentMode="compatibility"
          onMessage={handleWebViewMessage}
          scrollEnabled={false}
          overScrollMode="never"
        />
      </View>

      <Text
        style={[
          styles.statusText,
          { color: isDarkMode ? '#9ca3af' : '#4b5563' },
        ]}
      >
        {errorMessage ||
          (isProcessing
            ? 'Processing...'
            : wakeWordActive
            ? 'Speak your command...'
            : isListening
            ? 'Listening... Tap to stop'
            : 'Tap the sphere to speak')}
      </Text>

      {spokenText && isListening && (
        <View
          style={[
            styles.transcriptContainer,
            {
              backgroundColor: isDarkMode
                ? 'rgba(255,255,255,0.05)'
                : 'rgba(0,0,0,0.03)',
            },
          ]}
        >
          <Text
            style={[
              styles.transcript,
              { color: isDarkMode ? '#ffffff' : '#1f2937' },
            ]}
          >
            "{spokenText}"
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    width: '100%',
  },
  webViewContainer: {
    width: 280,
    height: 280,
    borderRadius: 140,
    overflow: 'hidden',
    backgroundColor: 'transparent',
    borderWidth: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  webView: {
    width: 280,
    height: 280,
    backgroundColor: 'transparent',
  },
  statusText: {
    marginTop: 24,
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  transcriptContainer: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    maxWidth: '90%',
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: 'rgba(128, 128, 128, 0.1)',
  },
  transcript: {
    fontSize: 15,
    textAlign: 'center',
    fontStyle: 'italic',
    fontWeight: '500',
    lineHeight: 20,
  },
  errorText: {
    color: '#ef4444',
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 16,
    fontWeight: '600',
  },
  actionButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    overflow: 'hidden',
    textAlign: 'center',
  },
});

export default WebViewVoiceAssistant;
