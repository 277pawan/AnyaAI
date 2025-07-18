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
  const silenceTimer = useRef<NodeJS.Timeout | null>(null);
  const startTime = useRef<number | null>(null);
  const decibelData = useRef<number[]>([]);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const [isVoiceLoaded, setIsVoiceLoaded] = useState(false);
  console.log(Voice);
  // Add this useEffect to check Voice module loading
  useEffect(() => {
    const checkVoice = async () => {
      console.log('check voice:- ');
      try {
        // Check if Voice module is available
        console.log(Voice.isAvailable());
        const isAvailable = await Voice.isAvailable();
        console.log(isAvailable);
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

    return () => {
      Voice.destroy().then(() => {
        Voice.removeAllListeners();
      });
    };
  }, []);
  // Setup Voice listeners
  useEffect(() => {
    Voice.onSpeechResults = (event: any) => {
      if (event.value && event.value.length > 0) {
        setSpokenText(event.value[0]);
        if (onSpeechResult) onSpeechResult(event.value[0]);
      }
    };

    Voice.onSpeechError = (event: any) => {
      console.error('Voice error:', event.error);
    };

    return () => {
      Voice.destroy().then(() => {
        Voice.removeAllListeners();
      });
    };
  }, []);

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

    return () => {
      SoundLevel.stop();
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
    };
  }, [isListening]);

  // Update your startListening function
  const startListening = async () => {
    if (hasPermission === false) {
      Alert.alert(
        'Permission Required',
        'Please enable microphone permissions in settings',
        [{ text: 'OK' }],
      );
      return;
    }

    if (hasPermission === null || !isVoiceLoaded) {
      console.log(hasPermission, isVoiceLoaded);
      console.log('Waiting for permissions or voice module to load');
      return;
    }

    try {
      setSpokenText('');
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
        disabled={hasPermission === null}
      >
        <Animated.View
          style={[
            styles.micButton,
            {
              transform: [{ scale: isListening ? scaleAnim : 1 }],
              backgroundColor: isListening ? '#FF3B30' : '#E0E0E0',
              opacity: hasPermission === null ? 0.5 : 1,
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
});

export default VoiceAssistant;
