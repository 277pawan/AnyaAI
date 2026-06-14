import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
  useContext,
} from 'react';
import {
  StyleSheet,
  Text,
  SafeAreaView,
  View,
  StatusBar,
  Alert,
  TouchableOpacity,
  TextInput,
  FlatList,
  Linking,
  KeyboardAvoidingView,
  Platform,
  PermissionsAndroid,
  Clipboard,
  ScrollView,
  Image,
  NativeModules,
  AppState,
  ActivityIndicator,
  DeviceEventEmitter,
} from 'react-native';
import MaterialCommunityIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import WebViewVoiceAssistant from './components/micWaves/micVisualizer';
import Contacts from 'react-native-contacts';
import Tts from 'react-native-tts';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeContext } from '../../App';
import { anyaChat } from '../services/chatSocket';
import { ChatAPI } from '../services/api';

interface Contact {
  id: string;
  name: string;
  phone: string;
}

interface HomeScreenProps {
  navigation?: any;
}

const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const { theme } = useContext(ThemeContext);
  const isDarkMode = theme === 'dark';

  // Theme Color System
  const backgroundColor = isDarkMode ? '#050505' : '#f3f4f6';
  const textColor = isDarkMode ? '#ffffff' : '#111827';
  const cardBgColor = isDarkMode ? '#121212' : '#ffffff';
  const borderColor = isDarkMode ? '#222222' : '#e5e7eb';
  const subtextColor = isDarkMode ? '#9ca3af' : '#6b7280';
  const inputBgColor = isDarkMode ? '#1e1e1e' : '#f9fafb';

  // Assistant & Speech States
  const [isAssistantActive, setIsAssistantActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastSpeech, setLastSpeech] = useState<string>('');
  const [backgroundTaskStatus, setBackgroundTaskStatus] = useState<
    string | null
  >(null);

  // 🎙️ Live Transcript (words appear as user speaks)
  const [liveTranscript, setLiveTranscript] = useState('');

  const [aiResponse, setAiResponse] = useState('');
  const [isResponseVisible, setIsResponseVisible] = useState(false);
  const [isResponseExpanded, setIsResponseExpanded] = useState(true);
  const [isAnyaThinking, setIsAnyaThinking] = useState(false);
  const [isAnyaSpeaking, setIsAnyaSpeaking] = useState(false);
  const [speakingAudio, setSpeakingAudio] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const fullResponseRef = useRef('');
  const sentenceBufferRef = useRef('');
  const isNewResponseRef = useRef(true); // tracks whether next chunk starts a brand-new response
  const thinkingTimeoutRef = useRef<NodeJS.Timeout | null>(null); // cancel guard
  const isAnyaSpeakingRef = useRef(false);
  const backgroundTaskActiveRef = useRef(false);
  const skipVoiceRef = useRef(false);
  const voiceReaderEnabledRef = useRef(true);
  const bgVoiceReaderEnabledRef = useRef(false);
  const [voiceReaderEnabled, setVoiceReaderEnabled] = useState(true);
  const [bgVoiceReaderEnabled, setBgVoiceReaderEnabled] = useState(false);

  // 🔔 Wake-word states — "Hi Anya" detection (Siri-like)
  const [wakeWordActive, setWakeWordActive] = useState(false); // true = Anya just heard "Hi Anya"
  const [commandCountdown, setCommandCountdown] = useState(0); // seconds remaining to speak
  const commandCountdownRef = useRef<NodeJS.Timeout | null>(null);

  // Chat Fallback & Debug States
  const [chatInputText, setChatInputText] = useState('');
  const [currentDecibel, setCurrentDecibel] = useState(-160);
  const [bgProgressStep, setBgProgressStep] = useState(0);

  const [backgroundLogs, setBackgroundLogs] = useState<
    { message: string; timestamp: string }[]
  >([]);
  const [isConsoleVisible, setIsConsoleVisible] = useState(false);

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('anya-background-log', (log: any) => {
      setBackgroundLogs(prev => [...prev, log].slice(-100));
    });
    return () => sub.remove();
  }, []);

  // Clear stale "initiating search" pill when no logs arrive
  useEffect(() => {
    if (!backgroundTaskStatus && backgroundLogs.length === 0) return;
    const timer = setTimeout(() => {
      console.log('[Home] Background task timed out locally due to inactivity.');
      backgroundTaskActiveRef.current = false;
      setBackgroundTaskStatus(null);
    }, 120_000);
    return () => clearTimeout(timer);
  }, [backgroundTaskStatus, backgroundLogs]);

  // Active In-App Real-time Push Notification Banner State
  // Notification state removed — real FCM system tray handles all push notifications

  // Contacts & Caller States
  const [contactsList, setContactsList] = useState<Contact[]>([
    { id: '1', name: 'Rahul', phone: '9068509220' },
    { id: '2', name: 'Pawan Bisht', phone: '9068509220' },
    { id: '3', name: 'Nikita', phone: '9997123456' },
    { id: '4', name: 'Papa', phone: '9876543210' },
  ]);
  const [isDirectoryVisible, setIsDirectoryVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCall, setActiveCall] = useState<Contact | null>(null);

  const appStateRef = useRef(AppState.currentState);
  const activeCallRef = useRef<Contact | null>(null);

  // Sync activeCallRef to activeCall state
  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  // AppState change listener to close call visualizer overlay when returning from system dialer
  useEffect(() => {
    const handleAppStateChange = (nextAppState: any) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        console.log(
          '[Anya Call] App returned to foreground. Dismissing call overlay.',
        );
        if (activeCallRef.current) {
          setActiveCall(null);
        }
      }
      appStateRef.current = nextAppState;
    };

    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange,
    );
    return () => {
      subscription.remove();
    };
  }, []);

  // Add Contact Form States
  const [isAddingContact, setIsAddingContact] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');

  // Load custom voice settings — prioritises saved user preference, then Google UK Female
  const loadTtsSettings = useCallback(async () => {
    try {
      // Wait for TTS engine to be ready before configuring it
      await Tts.getInitStatus();

      Tts.setDefaultRate(0.5); // slightly slower = clearer female cadence
      Tts.setDefaultPitch(1.0); // natural, flat pitch — no artificial lift

      // Persist rate/pitch so ALL other TTS callers (useAnyaService, background tasks)
      // read the exact same values instead of using stale hardcoded defaults.
      await AsyncStorage.setItem('@anya_tts_rate', '0.5');
      await AsyncStorage.setItem('@anya_tts_pitch', '1.0');

      // ✅ Priority 1 — User's saved voice from Anya AI Settings
      const savedVoiceId = await AsyncStorage.getItem('@anya_selected_voice');
      if (savedVoiceId) {
        console.log('[TTS] ✅ Restoring saved voice preference:', savedVoiceId);
        await Tts.setDefaultVoice(savedVoiceId);
        return;
      }

      const voices = await Tts.voices();
      console.log('[TTS] Available voices:', voices.map(v => v.id).join(', '));

      // Priority 1 — Google UK English Female (exact match)
      const googleUKFemale = voices.find(
        v =>
          v.id === 'en-gb-x-gba-network' ||
          v.id === 'en-gb-x-gbb-network' ||
          v.id === 'en-gb-x-gbc-network' ||
          v.id.toLowerCase().includes('en-gb') ||
          v.id.toLowerCase().includes('google uk english female') ||
          (v.language?.toLowerCase().includes('en-gb') &&
            ((v as any).gender === 'female' ||
              v.id.toLowerCase().includes('female'))),
      );

      if (googleUKFemale) {
        console.log(
          '[TTS] ✅ Google UK English Female voice found:',
          googleUKFemale.id,
        );
        await Tts.setDefaultVoice(googleUKFemale.id);
        return;
      }

      // Priority 2 — Any Google network female voice
      const googleNetworkFemale = voices.find(
        v =>
          v.id.includes('network') &&
          v.language?.startsWith('en') &&
          ((v as any).gender === 'female' ||
            v.id.includes('tpf') ||
            v.id.includes('gba') ||
            v.id.includes('gbb')),
      );

      if (googleNetworkFemale) {
        console.log(
          '[TTS] ✅ Google network female voice found:',
          googleNetworkFemale.id,
        );
        await Tts.setDefaultVoice(googleNetworkFemale.id);
        return;
      }

      // Priority 3 — Any en-IN female
      const indianEnglishFemale = voices.find(
        v =>
          v.language?.toLowerCase().replace('_', '-').startsWith('en-in') &&
          ((v as any).gender === 'female' || v.id.includes('female')),
      );

      if (indianEnglishFemale) {
        console.log(
          '[TTS] Using Indian English female:',
          indianEnglishFemale.id,
        );
        await Tts.setDefaultVoice(indianEnglishFemale.id);
        return;
      }

      // Priority 4 — Any English female
      const anyEnglishFemale = voices.find(
        v =>
          v.language?.startsWith('en') &&
          ((v as any).gender === 'female' || v.id.includes('female')),
      );

      if (anyEnglishFemale) {
        console.log(
          '[TTS] Fallback English female voice:',
          anyEnglishFemale.id,
        );
        await Tts.setDefaultVoice(anyEnglishFemale.id);
      } else {
        console.log('[TTS] No female voice found, using system default.');
      }
    } catch (error) {
      console.warn('[TTS] Error loading settings:', error);
    }
  }, []);

  // 📞 Fetch actual device contacts on mount with Android Permissions
  useEffect(() => {
    const requestContactsPermission = async () => {
      if (Platform.OS === 'android') {
        try {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
            {
              title: 'Anya Contacts Access',
              message:
                'Anya needs access to your address book contacts so you can call them using hands-free voice commands!',
              buttonNeutral: 'Ask Me Later',
              buttonNegative: 'Cancel',
              buttonPositive: 'OK',
            },
          );
          if (granted === PermissionsAndroid.RESULTS.GRANTED) {
            console.log('Contacts permission granted. Loading address book...');
            loadDeviceContacts();
          } else {
            console.log(
              'Contacts permission denied. Safe pre-populated mock database remains active.',
            );
          }
        } catch (err: any) {
          if (err?.message?.includes('not attached to an Activity')) {
            console.log(
              '[Contacts] Activity not attached yet, skipping background mount request.',
            );
          } else {
            console.warn('Error requesting contacts permission:', err);
          }
        }
      } else {
        // iOS or non-android platforms
        loadDeviceContacts();
      }
    };

    const loadDeviceContacts = () => {
      try {
        Contacts.getAll()
          .then(deviceContacts => {
            if (deviceContacts && deviceContacts.length > 0) {
              const mapped: Contact[] = deviceContacts
                .map(c => {
                  const number =
                    c.phoneNumbers && c.phoneNumbers.length > 0
                      ? c.phoneNumbers[0].number
                      : '';
                  return {
                    id: c.recordID || Math.random().toString(),
                    name:
                      c.displayName ||
                      `${c.givenName || ''} ${c.familyName || ''}`.trim() ||
                      'No Name',
                    phone: number,
                  };
                })
                .filter(c => c.phone.trim() !== '');

              if (mapped.length > 0) {
                setContactsList(mapped);
                console.log(
                  `Loaded ${mapped.length} real address book contacts into Anya.`,
                );
              }
            }
          })
          .catch(err => {
            console.log(
              'Contacts native module not linked or unavailable. Safe mock fallback active.',
              err,
            );
          });
      } catch (err) {
        console.log(
          'Contacts reading skipped. Fallback mockup is active.',
          err,
        );
      }
    };

    const timer = setTimeout(() => {
      requestContactsPermission();
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  // Synthesize and play AI response using Google Cloud Gemini Kore voice
  const speakWithGeminiKore = useCallback(async (text: string) => {
    if (!text.trim()) return;
    try {
      console.log('[TTS] Fetching premium Gemini Kore synthesis for:', text);
      setIsAnyaSpeaking(true);
      const res = await ChatAPI.synthesizeSpeech(text);
      if (res && res.success && res.audio) {
        console.log('[TTS] Successfully retrieved base64 audio from GCP.');
        setSpeakingAudio(res.audio);
      } else {
        console.warn(
          '[TTS] Synthesis empty or failed, falling back to local TTS...',
          res,
        );
        setIsAnyaSpeaking(true); // Keep true during local TTS trigger
        try {
          Tts.speak(text);
        } catch (e) {
          setIsAnyaSpeaking(false);
        }
      }
    } catch (err) {
      console.warn(
        '[TTS] GCP Synthesis API error, falling back to local TTS:',
        err,
      );
      setIsAnyaSpeaking(true); // Keep true during local TTS trigger
      try {
        Tts.speak(text);
      } catch (e) {
        setIsAnyaSpeaking(false);
      }
    }
  }, []);

  useEffect(() => {
    isAnyaSpeakingRef.current = isAnyaSpeaking;
  }, [isAnyaSpeaking]);

  const stopSpeechOnly = useCallback(() => {
    try {
      Tts.stop();
    } catch (_) {}
    setSpeakingAudio(null);
    setIsAnyaSpeaking(false);
  }, []);

  const minimizeResponseCard = useCallback(() => {
    skipVoiceRef.current = true;
    stopSpeechOnly();
    setIsResponseExpanded(false);
  }, [stopSpeechOnly]);

  const expandResponseCard = useCallback(() => {
    setIsResponseExpanded(true);
    setIsResponseVisible(true);
  }, []);

  const skipResponseVoice = useCallback(() => {
    skipVoiceRef.current = true;
    if (thinkingTimeoutRef.current) {
      clearTimeout(thinkingTimeoutRef.current);
      thinkingTimeoutRef.current = null;
    }
    setIsAnyaThinking(false);
    setIsProcessing(false);
    stopSpeechOnly();
    setIsResponseVisible(false);
    // Never cancel background workers — they keep running on the server
    if (!backgroundTaskActiveRef.current) {
      anyaChat.sendCancel();
    }
  }, [stopSpeechOnly]);

  const loadVoiceReaderPrefs = useCallback(async () => {
    try {
      const voice = await AsyncStorage.getItem('@anya_voice_reader_enabled');
      const bg = await AsyncStorage.getItem('@anya_bg_voice_reader_enabled');
      const voiceOn = voice === null ? true : voice === 'true';
      const bgOn = bg === null ? false : bg === 'true';
      voiceReaderEnabledRef.current = voiceOn;
      bgVoiceReaderEnabledRef.current = bgOn;
      setVoiceReaderEnabled(voiceOn);
      setBgVoiceReaderEnabled(bgOn);
    } catch (e) {
      console.warn('[Home] Failed to load voice reader prefs:', e);
    }
  }, []);

  const shouldSpeakResponse = useCallback((isBackground: boolean) => {
    if (skipVoiceRef.current) return false;
    return isBackground
      ? bgVoiceReaderEnabledRef.current
      : voiceReaderEnabledRef.current;
  }, []);

  const toggleVoiceReader = useCallback(
    async (forBackground?: boolean) => {
      const isBg =
        forBackground ??
        (backgroundTaskActiveRef.current || !!backgroundTaskStatus);
      if (isBg) {
        const next = !bgVoiceReaderEnabledRef.current;
        bgVoiceReaderEnabledRef.current = next;
        setBgVoiceReaderEnabled(next);
        await AsyncStorage.setItem('@anya_bg_voice_reader_enabled', String(next));
        if (!next) stopSpeechOnly();
      } else {
        const next = !voiceReaderEnabledRef.current;
        voiceReaderEnabledRef.current = next;
        setVoiceReaderEnabled(next);
        await AsyncStorage.setItem('@anya_voice_reader_enabled', String(next));
        if (!next) stopSpeechOnly();
      }
    },
    [backgroundTaskStatus, stopSpeechOnly],
  );

  // Reload TTS + voice reader prefs whenever screen is focused
  useEffect(() => {
    loadVoiceReaderPrefs();
    if (!navigation) return;
    const unsubscribe = navigation.addListener('focus', () => {
      console.log('[Home] Screen focused, reloading TTS settings...');
      loadTtsSettings();
      loadVoiceReaderPrefs();
    });
    return unsubscribe;
  }, [navigation, loadTtsSettings, loadVoiceReaderPrefs]);

  const handleAudioPlaybackStateChange = useCallback(
    (state: 'speaking' | 'finished' | 'error') => {
      if (state === 'speaking') {
        setIsAnyaSpeaking(true);
      } else if (state === 'finished' || state === 'error') {
        stopSpeechOnly();
      }
    },
    [stopSpeechOnly],
  );

  // 🔌 Connect WebSocket + Init TTS on mount
  useEffect(() => {
    // Load custom voice settings
    loadTtsSettings();

    // Setup TTS listeners
    try {
      Tts.addEventListener('tts-start', () => setIsAnyaSpeaking(true));
      Tts.addEventListener('tts-finish', () => setIsAnyaSpeaking(false));
      Tts.addEventListener('tts-error', () => setIsAnyaSpeaking(false));
    } catch (e) {
      console.warn('[TTS] init error:', e);
    }

    // Setup WebSocket callbacks
    anyaChat.setCallbacks({
      onConnected: sid => {
        console.log('[Home] WS connected, session:', sid);
        setWsConnected(true);
      },
      onDisconnected: () => {
        console.warn('[Home] WS disconnected — will auto-reconnect');
        setWsConnected(false);
      },
      onChunk: text => {
        if (isNewResponseRef.current) {
          // First chunk of a new response — reset the display cleanly
          fullResponseRef.current = '';
          isNewResponseRef.current = false;
          // Stop any previous speech immediately to start a fresh sentence sequence
          try {
            Tts.stop();
          } catch (_) {}
        }
        fullResponseRef.current += text;
        setAiResponse(fullResponseRef.current);
        setIsResponseVisible(true);
        setIsResponseExpanded(true);

        sentenceBufferRef.current += text;
        if (!shouldSpeakResponse(backgroundTaskActiveRef.current)) {
          return;
        }

        // Queue sentence fragments dynamically for zero latency voice feedback!
        const sentenceBoundaryRegex = /([^.!?\n]+[.!?\n]+)/g;
        let match;
        const sentencesToSpeak: string[] = [];

        let buffer = sentenceBufferRef.current;
        let lastIndex = 0;
        while ((match = sentenceBoundaryRegex.exec(buffer)) !== null) {
          sentencesToSpeak.push(match[1].trim());
          lastIndex = sentenceBoundaryRegex.lastIndex;
        }

        if (sentencesToSpeak.length > 0) {
          sentenceBufferRef.current = buffer.substring(lastIndex);
          for (const sentence of sentencesToSpeak) {
            if (sentence.trim().length > 1) {
              console.log(
                '[TTS Streaming] Speaking sentence segment:',
                sentence,
              );
              setIsAnyaSpeaking(true);
              try {
                Tts.speak(sentence.trim());
              } catch (e) {
                console.warn('[TTS] Error speaking segment:', e);
              }
            }
          }
        }
      },
      onDone: (fullText, latency) => {
        console.log(
          `[Home] Response done in ${latency}ms, text length: ${fullText?.length}`,
        );
        if (thinkingTimeoutRef.current) {
          clearTimeout(thinkingTimeoutRef.current);
          thinkingTimeoutRef.current = null;
        }
        setIsAnyaThinking(false);
        setIsProcessing(false);
        if (!backgroundTaskActiveRef.current) {
          setBackgroundTaskStatus(null);
        }

        // Speak the remaining text segment in the buffer (unless user skipped or bg task ack)
        const remainingText = sentenceBufferRef.current.trim();
        if (
          remainingText.length > 0 &&
          shouldSpeakResponse(backgroundTaskActiveRef.current)
        ) {
          console.log(
            '[TTS Streaming] Speaking final remainder segment:',
            remainingText,
          );
          setIsAnyaSpeaking(true);
          try {
            Tts.speak(remainingText);
          } catch (e) {
            console.warn('[TTS] Error speaking final remainder:', e);
          }
        }

        // ✅ CRITICAL: Sync final response text in state
        const finalText = fullText || fullResponseRef.current;
        setAiResponse(finalText);

        // Reset buffers
        fullResponseRef.current = '';
        sentenceBufferRef.current = '';
        isNewResponseRef.current = true;
      },
      onError: msg => {
        console.warn('[Home] WS error:', msg);
        if (thinkingTimeoutRef.current) {
          clearTimeout(thinkingTimeoutRef.current);
          thinkingTimeoutRef.current = null;
        }
        setIsAnyaThinking(false);
        setIsProcessing(false);
        if (!backgroundTaskActiveRef.current) {
          setBackgroundTaskStatus(null);
        }
      },
      onBackgroundResult: async text => {
        backgroundTaskActiveRef.current = false;
        setAiResponse(prev => (prev ? prev + '\n\n' + text : text));
        setIsResponseVisible(true);
        setIsResponseExpanded(true);
        setBackgroundTaskStatus(null);
        backgroundTaskActiveRef.current = false;
        setBackgroundLogs([]);

        const { AnyaService } = NativeModules;
        if (AnyaService && typeof AnyaService.showNotification === 'function') {
          AnyaService.showNotification(
            'Anya — Job Search Complete',
            text,
            null,
            null,
          );
        }

        if (!shouldSpeakResponse(true)) {
          return;
        }

        setIsAnyaSpeaking(true);
        try {
          await loadTtsSettings();
          Tts.speak(text);
        } catch (e) {
          setIsAnyaSpeaking(false);
          console.warn('[TTS] Background speech fallback failed:', e);
        }
      },
      onNotification: (title, body, _data) => {
        console.log('[Home] FCM nudge forwarded to system tray:', title, body);
        const { AnyaService } = NativeModules;
        if (AnyaService && typeof AnyaService.showNotification === 'function') {
          AnyaService.showNotification(title, body, null, null);
        }
      },
    });

    anyaChat.connect();

    return () => {
      try {
        Tts.stop();
      } catch (e) {}
      setSpeakingAudio(null);
      setIsAnyaSpeaking(false);
    };
  }, [loadTtsSettings, shouldSpeakResponse]);

  const syncContactsManually = async () => {
    try {
      console.log('🔄 Manually initiating address book synchronization...');
      let hasPerm = false;
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_CONTACTS,
          {
            title: 'Anya Contacts Access',
            message:
              'Anya needs access to your address book contacts so you can call them using hands-free voice commands!',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );
        hasPerm = granted === PermissionsAndroid.RESULTS.GRANTED;
      } else {
        hasPerm = true;
      }

      if (!hasPerm) {
        Alert.alert(
          'Permission Denied',
          'Anya was denied access to your contacts. Please enable contacts permissions in system Settings.',
        );
        return;
      }

      Contacts.getAll()
        .then(deviceContacts => {
          if (deviceContacts && deviceContacts.length > 0) {
            const mapped: Contact[] = deviceContacts
              .map(c => {
                const number =
                  c.phoneNumbers && c.phoneNumbers.length > 0
                    ? c.phoneNumbers[0].number
                    : '';
                return {
                  id: c.recordID || Math.random().toString(),
                  name:
                    c.displayName ||
                    `${c.givenName || ''} ${c.familyName || ''}`.trim() ||
                    'No Name',
                  phone: number,
                };
              })
              .filter(c => c.phone.trim() !== '');

            if (mapped.length > 0) {
              setContactsList(mapped);
              Alert.alert(
                'Sync Successful',
                `Successfully synced ${mapped.length} real address book contacts into Anya!`,
              );
            } else {
              Alert.alert(
                'Sync Complete',
                'No contacts with valid phone numbers were found in your device address book.',
              );
            }
          } else {
            Alert.alert(
              'No Contacts Found',
              'No address book contacts were found on this device or emulator.',
            );
          }
        })
        .catch(err => {
          console.warn(err);
          Alert.alert(
            'Sync Error',
            'Failed to fetch native contacts. Ensure the library is linked correctly or try again.',
          );
        });
    } catch (error) {
      console.error(error);
      Alert.alert('Sync Failure', 'An error occurred while syncing contacts.');
    }
  };

  // ─── Wake-word handlers (called from micVisualizer) ────────────────────────
  const handleWakeWordDetected = useCallback(() => {
    console.log('🔔 [HomeScreen] Wake word "Hi Anya" detected!');
    setWakeWordActive(true);
    setCommandCountdown(8);

    // Speak the Siri-like alert
    try {
      Tts.stop();
      Tts.speak("Yes? I'm listening.");
    } catch (e) {}

    // Tick countdown every second
    let remaining = 8;
    if (commandCountdownRef.current) clearInterval(commandCountdownRef.current);
    commandCountdownRef.current = setInterval(() => {
      remaining -= 1;
      setCommandCountdown(remaining);
      if (remaining <= 0) {
        if (commandCountdownRef.current)
          clearInterval(commandCountdownRef.current);
        commandCountdownRef.current = null;
        setWakeWordActive(false);
        setCommandCountdown(0);
        console.log(
          '⏱️ [HomeScreen] No command given — back to wake-word mode.',
        );
      }
    }, 1000);
  }, []);

  // Called by micVisualizer when user speaks a real command after wake word
  const handleCommandReceived = useCallback(() => {
    if (commandCountdownRef.current) {
      clearInterval(commandCountdownRef.current);
      commandCountdownRef.current = null;
    }
    setWakeWordActive(false);
    setCommandCountdown(0);
  }, []);

  const handleStart = () => {
    setIsAssistantActive(true);
    setIsProcessing(false);
    setLiveTranscript('');
    // Keep the response card visible while Anya is speaking or a background task is running
    if (!isAnyaSpeakingRef.current && !backgroundTaskActiveRef.current) {
      setAiResponse('');
      setIsResponseVisible(false);
    }
    if (isAnyaSpeakingRef.current) {
      stopSpeechOnly();
    }
    console.log('🎙️ Started Listening');
  };

  const handleStop = (
    duration: number,
    _audioBuffer: number[],
    finalTranscript?: string,
  ) => {
    setIsAssistantActive(false);
    console.log(`🛑 Stopped after ${duration.toFixed(2)} sec`);

    // finalTranscript comes directly from @react-native-voice/voice native Android STT
    const queryText = (finalTranscript ?? '').trim();
    console.log(`🎙️ Auto-submitting speech query: "${queryText}"`);
    if (queryText && !isProcessing) {
      handleSpeech(queryText);
    } else if (!queryText) {
      console.log(
        '⚠️ No speech captured — check microphone & Google Speech Services on device.',
      );
    }
  };

  // Live interim transcript from native Voice partial results
  const handleLiveTranscript = (text: string) => {
    setLiveTranscript(text);
  };

  const handleDecibel = (db: number) => {
    setCurrentDecibel(db);
  };

  // 🗣️ Voice Command Parser — contact commands handled locally, everything else → Anya server
  const handleSpeech = (text: string) => {
    console.log(`💬 SPEECH RECOGNIZED: "${text}"`);
    setLastSpeech(text);
    setLiveTranscript(text);

    // Clear wake-word countdown since user gave a real command
    handleCommandReceived();

    const normalizedText = text.toLowerCase().trim();

    // LOCAL: Phone / contact commands
    if (
      normalizedText.includes('call') ||
      normalizedText.includes('dial') ||
      normalizedText.includes('phone')
    ) {
      let targetName = normalizedText.replace(/call|dial|phone/g, '').trim();

      if (targetName) {
        const matched = contactsList.find(
          c =>
            c.name.toLowerCase().includes(targetName) ||
            targetName.includes(c.name.toLowerCase()),
        );
        if (matched) {
          triggerOutgoingCall(matched);
        } else {
          Alert.alert(
            'Contact Not Found',
            `Anya couldn't find "${targetName}". Add them?`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Add',
                onPress: () => {
                  setNewContactName(
                    targetName.charAt(0).toUpperCase() + targetName.slice(1),
                  );
                  setIsDirectoryVisible(true);
                  setIsAddingContact(true);
                },
              },
            ],
          );
        }
      }
      return;
    }

    const isContactAction =
      (normalizedText.includes('search') || normalizedText.includes('find')) &&
      (normalizedText.includes('contact') ||
        normalizedText.includes('directory') ||
        normalizedText.includes('phone') ||
        normalizedText.includes('number'));

    if (isContactAction) {
      const q = normalizedText
        .replace(
          /search|contacts|contact|for|find|in|directory|phone|number/g,
          '',
        )
        .trim();
      setSearchQuery(q);
      setIsDirectoryVisible(true);
      return;
    }

    if (
      normalizedText.includes('contacts') ||
      normalizedText.includes('directory')
    ) {
      setIsDirectoryVisible(true);
      return;
    }

    // REMOTE: Send everything else to Anya AI via WebSocket
    skipVoiceRef.current = false;
    setIsProcessing(true);
    setIsAnyaThinking(true);
    setAiResponse('');
    setIsResponseVisible(false);
    setIsResponseExpanded(true);
    isNewResponseRef.current = true; // next onChunk starts a fresh response
    fullResponseRef.current = '';
    sentenceBufferRef.current = '';
    try {
      Tts.stop();
    } catch (e) {}
    setSpeakingAudio(null);
    setIsAnyaSpeaking(false);

    // AUTOMATIC BACKGROUND TASK DETECTION
    const isSearchTask =
      normalizedText.includes('search') ||
      normalizedText.includes('web') ||
      normalizedText.includes('google') ||
      normalizedText.includes('find online') ||
      normalizedText.includes('lookup') ||
      normalizedText.includes('crawl') ||
      normalizedText.includes('job') ||
      normalizedText.includes('freelance') ||
      normalizedText.includes('lead');

    if (isSearchTask) {
      backgroundTaskActiveRef.current = true;
      setBackgroundTaskStatus('Anya is initiating search...');
    }

    // Dynamic Focus OS Context Injection
    const sendAnyaMessageWithContext = async () => {
      let contextPrefix = '';
      try {
        const lvl = (await AsyncStorage.getItem('@focus_level')) || '1';
        const xp = (await AsyncStorage.getItem('@focus_xp')) || '0';
        const protein =
          (await AsyncStorage.getItem('@focus_protein_hit')) || 'no';
        const wkt =
          (await AsyncStorage.getItem('@focus_workout_done')) || 'false';
        const water =
          (await AsyncStorage.getItem('@focus_water_glasses')) || '0';
        const skip =
          (await AsyncStorage.getItem('@focus_skipped_meal')) || 'false';
        const dsa = (await AsyncStorage.getItem('@focus_dsa_done')) || 'false';

        contextPrefix = `[System Context: Pawan's Focus OS Stats today - Level: ${lvl}, XP: ${xp}, Protein met: ${protein}, Workout complete: ${wkt}, Water: ${water} glasses, Skipped meal: ${skip}, DSA Solved: ${dsa}. (Use these stats ONLY if the user specifically asks about their fitness, daily progress, level, XP, workout, or status. Otherwise, ignore them and do NOT mention them. NEVER hijack general or capabilities queries to talk about these stats.)]\n\n`;
      } catch (err) {
        console.warn('Failed to load focus context for message:', err);
      }

      const finalQuery = contextPrefix + text;
      const sent = anyaChat.sendMessage(finalQuery);
      if (!sent) {
        setIsProcessing(false);
        setIsAnyaThinking(false);
        setBackgroundTaskStatus(null);
      } else {
        // ── 30-second safety timeout ──────────────────────────────────────────
        if (thinkingTimeoutRef.current)
          clearTimeout(thinkingTimeoutRef.current);
        thinkingTimeoutRef.current = setTimeout(() => {
          console.warn('[Home] Response timeout');
          setIsAnyaThinking(false);
          setIsProcessing(false);
          thinkingTimeoutRef.current = null;
          if (backgroundTaskActiveRef.current) {
            setBackgroundTaskStatus('Background task still running…');
            return;
          }
          setBackgroundTaskStatus(null);
          setAiResponse(
            '⚠️ Anya took too long to respond. Check your Wi-Fi connection and make sure the backend server is running.',
          );
          setIsResponseVisible(true);
        }, 30_000);
      }
    };

    sendAnyaMessageWithContext();
  };

  // Outgoing Call Simulation
  const triggerOutgoingCall = (contact: Contact) => {
    setActiveCall(contact);

    // Smoothly initiate actual system cellular phone dialer or direct call
    setTimeout(async () => {
      try {
        if (Platform.OS === 'android') {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.CALL_PHONE,
            {
              title: 'Phone Call Permission',
              message:
                'Anya needs permission to place direct, hands-free phone calls for you.',
              buttonNeutral: 'Ask Me Later',
              buttonNegative: 'Cancel',
              buttonPositive: 'OK',
            },
          );
          if (granted === PermissionsAndroid.RESULTS.GRANTED) {
            console.log(
              '[Call OS] Permission granted, making direct call via AnyaService bridge.',
            );
            const { AnyaService } = NativeModules;
            if (
              AnyaService &&
              typeof AnyaService.makeDirectCall === 'function'
            ) {
              AnyaService.makeDirectCall(contact.phone);
              return;
            }
          }
        }

        // Fallback for iOS or if permission is denied: open dialer with number prefilled
        const dialUrl = `tel:${contact.phone}`;
        const supported = await Linking.canOpenURL(dialUrl);
        if (supported) {
          Linking.openURL(dialUrl);
        } else {
          Alert.alert(
            'System Error',
            'Phone dialing is not supported on this physical device.',
          );
        }
      } catch (err) {
        console.error('Error triggering phone call:', err);
      }
    }, 1800);
  };

  const handleAddContactSubmit = async () => {
    if (!newContactName.trim() || !newContactPhone.trim()) {
      Alert.alert(
        'Validation Error',
        'Please fill in both Name and Phone number.',
      );
      return;
    }

    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.WRITE_CONTACTS,
          {
            title: 'Contacts Write Permission',
            message:
              'Anya needs permission to save this contact directly to your actual Android address book.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert(
            'Permission Denied',
            'Anya cannot save the contact to your device without permission.',
          );
          return;
        }
      }

      const nativeContact: any = {
        givenName: newContactName.trim(),
        phoneNumbers: [
          {
            label: 'mobile',
            number: newContactPhone.trim(),
          },
        ],
      };

      const savedContact = await Contacts.addContact(nativeContact);

      const addedContact: Contact = {
        id: savedContact.recordID || Date.now().toString(),
        name: newContactName.trim(),
        phone: newContactPhone.trim(),
      };

      // Prepend to list so it appears exactly at the top!
      setContactsList(prev => [addedContact, ...prev]);
      setNewContactName('');
      setNewContactPhone('');
      setIsAddingContact(false);
      Alert.alert(
        'Success',
        `${addedContact.name} has been added to your device address book!`,
      );
    } catch (error) {
      console.error('Error adding contact natively:', error);
      Alert.alert(
        'Error',
        'Failed to write contact to your device. Please try again.',
      );
    }
  };

  // Delete Contact logic
  const handleDeleteContact = (id: string, name: string) => {
    Alert.alert(
      'Remove Contact',
      `Are you sure you want to delete ${name} from your list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setContactsList(prev => prev.filter(c => c.id !== id));
          },
        },
      ],
    );
  };

  // Filtered contacts based on search query
  const filteredContacts = contactsList.filter(
    c =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery),
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={backgroundColor}
      />

      {/* Outgoing Call Full-Screen Visualizer Overlay */}
      {activeCall && (
        <View
          style={[
            styles.callingOverlay,
            { backgroundColor: isDarkMode ? '#050505e0' : '#fffffffa' },
          ]}
        >
          <View style={styles.callingHeader}>
            <MaterialCommunityIcon
              name="shield-check-outline"
              size={18}
              color="#10b981"
            />
            <Text style={[styles.callingHeaderTitle, { color: textColor }]}>
              Anya Secure Dialing
            </Text>
          </View>

          <View style={styles.callingCenter}>
            <View style={styles.callingAvatarRing}>
              <View style={styles.callingAvatarPill}>
                <Text style={styles.callingAvatarLetter}>
                  {activeCall.name.charAt(0).toUpperCase()}
                </Text>
              </View>
            </View>
            <Text style={[styles.callingNameText, { color: textColor }]}>
              {activeCall.name}
            </Text>
            <Text style={[styles.callingPhoneText, { color: subtextColor }]}>
              {activeCall.phone}
            </Text>

            <View style={styles.callingStatusRow}>
              <MaterialCommunityIcon
                name="loading"
                size={18}
                color="#3b82f6"
                style={styles.spinningIcon}
              />
              <Text style={styles.callingStatusText}>
                Connecting cellular link...
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.callingEndBtn}
            onPress={() => setActiveCall(null)}
          >
            <MaterialCommunityIcon
              name="phone-hangup"
              size={28}
              color="#ffffff"
            />
            <Text style={styles.callingEndText}>Cancel Call</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Main Top Header Bar */}
      <View style={styles.topBar}>
        <View style={styles.headerLeft}>
          <MaterialCommunityIcon
            name={isAnyaSpeaking ? 'volume-high' : 'robot-outline'}
            size={26}
            color={isAnyaSpeaking ? '#8b5cf6' : textColor}
          />
          <Text
            style={[
              styles.statusText,
              {
                color: isAnyaSpeaking
                  ? '#8b5cf6'
                  : isAnyaThinking
                  ? '#f59e0b'
                  : isProcessing
                  ? '#3b82f6'
                  : isAssistantActive
                  ? '#10b981'
                  : wsConnected
                  ? isDarkMode
                    ? '#9ca3af'
                    : '#6b7280'
                  : '#ef4444',
              },
            ]}
          >
            {isAnyaSpeaking
              ? 'Anya is speaking...'
              : isAnyaThinking
              ? 'Anya is thinking...'
              : isProcessing
              ? 'Processing...'
              : isAssistantActive
              ? `Listening... (${Math.round(currentDecibel)}dB)`
              : wsConnected
              ? 'Anya is ready'
              : 'Connecting...'}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity
            style={[
              styles.directoryShortcutBtn,
              {
                backgroundColor: cardBgColor,
                borderColor,
                paddingHorizontal: 10,
              },
            ]}
            onPress={() => toggleVoiceReader(!!backgroundTaskStatus)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialCommunityIcon
              name={
                (backgroundTaskStatus ? bgVoiceReaderEnabled : voiceReaderEnabled)
                  ? 'volume-high'
                  : 'volume-off'
              }
              size={20}
              color={
                (backgroundTaskStatus ? bgVoiceReaderEnabled : voiceReaderEnabled)
                  ? '#8b5cf6'
                  : subtextColor
              }
            />
          </TouchableOpacity>

          {/* Directory Shortcut Trigger Button */}
          <TouchableOpacity
            style={[
              styles.directoryShortcutBtn,
              { backgroundColor: cardBgColor, borderColor },
            ]}
            onPress={() => setIsDirectoryVisible(!isDirectoryVisible)}
          >
          <MaterialCommunityIcon
            name="contacts-outline"
            size={20}
            color="#3b82f6"
          />
          <Text style={[styles.directoryShortcutText, { color: textColor }]}>
            Contacts
          </Text>
        </TouchableOpacity>
        </View>
      </View>

      {(backgroundLogs.length > 0 ||
        (backgroundTaskStatus && (isAnyaThinking || isProcessing))) && (
        <TouchableOpacity
          onPress={() => setIsConsoleVisible(true)}
          style={[styles.backgroundTaskPill, { flexDirection: 'row', alignItems: 'center' }]}
          activeOpacity={0.8}
        >
          <ActivityIndicator
            size="small"
            color="#3b82f6"
            style={{ marginRight: 6 }}
          />
          <Text style={styles.backgroundTaskText} numberOfLines={1}>
            ⚙️{' '}
            {backgroundLogs.length > 0
              ? backgroundLogs[backgroundLogs.length - 1].message
              : backgroundTaskStatus}
          </Text>
          <TouchableOpacity
            onPress={() => {
              setBackgroundLogs([]);
              if (!backgroundTaskActiveRef.current) {
                setBackgroundTaskStatus(null);
              }
            }}
            style={{ marginLeft: 8, paddingHorizontal: 4 }}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcon
              name="close-circle"
              size={16}
              color="#ef4444"
            />
          </TouchableOpacity>
        </TouchableOpacity>
      )}

      {/* Center visualizer - Starry Orb Constellation */}
      <View style={styles.centerOrbContainer}>
        <WebViewVoiceAssistant
          onStartListening={handleStart}
          onStopListening={handleStop}
          onDecibelChange={handleDecibel}
          onSpeechResult={text => {
            console.log('🎙️ Anya hearing: "' + text + '"');
            setLiveTranscript(text);
          }}
          isProcessing={isProcessing}
          speakingAudio={speakingAudio}
          onAudioPlaybackStateChange={handleAudioPlaybackStateChange}
          isAnyaSpeaking={isAnyaSpeaking}
          onWakeWordDetected={handleWakeWordDetected}
          wakeWordActive={wakeWordActive}
        />

        {/* 🔔 Wake-word alert — Siri-like overlay pill */}
        {wakeWordActive && (
          <View style={styles.wakeWordPill}>
            <MaterialCommunityIcon
              name="microphone-outline"
              size={18}
              color="#ffffff"
            />
            <Text style={styles.wakeWordPillText}>Listening for command…</Text>
            <View style={styles.wakeWordCountdownBadge}>
              <Text style={styles.wakeWordCountdownText}>
                {commandCountdown}s
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Floating sliding Contacts Directory view */}
      {isDirectoryVisible && (
        <View
          style={[
            styles.directoryDrawer,
            { backgroundColor: cardBgColor, borderTopColor: borderColor },
          ]}
        >
          <View style={styles.directoryDrawerHeader}>
            <View>
              <Text style={[styles.drawerTitle, { color: textColor }]}>
                Anya Directory
              </Text>
              <Text style={[styles.drawerSubtitle, { color: subtextColor }]}>
                Say "Call [Name]" to dial hands-free!
              </Text>
            </View>
            <View style={styles.drawerActionsRow}>
              <TouchableOpacity
                style={[
                  styles.drawerAddBtn,
                  { backgroundColor: 'rgba(16, 185, 129, 0.15)' },
                ]}
                onPress={syncContactsManually}
              >
                <MaterialCommunityIcon name="sync" size={16} color="#10b981" />
                <Text style={[styles.drawerAddText, { color: '#10b981' }]}>
                  Sync
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.drawerAddBtn,
                  { backgroundColor: 'rgba(59, 130, 246, 0.15)' },
                ]}
                onPress={() => setIsAddingContact(!isAddingContact)}
              >
                <MaterialCommunityIcon
                  name={isAddingContact ? 'chevron-down' : 'plus'}
                  size={18}
                  color="#3b82f6"
                />
                <Text style={styles.drawerAddText}>
                  {isAddingContact ? 'Cancel' : 'Add'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.drawerCloseBtn}
                onPress={() => {
                  setIsDirectoryVisible(false);
                  setIsAddingContact(false);
                }}
              >
                <MaterialCommunityIcon
                  name="close"
                  size={20}
                  color={textColor}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Add Contact Form Expandable */}
          {isAddingContact && (
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
              style={[styles.addFormBlock, { borderColor }]}
            >
              <Text style={[styles.formTitleText, { color: textColor }]}>
                Add New Contact
              </Text>
              <View style={styles.inputsInlineRow}>
                <TextInput
                  style={[
                    styles.formInputBox,
                    {
                      color: textColor,
                      borderColor,
                      backgroundColor: inputBgColor,
                    },
                  ]}
                  placeholder="Name (e.g. Rahul)"
                  placeholderTextColor={subtextColor}
                  value={newContactName}
                  onChangeText={setNewContactName}
                />
                <TextInput
                  style={[
                    styles.formInputBox,
                    {
                      color: textColor,
                      borderColor,
                      backgroundColor: inputBgColor,
                    },
                  ]}
                  placeholder="Phone"
                  placeholderTextColor={subtextColor}
                  value={newContactPhone}
                  onChangeText={setNewContactPhone}
                  keyboardType="phone-pad"
                />
                <TouchableOpacity
                  style={styles.submitContactBtn}
                  onPress={handleAddContactSubmit}
                >
                  <MaterialCommunityIcon
                    name="check"
                    size={20}
                    color="#ffffff"
                  />
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          )}

          {/* Search Contacts bar */}
          <View
            style={[
              styles.searchBarContainer,
              { backgroundColor: inputBgColor, borderColor },
            ]}
          >
            <MaterialCommunityIcon
              name="magnify"
              size={18}
              color={subtextColor}
            />
            <TextInput
              style={[styles.searchInputText, { color: textColor }]}
              placeholder="Search contacts by name or phone..."
              placeholderTextColor={subtextColor}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <MaterialCommunityIcon
                  name="close-circle"
                  size={16}
                  color={subtextColor}
                />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Contacts List */}
          <FlatList
            data={filteredContacts}
            keyExtractor={item => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.contactsListContainer}
            renderItem={({ item }) => (
              <View
                style={[
                  styles.contactCardItem,
                  { borderBottomColor: borderColor },
                ]}
              >
                <View style={styles.contactItemLeft}>
                  <View style={styles.contactLetterCircle}>
                    <Text style={styles.contactLetterText}>
                      {item.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View>
                    <Text
                      style={[styles.contactItemName, { color: textColor }]}
                    >
                      {item.name}
                    </Text>
                    <Text
                      style={[styles.contactItemPhone, { color: subtextColor }]}
                    >
                      {item.phone}
                    </Text>
                  </View>
                </View>

                <View style={styles.contactItemRight}>
                  {/* Dial Action */}
                  <TouchableOpacity
                    style={styles.contactActionCallBtn}
                    onPress={() => triggerOutgoingCall(item)}
                  >
                    <MaterialCommunityIcon
                      name="phone"
                      size={18}
                      color="#ffffff"
                    />
                  </TouchableOpacity>
                  {/* Delete Action */}
                  <TouchableOpacity
                    style={styles.contactActionDeleteBtn}
                    onPress={() => handleDeleteContact(item.id, item.name)}
                  >
                    <MaterialCommunityIcon
                      name="trash-can-outline"
                      size={18}
                      color="#ef4444"
                    />
                  </TouchableOpacity>
                </View>
              </View>
            )}
            ListEmptyComponent={
              <Text
                style={[styles.emptyDirectoryText, { color: subtextColor }]}
              >
                No contacts found matching search.
              </Text>
            }
          />
        </View>
      )}

      {/* Floating sliding Background Task Console Drawer */}
      {isConsoleVisible && (
        <View
          style={[
            styles.directoryDrawer,
            { backgroundColor: '#0d0e15', borderTopColor: '#2563eb' },
          ]}
        >
          <View style={styles.directoryDrawerHeader}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981', flexShrink: 0 }} />
                <Text style={[styles.drawerTitle, { color: '#ffffff' }]} numberOfLines={1}>
                  Anya Background Stream
                </Text>
              </View>
              <Text style={[styles.drawerSubtitle, { color: '#9ca3af' }]} numberOfLines={1}>
                Live rolling log output from active background agents
              </Text>
            </View>
            <View style={styles.drawerActionsRow}>
              <TouchableOpacity
                style={[
                  styles.drawerAddBtn,
                  { backgroundColor: 'rgba(239, 68, 68, 0.15)' },
                ]}
                onPress={() => setBackgroundLogs([])}
              >
                <MaterialCommunityIcon name="delete" size={16} color="#ef4444" />
                <Text style={[styles.drawerAddText, { color: '#ef4444' }]}>
                  Clear
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.drawerAddBtn,
                  { backgroundColor: 'rgba(59, 130, 246, 0.15)' },
                ]}
                onPress={() => setIsConsoleVisible(false)}
              >
                <MaterialCommunityIcon name="close" size={16} color="#3b82f6" />
                <Text style={[styles.drawerAddText, { color: '#3b82f6' }]}>
                  Close
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            style={{
              flex: 1,
              backgroundColor: '#05060b',
              borderRadius: 12,
              padding: 10,
              borderWidth: 1,
              borderColor: '#1e293b',
            }}
            ref={(ref) => {
              ref?.scrollToEnd({ animated: true });
            }}
            showsVerticalScrollIndicator={true}
          >
            {backgroundLogs.length === 0 ? (
              <Text style={{ color: '#4b5563', fontFamily: 'monospace', fontSize: 12, textAlign: 'center', marginTop: 40 }}>
                No active background logs. Run a search task to see live streams.
              </Text>
            ) : (
              backgroundLogs.map((log, index) => {
                const logTime = new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                return (
                  <View key={index} style={{ marginBottom: 6, flexDirection: 'row', alignItems: 'flex-start' }}>
                    <Text style={{ color: '#3b82f6', fontFamily: 'monospace', fontSize: 11, marginRight: 6 }}>
                      [{logTime}]
                    </Text>
                    <Text style={{ color: '#f3f4f6', fontFamily: 'monospace', fontSize: 11, flex: 1, lineHeight: 16 }}>
                      {log.message}
                    </Text>
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      )}

      {/* Floating response overlay — does NOT shrink the mic visualizer */}
      {(isAnyaThinking || (isResponseVisible && aiResponse)) && !isConsoleVisible && (
        <View style={styles.responseOverlay}>
          {isAnyaThinking && (
            <View
              pointerEvents="auto"
              style={[
                styles.thinkingBar,
                {
                  backgroundColor: isDarkMode
                    ? 'rgba(139,92,246,0.12)'
                    : 'rgba(139,92,246,0.08)',
                  borderColor: 'rgba(139,92,246,0.3)',
                },
              ]}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  flexShrink: 1,
                }}
              >
                <MaterialCommunityIcon name="brain" size={14} color="#8b5cf6" />
                <Text
                  style={[styles.liveTranscriptText, { color: '#8b5cf6' }]}
                  numberOfLines={1}
                >
                  {backgroundTaskStatus
                    ? 'Background task starting…'
                    : 'Anya is thinking...'}
                </Text>
              </View>
              <TouchableOpacity
                id="skip-thinking-btn"
                onPress={skipResponseVoice}
                style={{
                  backgroundColor: 'rgba(139,92,246,0.25)',
                  borderRadius: 10,
                  padding: 4,
                  paddingHorizontal: 10,
                  flexShrink: 0,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MaterialCommunityIcon name="volume-off" size={13} color="#8b5cf6" />
                <Text style={{ color: '#8b5cf6', fontSize: 11, fontWeight: '700' }}>
                  Skip
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {isResponseVisible && aiResponse ? (
            <View
              pointerEvents="auto"
              style={[
                styles.aiResponseCard,
                !isResponseExpanded && styles.aiResponseCardMinimized,
                { backgroundColor: cardBgColor, borderColor },
              ]}
            >
              <View style={styles.aiResponseHeader}>
                <View style={styles.aiResponseHeaderLeft}>
                  <MaterialCommunityIcon
                    name="robot-outline"
                    size={16}
                    color={isAnyaSpeaking ? '#8b5cf6' : '#3b82f6'}
                  />
                  <Text
                    style={[
                      styles.aiResponseLabel,
                      { color: isAnyaSpeaking ? '#8b5cf6' : '#3b82f6' },
                    ]}
                  >
                    {backgroundTaskStatus
                      ? '⚙️ Running in background'
                      : isAnyaSpeaking
                      ? '🔊 Anya is speaking...'
                      : 'Anya'}
                  </Text>
                </View>
                <View
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
                >
                  <TouchableOpacity
                    onPress={() => toggleVoiceReader(!!backgroundTaskStatus)}
                    style={styles.copyBtn}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <MaterialCommunityIcon
                      name={
                        (backgroundTaskStatus
                          ? bgVoiceReaderEnabled
                          : voiceReaderEnabled)
                          ? 'volume-high'
                          : 'volume-off'
                      }
                      size={16}
                      color={
                        (backgroundTaskStatus
                          ? bgVoiceReaderEnabled
                          : voiceReaderEnabled)
                          ? '#8b5cf6'
                          : subtextColor
                      }
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      Clipboard.setString(aiResponse);
                      Alert.alert('Copied!', 'Response copied to clipboard.');
                    }}
                    style={styles.copyBtn}
                  >
                    <MaterialCommunityIcon
                      name="content-copy"
                      size={15}
                      color={subtextColor}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={
                      isResponseExpanded
                        ? minimizeResponseCard
                        : expandResponseCard
                    }
                    style={styles.closeBtn}
                    hitSlop={{ top: 14, bottom: 14, left: 8, right: 8 }}
                  >
                    <MaterialCommunityIcon
                      name={isResponseExpanded ? 'chevron-down' : 'chevron-up'}
                      size={22}
                      color={subtextColor}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={skipResponseVoice}
                    style={styles.closeBtn}
                    hitSlop={{ top: 14, bottom: 14, left: 8, right: 14 }}
                  >
                    <MaterialCommunityIcon
                      name="close"
                      size={20}
                      color={subtextColor}
                    />
                  </TouchableOpacity>
                </View>
              </View>
              {isResponseExpanded ? (
                <ScrollView
                  style={styles.aiResponseScroll}
                  showsVerticalScrollIndicator={false}
                  nestedScrollEnabled
                >
                  <Text style={[styles.aiResponseText, { color: textColor }]}>
                    {aiResponse}
                  </Text>
                </ScrollView>
              ) : (
                <Text
                  style={[styles.aiResponsePreview, { color: subtextColor }]}
                  numberOfLines={1}
                >
                  {aiResponse}
                </Text>
              )}
            </View>
          ) : null}
        </View>
      )}

      {/* ─── Bottom Section: Live Transcript + Chat Input ─── */}
      <View style={styles.chatPreviewContainer}>
        {/* Live transcript — what user is currently saying */}
        {isAssistantActive && liveTranscript ? (
          <View
            style={[
              styles.liveTranscriptBar,
              {
                backgroundColor: isDarkMode
                  ? 'rgba(59,130,246,0.12)'
                  : 'rgba(59,130,246,0.08)',
                borderColor: 'rgba(59,130,246,0.3)',
              },
            ]}
          >
            <MaterialCommunityIcon
              name="microphone"
              size={14}
              color="#3b82f6"
            />
            <Text
              style={[
                styles.liveTranscriptText,
                { color: isDarkMode ? '#93c5fd' : '#2563eb' },
              ]}
              numberOfLines={2}
            >
              {liveTranscript}
            </Text>
          </View>
        ) : null}

        {/* Quick Suggestion Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ paddingHorizontal: 12, marginBottom: 6 }}
          contentContainerStyle={{ gap: 8, alignItems: 'center' }}
        >
          {[
            { label: '⚛️ React jobs', prompt: 'Search for React developer jobs and apply' },
            { label: '🟩 Node.js jobs', prompt: 'Search for Node.js developer jobs and apply' },
            { label: '🧑‍💻 Full Stack jobs', prompt: 'Search for Full Stack developer jobs and apply' },
            { label: '📅 My schedule today', prompt: "What's on my calendar today?" },
            { label: '📧 Check emails', prompt: 'Show me my recent emails' },
          ].map((chip) => (
            <TouchableOpacity
              key={chip.label}
              onPress={() => {
                setChatInputText(chip.prompt);
              }}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 7,
                borderRadius: 20,
                borderWidth: 1.5,
                borderColor: isDarkMode ? 'rgba(139,92,246,0.5)' : 'rgba(139,92,246,0.35)',
                backgroundColor: isDarkMode ? 'rgba(139,92,246,0.12)' : 'rgba(139,92,246,0.07)',
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <Text style={{ color: isDarkMode ? '#c4b5fd' : '#7c3aed', fontSize: 12, fontWeight: '600' }}>
                {chip.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Manual Chat Input Fallback */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.chatInputRow}>
            <TextInput
              style={[
                styles.chatInput,
                {
                  color: textColor,
                  backgroundColor: inputBgColor,
                  borderColor,
                },
              ]}
              placeholder="Or type to Anya manually..."
              placeholderTextColor={subtextColor}
              value={chatInputText}
              onChangeText={setChatInputText}
              onSubmitEditing={() => {
                if (chatInputText.trim()) {
                  handleSpeech(chatInputText.trim());
                  setChatInputText('');
                }
              }}
            />
            <TouchableOpacity
              style={[
                styles.chatSendBtn,
                {
                  backgroundColor: chatInputText.trim() ? '#3b82f6' : '#9ca3af',
                },
              ]}
              disabled={!chatInputText.trim()}
              onPress={() => {
                if (chatInputText.trim()) {
                  handleSpeech(chatInputText.trim());
                  setChatInputText('');
                }
              }}
            >
              <MaterialCommunityIcon name="send" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
  },
  pushBannerContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 55 : 20,
    left: 16,
    right: 16,
    zIndex: 9999,
    flexDirection: 'row',
    backgroundColor: '#121212ee',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#8b5cf6',
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
  },
  pushBannerLeftBar: {
    width: 5,
    backgroundColor: '#8b5cf6',
  },
  pushBannerContent: {
    flex: 1,
    padding: 12,
  },
  pushBannerTitle: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  pushBannerBody: {
    color: '#d1d5db',
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
    fontWeight: '500',
  },
  pushBannerCloseBtn: {
    padding: 4,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },
  directoryShortcutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
  },
  directoryShortcutText: {
    fontSize: 12,
    fontWeight: '700',
  },
  centerOrbContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backgroundTaskPill: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 120 : 110,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.35)',
    zIndex: 99,
  },
  backgroundTaskText: {
    color: '#3b82f6',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
  },
  // Wake-word pill (Siri-like)
  wakeWordPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#8b5cf6',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 30,
    marginTop: 16,
    gap: 8,
    elevation: 6,
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
  },
  wakeWordPillText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  wakeWordCountdownBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  wakeWordCountdownText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  responseOverlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 130,
    zIndex: 9999,
    elevation: 24,
    gap: 8,
  },
  chatPreviewContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 6,
  },
  liveTranscriptBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 7,
    marginBottom: 8,
  },
  liveTranscriptText: {
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  thinkingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 8,
    marginBottom: 8,
    overflow: 'hidden',
  },
  aiResponseCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    maxHeight: 280,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  aiResponseCardMinimized: {
    maxHeight: 72,
    paddingVertical: 12,
  },
  aiResponsePreview: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
    fontStyle: 'italic',
  },
  aiResponseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  aiResponseHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  aiResponseLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  copyBtn: {
    padding: 4,
  },
  aiResponseScroll: {
    maxHeight: 300,
  },
  aiResponseText: {
    fontSize: 14,
    lineHeight: 21,
  },
  closeBtn: {
    padding: 4,
  },
  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  chatInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
  },
  chatSendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintText: {
    fontSize: 13,
    textAlign: 'center',
    letterSpacing: 0.5,
  },

  // 📞 Slide-up Drawer contacts panel
  directoryDrawer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '65%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1.5,
    padding: 20,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    zIndex: 100,
  },
  directoryDrawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  drawerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  drawerSubtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  drawerActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  drawerAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    gap: 4,
  },
  drawerAddText: {
    color: '#3b82f6',
    fontSize: 12,
    fontWeight: '700',
  },
  drawerCloseBtn: {
    padding: 6,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    height: 42,
    marginBottom: 14,
    gap: 8,
  },
  searchInputText: {
    flex: 1,
    fontSize: 13,
    padding: 0,
  },
  addFormBlock: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },
  formTitleText: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  inputsInlineRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  formInputBox: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 12,
  },
  submitContactBtn: {
    backgroundColor: '#10b981',
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactsListContainer: {
    paddingBottom: 20,
  },
  contactCardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  contactItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  contactLetterCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactLetterText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  contactItemName: {
    fontSize: 14,
    fontWeight: '700',
  },
  contactItemPhone: {
    fontSize: 11,
    marginTop: 2,
  },
  contactItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  contactActionCallBtn: {
    backgroundColor: '#10b981',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactActionDeleteBtn: {
    padding: 4,
  },
  emptyDirectoryText: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 12,
    fontStyle: 'italic',
  },

  // 📞 OUTGOING CALL OVERLAY SYSTEM
  callingOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 60,
    zIndex: 200,
  },
  callingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  callingHeaderTitle: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  callingCenter: {
    alignItems: 'center',
  },
  callingAvatarRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
    borderWidth: 2,
    borderColor: 'rgba(59, 130, 246, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  callingAvatarPill: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  callingAvatarLetter: {
    color: '#ffffff',
    fontSize: 36,
    fontWeight: 'bold',
  },
  callingNameText: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  callingPhoneText: {
    fontSize: 14,
    marginTop: 6,
  },
  callingStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    gap: 8,
  },
  callingStatusText: {
    color: '#3b82f6',
    fontSize: 13,
    fontWeight: '600',
  },
  callingEndBtn: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  callingEndText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  spinningIcon: {
    // Spin animation placeholder
  },
});

export default HomeScreen;
