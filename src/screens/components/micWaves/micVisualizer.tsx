import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  Animated,
  Text,
  PermissionsAndroid,
  Platform,
  Alert,
  StyleSheet,
} from 'react-native';
import SoundLevel from 'react-native-sound-level';
import {
  Cheetah,
  CheetahTranscript,
  CheetahErrors,
} from '@picovoice/cheetah-react-native';

const ACCESS_KEY = 'HlqaBqpkf+FVe15H1DcHC8W+ovdC7r6AByaTy4ItLRDrnxHgj9AF9g==';
const MODEL_NAME = 'cheetah-EN-US-1.0.pv'; // adjust to your model

const VoiceAssistant = ({
  onStartListening,
  onStopListening,
  onDecibelChange,
  onSpeechResult,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [decibel, setDecibel] = useState(-160);
  const [spokenText, setSpokenText] = useState('');
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const cheetahRef = useRef<Cheetah | null>(null);
  const audioBuffer = useRef<number[]>([]);

  useEffect(() => {
    (async () => {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        );
        setHasPermission(granted === PermissionsAndroid.RESULTS.GRANTED);
      } else {
        setHasPermission(true);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const modelPath = MODEL_NAME;
        const cheetah = await Cheetah.create(ACCESS_KEY, modelPath, {
          endpointDurationSec: 1.0,
          enableAutomaticPunctuation: true,
        });
        cheetahRef.current = cheetah;
      } catch (err) {
        console.error('Cheetah init', err);
        Alert.alert('STT Error', 'Could not initialize speech engine');
      }
    })();
    return () => {
      cheetahRef.current?.delete();
    };
  }, []);

  useEffect(() => {
    if (!isListening) return;
    SoundLevel.start();
    SoundLevel.onNewFrame = frame => {
      const db = frame.value;
      setDecibel(db);
      onDecibelChange(db);
      audioBuffer.current.push(frame.rawValue); // raw audio?
    };
    return () => SoundLevel.stop();
  }, [isListening]);

  const startListening = () => {
    if (hasPermission !== true) {
      Alert.alert('Permission Missing', 'Allow mic access');
      return;
    }
    audioBuffer.current = [];
    setSpokenText('');
    onStartListening();
    setIsListening(true);
  };

  const stopListening = async () => {
    if (!isListening) return;
    setIsListening(false);
    SoundLevel.stop();
    const cheetah = cheetahRef.current;
    if (!cheetah) return;
    try {
      let transcript = '';
      const frameLen = cheetah.frameLength;
      const sampleRate = cheetah.sampleRate;
      const frames = audioBuffer.current;
      for (let i = 0; i < frames.length; i += frameLen) {
        const chunk = frames.slice(i, i + frameLen);
        const res: CheetahTranscript = await cheetah.process(chunk);
        if (res.transcript) {
          transcript += res.transcript + ' ';
          setSpokenText(transcript);
          if (onSpeechResult) onSpeechResult(transcript);
        }
        if (res.isEndpoint) break;
      }
      const finalRes = await cheetah.flush();
      if (finalRes.transcript) {
        transcript += finalRes.transcript;
        setSpokenText(transcript);
        if (onSpeechResult) onSpeechResult(transcript);
      }
      const duration = audioBuffer.current.length / sampleRate;
      onStopListening(duration, [...audioBuffer.current]);
    } catch (err) {
      console.error('Cheetah error', err);
      if (err instanceof CheetahErrors) Alert.alert('STT error', err.message);
    }
  };

  const toggle = () => (isListening ? stopListening() : startListening());

  const getMicScale = () =>
    !isListening
      ? 1
      : Math.min(Math.max((decibel + 160) / 160, 0), 1) * 0.5 + 1;

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={toggle}>
        <Animated.View
          style={[styles.mic, { transform: [{ scale: getMicScale() }] }]}
        >
          <Text style={styles.icon}>🎤</Text>
        </Animated.View>
      </TouchableOpacity>
      <Text style={{ color: 'white' }}>
        {isListening ? 'Listening...' : 'Tap to speak'}
      </Text>
      {spokenText && <Text>You said: {spokenText}</Text>}
    </View>
  );
};

export default VoiceAssistant;

const styles = StyleSheet.create({
  container: {
    color: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mic: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#EEE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 36 },
});
