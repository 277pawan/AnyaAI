import React, { useState, useEffect, useRef } from 'react';
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
  const [isVoiceReady, setIsVoiceReady] = useState<boolean>(false);
  const [initError, setInitError] = useState<string>('');
  const silenceTimer = useRef<NodeJS.Timeout | null>(null);
  const startTime = useRef<number | null>(null);
  const decibelData = useRef<number[]>([]);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Wait for native module to load properly
  useEffect(() => {
    let mounted = true;
    let retryCount = 0;
    const maxRetries = 5;

    const waitForVoiceModule = async () => {
      const checkVoiceReady = async (): Promise<boolean> => {
        try {
          // Check if the module is loaded
          console.log('Voice module state:', Voice);

          if (!Voice || typeof Voice.isAvailable !== 'function') {
            throw new Error('Voice module not loaded');
          }

          // Try to call isAvailable
          const available = await Voice.isAvailable();
          return available ? true : false;
        } catch (error) {
          console.log(
            `Voice check attempt ${retryCount + 1} failed:`,
            error.message,
          );
          return false;
        }
      };

      while (retryCount < maxRetries && mounted) {
        try {
          const isReady = await checkVoiceReady();

          if (isReady) {
            console.log('Voice module is ready');
            if (mounted) {
              setIsVoiceReady(true);
              setInitError('');
            }
            return;
          }
        } catch (error) {
          console.log(`Retry ${retryCount + 1} failed:`, error);
        }

        retryCount++;
        // Wait before retry with exponential backoff
        await new Promise(resolve =>
          setTimeout(resolve, Math.pow(2, retryCount) * 100),
        );
      }

      if (mounted && retryCount >= maxRetries) {
        setInitError(
          'Voice module failed to initialize after multiple attempts',
        );
        console.error('Voice module initialization failed after retries');
      }
    };

    waitForVoiceModule();

    return () => {
      mounted = false;
    };
  }, []);

  // Setup Voice listeners only after module is ready
  useEffect(() => {
    if (!isVoiceReady) return;

    const setupListeners = () => {
      try {
        Voice.onSpeechStart = () => {
          console.log('Speech start');
        };

        Voice.onSpeechRecognized = () => {
          console.log('Speech recognized');
        };

        Voice.onSpeechEnd = () => {
          console.log('Speech end');
        };

        Voice.onSpeechError = (event: any) => {
          console.error('Voice error:', event.error);
          setIsListening(false);
        };

        Voice.onSpeechResults = (event: any) => {
          console.log('Speech results:', event.value);
          if (event.value && event.value.length > 0) {
            setSpokenText(event.value[0]);
            if (onSpeechResult) onSpeechResult(event.value[0]);
          }
        };

        Voice.onSpeechPartialResults = (event: any) => {
          console.log('Partial results:', event.value);
        };

        console.log('Voice listeners setup complete');
      } catch (error) {
        console.error('Error setting up Voice listeners:', error);
        setInitError(`Listener setup failed: ${error.message}`);
      }
    };

    setupListeners();

    return () => {
      if (Voice && typeof Voice.destroy === 'function') {
        Voice.destroy()
          .then(() => {
            Voice.removeAllListeners();
          })
          .catch(console.error);
      }
    };
  }, [isVoiceReady, onSpeechResult]);

  // Request mic permissions
  useEffect(() => {
    const checkPermissions = async () => {
      if (Platform.OS === 'android') {
        try {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          );
          setHasPermission(granted === PermissionsAndroid.RESULTS.GRANTED);
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

    try {
      SoundLevel.start();
      SoundLevel.onNewFrame = data => {
        const db = data.value;
        setDecibelLevel(db);
        onDecibelChange(db);
        decibelData.current.push(db);

        if (db > -60) {
          if (silenceTimer.current) clearTimeout(silenceTimer.current);
          silenceTimer.current = setTimeout(stopListening, 2000);
        }
      };
    } catch (error) {
      console.error('SoundLevel error:', error);
    }

    return () => {
      try {
        SoundLevel.stop();
      } catch (error) {
        console.error('SoundLevel stop error:', error);
      }
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
    };
  }, [isListening]);

  const startListening = async () => {
    if (!isVoiceReady) {
      Alert.alert('Error', 'Voice recognition is not ready yet. Please wait.');
      return;
    }

    if (hasPermission === false) {
      Alert.alert(
        'Permission Required',
        'Please enable microphone permissions in settings',
      );
      return;
    }

    if (hasPermission === null) {
      console.log('Waiting for permissions to load');
      return;
    }

    try {
      setSpokenText('');
      console.log('Starting voice recognition...');

      await Voice.start('en-US');
      setIsListening(true);
      startTime.current = Date.now();
      decibelData.current = [];
      onStartListening();
    } catch (err) {
      console.error('Voice start error:', err);
      Alert.alert('Error', `Failed to start voice recognition: ${err.message}`);
    }
  };

  const stopListening = async () => {
    if (!isListening) return;

    try {
      setIsListening(false);
      SoundLevel.stop();
      if (silenceTimer.current) clearTimeout(silenceTimer.current);

      await Voice.stop();

      const duration = startTime.current
        ? (Date.now() - startTime.current) / 1000
        : 0;

      onStopListening(duration, [...decibelData.current]);
    } catch (err) {
      console.error('Voice stop error:', err);
    }
  };

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

  // Show error state
  if (initError) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Voice Error: {initError}</Text>
        <Text style={styles.debugText}>
          Try restarting the app or check if device supports speech recognition
        </Text>
      </View>
    );
  }

  // Show loading state
  if (!isVoiceReady) {
    return (
      <View style={styles.container}>
        <Text style={styles.statusText}>Initializing voice recognition...</Text>
        <Text style={styles.debugText}>
          Voice Module: {Voice ? 'Loaded' : 'Not Loaded'}
        </Text>
      </View>
    );
  }

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
        disabled={hasPermission === null || !isVoiceReady}
      >
        <Animated.View
          style={[
            styles.micButton,
            {
              transform: [{ scale: isListening ? scaleAnim : 1 }],
              backgroundColor: isListening ? '#FF3B30' : '#E0E0E0',
              opacity: hasPermission === null || !isVoiceReady ? 0.5 : 1,
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
        {hasPermission === null
          ? 'Checking permissions...'
          : !isVoiceReady
          ? 'Initializing voice...'
          : isListening
          ? 'Listening... Speak now'
          : 'Tap to speak'}
      </Text>

      {isListening && (
        <Text style={styles.dbText}>{Math.round(decibelLevel)} dB</Text>
      )}

      {spokenText !== '' && (
        <Text style={styles.transcript}>You said: {spokenText}</Text>
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
  },
  errorText: {
    color: '#FF3B30',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
  },
  debugText: {
    color: '#888',
    textAlign: 'center',
    fontSize: 12,
    marginTop: 10,
  },
});

export default VoiceAssistant;
