import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  TouchableOpacity,
  Animated,
  StyleSheet,
  Text,
  PermissionsAndroid,
  Platform,
  Alert,
} from 'react-native';
import SoundLevel from 'react-native-sound-level';
import Voice from '@react-native-voice/voice';

interface VoiceAssistantProps {
  onStartListening: () => void;
  onStopListening: (duration: number, decibelData: number[]) => void;
  onDecibelChange: (db: number) => void;
  onSpeechResult?: (text: string) => void;
}

const VoiceAssistant: React.FC<VoiceAssistantProps> = ({
  onStartListening,
  onStopListening,
  onDecibelChange,
  onSpeechResult,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [decibelLevel, setDecibelLevel] = useState(-160);
  const [spokenText, setSpokenText] = useState<string>('');
  const silenceTimer = useRef<NodeJS.Timeout | null>(null);
  const startTime = useRef<number | null>(null);
  const decibelData = useRef<number[]>([]);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [isVoiceLoaded, setIsVoiceLoaded] = useState(false);

  // Check Voice module loading
  useEffect(() => {
    const checkVoice = async () => {
      console.log('Checking voice availability...');
      try {
        const isAvailable = Voice.isAvailable();
        console.log('Voice available:', isAvailable);
        setIsVoiceLoaded(isAvailable);

        if (!isAvailable) {
          console.warn('Voice recognition not available');
        }
      } catch (error) {
        console.error('Voice check error:', error);
        setIsVoiceLoaded(false);
      }
    };

    checkVoice();
  }, []);

  // Setup Voice listeners - FIXED: Use proper binding method
  useEffect(() => {
    console.log('Setting up Voice listeners...');

    const setupVoiceListeners = async () => {
      try {
        // Destroy any existing instance first
        Voice.destroy();

        // Set up listeners using proper binding
        Voice.onSpeechStart = (event: any) => {
          console.log('🎤 Speech recognition started', event);
        };

        Voice.onSpeechRecognized = (event: any) => {
          console.log('🔍 Speech recognized (processing...)', event);
        };

        Voice.onSpeechResults = (event: any) => {
          console.log(
            '📝 Speech results received (full event):',
            JSON.stringify(event, null, 2),
          );
          if (event.value && event.value.length > 0) {
            const recognizedText = event.value[0];
            console.log('✅ Final recognized text:', recognizedText);
            setSpokenText(recognizedText);
            if (onSpeechResult) {
              onSpeechResult(recognizedText);
            }
          } else {
            console.log('⚠️ No speech results in event:', event);
          }
        };

        Voice.onSpeechPartialResults = (event: any) => {
          console.log(
            '📄 Partial results (full event):',
            JSON.stringify(event, null, 2),
          );
          if (event.value && event.value.length > 0) {
            console.log('📄 Partial text:', event.value[0]);
            setSpokenText(event.value[0]); // Update with partial results for testing
          } else {
            console.log('⚠️ No partial results in event:', event);
          }
        };
        Voice.onSpeechError = (event: any) => {
          console.error(
            '❌ Voice recognition error:',
            JSON.stringify(event, null, 2),
          );
          setIsListening(false);
          // Try to restart if it's a temporary error
          if (
            event.error?.code === '7' ||
            event.error?.message?.includes('network')
          ) {
            console.log(
              'Network error detected, you might need internet connection',
            );
          }
        };

        Voice.onSpeechEnd = (event: any) => {
          console.log('🛑 Speech recognition ended', event);
          setIsListening(false);
        };

        Voice.onSpeechVolumeChanged = (event: any) => {
          console.log('🔊 Speech volume changed:', event.value);
        };

        console.log('✅ Voice listeners set up successfully');
      } catch (error) {
        console.error('❌ Error setting up Voice listeners:', error);
      }
    };

    setupVoiceListeners();

    return () => {
      console.log('Cleaning up Voice listeners...');
      Voice.destroy()
        .then(() => {
          Voice.removeAllListeners();
        })
        .catch(error => {
          console.error('Error cleaning up Voice:', error);
        });
    };
  }, [onSpeechResult]);

  // Request mic permissions
  useEffect(() => {
    const checkPermissions = async () => {
      if (Platform.OS === 'android') {
        try {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
            {
              title: 'Microphone Permission',
              message:
                'This app needs access to your microphone for voice commands',
              buttonNeutral: 'Ask Me Later',
              buttonNegative: 'Cancel',
              buttonPositive: 'OK',
            },
          );
          const hasPermission = granted === PermissionsAndroid.RESULTS.GRANTED;
          console.log('Microphone permission:', hasPermission);
          setHasPermission(hasPermission);
        } catch (err) {
          console.warn('Permission error:', err);
          setHasPermission(false);
        }
      } else {
        setHasPermission(true);
      }
    };

    checkPermissions();
  }, []);

  // Decibel monitoring
  useEffect(() => {
    if (!isListening) return;

    console.log('Starting sound level monitoring...');
    SoundLevel.start();
    SoundLevel.onNewFrame = data => {
      const db = data.value;
      setDecibelLevel(db);
      onDecibelChange(db);
      decibelData.current.push(db);

      // Auto-stop after 2 seconds of silence (above -60dB indicates sound)
      if (db > -60) {
        if (silenceTimer.current) clearTimeout(silenceTimer.current);
        silenceTimer.current = setTimeout(() => {
          console.log('Auto-stopping due to silence...');
          stopListening();
        }, 2000);
      }
    };

    return () => {
      console.log('Stopping sound level monitoring...');
      SoundLevel.stop();
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
    };
  }, [isListening, onDecibelChange, stopListening]);

  const startListening = async () => {
    console.log('Attempting to start listening...');

    if (hasPermission === false) {
      Alert.alert(
        'Permission Required',
        'Please enable microphone permissions in settings',
        [{ text: 'OK' }],
      );
      return;
    }

    if (hasPermission === null || !isVoiceLoaded) {
      console.log('Waiting for permissions or voice module...', {
        hasPermission,
        isVoiceLoaded,
      });
      return;
    }

    try {
      Voice.stop();
      Voice.cancel();
      setSpokenText('');
      console.log('this is first spoken text:-', spokenText);
      await new Promise(resolve => setTimeout(resolve, 100));

      console.log('Starting Voice recognition...');
      const locales = ['en-US', 'en-GB', 'en-IN', 'en-AU'];
      let started = false;

      for (const locale of locales) {
        try {
          console.log(`Trying locale: ${locale}`);
          Voice.start(locale);
          started = true;
          console.log(`✅ Voice recognition started with locale: ${locale}`);
          break;
        } catch (localeError) {
          console.log(`Failed with locale ${locale}:`, localeError);
        }
      }

      if (!started) {
        console.log('Trying without specific locale...');
        Voice.start(null); // Explicitly pass null for default locale
      }

      setIsListening(true);
      startTime.current = Date.now();
      decibelData.current = [];
      onStartListening();

      console.log('✅ Voice recognition started successfully');
    } catch (err: any) {
      console.error('❌ Voice start error:', err);
      Alert.alert('Error', `Failed to start voice recognition: ${err.message}`);
      setIsListening(false);
    }
  };
  const stopListening = useCallback(async () => {
    if (!isListening) return;

    console.log('Stopping voice recognition...');

    try {
      setIsListening(false);
      SoundLevel.stop();
      if (silenceTimer.current) clearTimeout(silenceTimer.current);

      Voice.stop();

      const duration = startTime.current
        ? (Date.now() - startTime.current) / 1000
        : 0;

      console.log('Voice recognition stopped. Duration:', duration);
      onStopListening(duration, [...decibelData.current]);
    } catch (err) {
      console.error('Voice stop error:', err);
    }
  }, [isListening, onStopListening]);

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const getMicScale = () => {
    if (!isListening) return 1;
    const normalized = Math.min(Math.max((decibelLevel + 160) / 160, 0), 1);
    return 1 + normalized * 0.5;
  };

  // Debug: Log spoken text changes
  useEffect(() => {
    if (spokenText) {
      console.log('🗣️ Spoken text updated:', spokenText);
    }
  }, [spokenText]);

  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>
          Microphone access is required for voice commands
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity
        onPress={toggleListening}
        disabled={hasPermission === null || !isVoiceLoaded}
      >
        <Animated.View
          style={[
            styles.micButton,
            {
              transform: [{ scale: isListening ? scaleAnim : 1 }],
              backgroundColor: isListening ? '#FF3B30' : '#E0E0E0',
              opacity: hasPermission === null || !isVoiceLoaded ? 0.5 : 1,
            },
          ]}
        >
          <Text style={styles.micIcon}>🎤</Text>
          {isListening && (
            <Animated.View
              style={[
                styles.soundWave,
                { transform: [{ scale: getMicScale() }] },
              ]}
            />
          )}
        </Animated.View>
      </TouchableOpacity>

      <Text style={styles.statusText}>
        {hasPermission === null || !isVoiceLoaded
          ? 'Loading...'
          : isListening
          ? 'Listening... Speak now'
          : 'Tap to speak'}
      </Text>

      {isListening && (
        <Text style={styles.dbText}>{Math.round(decibelLevel)} dB</Text>
      )}

      {spokenText !== '' && (
        <Text style={styles.transcript}>You said: "{spokenText}"</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  micButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  micIcon: {
    fontSize: 36,
  },
  soundWave: {
    position: 'absolute',
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    borderColor: '#FF3B30',
    opacity: 0.5,
  },
  statusText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  dbText: {
    marginTop: 5,
    fontSize: 14,
    color: '#888',
  },
  permissionText: {
    color: '#FF3B30',
    textAlign: 'center',
    padding: 20,
  },
  transcript: {
    marginTop: 10,
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default VoiceAssistant;
