import { useEffect, useRef, useState, useCallback } from 'react';
import { Platform, PermissionsAndroid, Alert } from 'react-native';
import SoundLevel from 'react-native-sound-level';
import {
  request,
  PERMISSIONS,
  RESULTS,
  check,
  openSettings,
} from 'react-native-permissions';

interface SoundLevelData {
  value: number;
  rawValue: number;
}

export const useMicLevel = () => {
  const [hasPermission, setHasPermission] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [level, setLevel] = useState<number | null>(null);
  const [rawValue, setRawValue] = useState<number | null>(null);

  const permissionRequested = useRef(false);

  const requestMicPermission = async (): Promise<boolean> => {
    try {
      let granted = false;
      if (Platform.OS === 'android') {
        const status = await check(PERMISSIONS.ANDROID.RECORD_AUDIO);
        if (status === RESULTS.DENIED || status === RESULTS.LIMITED) {
          const result = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          );
          granted = result === PermissionsAndroid.RESULTS.GRANTED;
        } else if (status === RESULTS.BLOCKED) {
          setPermissionDenied(true);
          Alert.alert(
            'Microphone Permission Required',
            'Please enable microphone access in your device settings to use this feature.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => openSettings() },
            ],
          );
          return false;
        } else {
          granted = status === RESULTS.GRANTED;
        }
      } else {
        const status = await check(PERMISSIONS.IOS.MICROPHONE);
        if (status === RESULTS.DENIED || status === RESULTS.LIMITED) {
          const result = await request(PERMISSIONS.IOS.MICROPHONE);
          granted = result === RESULTS.GRANTED;
        } else if (status === RESULTS.BLOCKED) {
          setPermissionDenied(true);
          Alert.alert(
            'Microphone Permission Required',
            'Please enable microphone access in your device settings to use this feature.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => openSettings() },
            ],
          );
          return false;
        } else {
          granted = status === RESULTS.GRANTED;
        }
      }
      setHasPermission(granted);
      setPermissionDenied(!granted);
      permissionRequested.current = true;
      return granted;
    } catch (error) {
      console.warn('Mic permission error:', error);
      setPermissionDenied(true);
      return false;
    }
  };

  const start = useCallback(async () => {
    const granted = await requestMicPermission();
    if (!granted) {
      return;
    }

    if (!isRunning) {
      try {
        SoundLevel.start();
        SoundLevel.onNewFrame = (data: SoundLevelData) => {
          setLevel(data.value);
          setRawValue(data.rawValue);
        };
        setIsRunning(true);
      } catch (error) {
        console.warn('Error starting SoundLevel:', error);
        setPermissionDenied(true);
      }
    }
  }, [isRunning]);

  const stop = useCallback(() => {
    if (isRunning) {
      SoundLevel.stop();
      setIsRunning(false);
      setLevel(null);
      setRawValue(null);
    }
  }, [isRunning]);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return {
    level,
    rawValue,
    start,
    stop,
    isRunning,
    hasPermission,
    permissionDenied,
  };
};
