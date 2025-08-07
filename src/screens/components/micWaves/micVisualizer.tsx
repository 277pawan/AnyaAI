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
import { WebView } from 'react-native-webview';
import SoundLevel from 'react-native-sound-level';

interface WebViewVoiceAssistantProps {
  onStartListening: () => void;
  onStopListening: (duration: number, decibelData: number[]) => void;
  onDecibelChange: (db: number) => void;
  onSpeechResult?: (text: string) => void;
}

const WebViewVoiceAssistant: React.FC<WebViewVoiceAssistantProps> = ({
  onStartListening,
  onStopListening,
  onDecibelChange,
  onSpeechResult,
}) => {
  const [isListening, setIsListening] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [decibelLevel, setDecibelLevel] = useState(-160);
  const [spokenText, setSpokenText] = useState('');
  const [webViewReady, setWebViewReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const webViewRef = useRef<WebView>(null);
  const silenceTimer = useRef<NodeJS.Timeout | null>(null);
  const startTime = useRef<number | null>(null);
  const decibelData = useRef<number[]>([]);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // HTML content for WebView speech recognition
  const speechHTML = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Speech Recognition</title>
        <style>
            body { 
                margin: 0; 
                padding: 20px; 
                font-family: Arial, sans-serif;
                background: #f5f5f5;
                text-align: center;
            }
            #status { 
                color: #333; 
                margin: 20px 0;
                font-size: 16px;
            }
            .error { color: #ff0000; }
            .success { color: #00aa00; }
            .listening { color: #0066ff; }
        </style>
    </head>
    <body>
        <div id="status">Initializing speech recognition...</div>
        
        <script>
            let recognition = null;
            let isListening = false;

            function initSpeechRecognition() {
                console.log('Initializing speech recognition...');
                if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
                    console.warn('Web Speech API not supported');
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'speech_not_supported',
                        message: 'Web Speech API not supported in this WebView'
                    }));
                    return false;
                }

                const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                recognition = new SpeechRecognition();
                
                recognition.continuous = true;
                recognition.interimResults = true;
                recognition.lang = 'en-US';
                recognition.maxAlternatives = 1;

                recognition.onstart = function() {
                    console.log('Speech recognition started');
                    document.getElementById('status').innerHTML = 'Listening... speak now!';
                    document.getElementById('status').className = 'listening';
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'speech_start'
                    }));
                };

                recognition.onresult = function(event) {
                    console.log('Speech recognition result event:', JSON.stringify(event.results));
                    let interimTranscript = '';
                    let finalTranscript = '';

                    for (let i = event.resultIndex; i < event.results.length; i++) {
                        const transcript = event.results[i][0].transcript;
                        console.log('Transcript:', transcript, 'isFinal:', event.results[i].isFinal);
                        if (event.results[i].isFinal) {
                            finalTranscript += transcript;
                        } else {
                            interimTranscript += transcript;
                        }
                    }

                    const text = finalTranscript || interimTranscript;
                    if (text.trim()) {
                        console.log('Sending speech result:', text);
                        window.ReactNativeWebView.postMessage(JSON.stringify({
                            type: 'speech_result',
                            text: text.trim(),
                            isFinal: !!finalTranscript
                        }));
                    } else {
                        console.log('No valid transcript detected');
                    }
                };

                recognition.onerror = function(event) {
                    console.error('Speech recognition error:', event.error, event.message);
                    document.getElementById('status').innerHTML = 'Error: ' + event.error;
                    document.getElementById('status').className = 'error';
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'speech_error',
                        error: event.error,
                        details: event.message || 'No additional details'
                    }));
                };

                recognition.onend = function() {
                    console.log('Speech recognition ended');
                    document.getElementById('status').innerHTML = 'Speech recognition stopped';
                    isListening = false;
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'speech_end'
                    }));
                };

                document.getElementById('status').innerHTML = 'Speech recognition ready!';
                document.getElementById('status').className = 'success';
                window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'speech_ready'
                }));
                
                return true;
            }

            function startSpeech() {
                if (!recognition) {
                    console.warn('Recognition not initialized');
                    return false;
                }
                try {
                    if (isListening) {
                        recognition.stop();
                    }
                    setTimeout(() => {
                        console.log('Starting speech recognition...');
                        recognition.start();
                        isListening = true;
                    }, 100);
                    return true;
                } catch (error) {
                    console.error('Error starting speech:', error);
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'speech_error',
                        error: error.message
                    }));
                    return false;
                }
            }

            function stopSpeech() {
                if (recognition && isListening) {
                    console.log('Stopping speech recognition...');
                    recognition.stop();
                    isListening = false;
                    return true;
                }
                return false;
            }

            window.addEventListener('message', function(event) {
                try {
                    const data = JSON.parse(event.data);
                    console.log('Received message from React Native:', data);
                    switch(data.type) {
                        case 'start_speech':
                            startSpeech();
                            break;
                        case 'stop_speech':
                            stopSpeech();
                            break;
                        case 'init':
                            initSpeechRecognition();
                            break;
                    }
                } catch (error) {
                    console.error('Error processing message:', error);
                }
            });

            document.addEventListener('DOMContentLoaded', initSpeechRecognition);
        </script>
    </body>
    </html>
  `;

  // Request permissions
  const requestPermissions = useCallback(async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Microphone Permission',
            message: 'This app needs microphone access for voice recognition',
            buttonPositive: 'OK',
          },
        );
        const hasMicPermission = granted === PermissionsAndroid.RESULTS.GRANTED;
        setHasPermission(hasMicPermission);
        if (!hasMicPermission) {
          setErrorMessage('Microphone permission denied');
        }
        return hasMicPermission;
      } catch (error) {
        console.error('Permission request error:', error);
        setHasPermission(false);
        setErrorMessage('Error requesting microphone permission');
        return false;
      }
    } else {
      setHasPermission(true);
      return true;
    }
  }, []);

  // Initialize permissions
  useEffect(() => {
    requestPermissions();
  }, [requestPermissions]);

  // Sound level monitoring
  useEffect(() => {
    let monitoring = false;

    if (isListening && hasPermission) {
      monitoring = true;
      try {
        console.log('Starting sound level monitoring...');
        SoundLevel.start(100); // Sample every 100ms
        SoundLevel.onNewFrame = (data: any) => {
          if (!monitoring) return;
          if (data && typeof data.value === 'number') {
            console.log('this is data value', data);
            const db = Math.max(data.value); // Ensure no invalid values
            console.log('Decibel level:', db);
            setDecibelLevel(db);
            onDecibelChange(db);
            decibelData.current.push(db);

            // Auto-stop after silence
            if (silenceTimer.current) clearTimeout(silenceTimer.current);
            if (db > -60) {
              silenceTimer.current = setTimeout(() => {
                if (monitoring) stopListening();
              }, 6000); // 6 seconds of silence
            }
          } else {
            console.warn('Invalid sound level data:', data);
            setErrorMessage('Sound level monitoring failed');
          }
        };
      } catch (error) {
        console.error('Sound monitoring error:', error);
        setErrorMessage('Failed to start sound monitoring');
        setIsListening(false);
      }
    }

    return () => {
      monitoring = false;
      try {
        console.log('Stopping sound level monitoring...');
        SoundLevel.stop();
      } catch (e) {
        console.warn('Error stopping sound level:', e);
      }
      if (silenceTimer.current) {
        clearTimeout(silenceTimer.current);
      }
    };
  }, [isListening, hasPermission, onDecibelChange]);

  // Handle WebView messages
  const handleWebViewMessage = useCallback(
    (event: any) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        console.log('WebView message:', data);

        switch (data.type) {
          case 'speech_ready':
            console.log('WebView speech recognition ready');
            setWebViewReady(true);
            setErrorMessage('');
            break;
          case 'speech_start':
            console.log('WebView speech recognition started');
            break;
          case 'speech_result':
            console.log('WebView speech result:', data.text);
            setSpokenText(data.text);
            if (onSpeechResult && data.isFinal) {
              onSpeechResult(data.text);
            }
            break;
          case 'speech_error':
            console.error('WebView speech error:', data.error, data.details);
            setErrorMessage(
              `Speech error: ${data.error}${
                data.details ? ` - ${data.details}` : ''
              }`,
            );
            setIsListening(false);
            break;
          case 'speech_not_supported':
            console.warn('Web Speech API not supported');
            setErrorMessage('Web Speech API not supported in this WebView');
            setIsListening(false);
            break;
          case 'speech_end':
            console.log('WebView speech recognition ended');
            setIsListening(false);
            break;
        }
      } catch (error) {
        console.error('Error parsing WebView message:', error);
        setErrorMessage('Error processing WebView message');
      }
    },
    [onSpeechResult],
  );

  // Start listening
  const startListening = useCallback(() => {
    if (!hasPermission) {
      Alert.alert('Permission Required', 'Microphone permission needed');
      return;
    }
    if (!webViewReady) {
      setErrorMessage('WebView speech recognition not ready');
      return;
    }

    setSpokenText('');
    setErrorMessage('');
    setIsListening(true);
    startTime.current = Date.now();
    decibelData.current = [];
    onStartListening();

    if (webViewRef.current) {
      console.log('Sending start_speech to WebView');
      webViewRef.current.postMessage(JSON.stringify({ type: 'start_speech' }));
    }
  }, [hasPermission, webViewReady, onStartListening]);

  // Stop listening
  const stopListening = useCallback(() => {
    if (!isListening) return;

    setIsListening(false);

    try {
      console.log('Stopping sound level monitoring...');
      SoundLevel.stop();
    } catch (e) {
      console.warn('Error stopping sound level:', e);
    }

    if (silenceTimer.current) {
      clearTimeout(silenceTimer.current);
      silenceTimer.current = null;
    }

    if (webViewRef.current) {
      console.log('Sending stop_speech to WebView');
      webViewRef.current.postMessage(JSON.stringify({ type: 'stop_speech' }));
    }

    const duration = startTime.current
      ? (Date.now() - startTime.current) / 1000
      : 0;
    onStopListening(duration, [...decibelData.current]);
  }, [isListening, onStopListening]);

  // Toggle listening
  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  // Microphone scale animation
  const getMicScale = () => {
    if (!isListening) return 1;
    const normalized = Math.min(Math.max((decibelLevel + 160) / 130, 0), 1);
    return 1 + normalized * 0.8;
  };

  // Permission denied UI
  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>
          {errorMessage || 'Microphone permission is required'}
        </Text>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={requestPermissions}
        >
          <Text style={styles.actionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* WebView for speech recognition */}
      <WebView
        ref={webViewRef}
        source={{ html: speechHTML }}
        style={styles.hiddenWebView}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback={true}
        mediaCapturePermissionGrantType="grant"
        allowUniversalAccessFromFileURLs={true}
        mixedContentMode="compatibility"
        onMessage={handleWebViewMessage}
      />

      {/* Microphone Button */}
      <TouchableOpacity onPress={toggleListening} activeOpacity={0.8}>
        <Animated.View
          style={[
            styles.micButton,
            {
              transform: [{ scale: getMicScale() }],
              backgroundColor: isListening ? '#FF3B30' : '#34C759',
            },
          ]}
        >
          <Text style={styles.micIcon}>{isListening ? '⏹️' : '🎤'}</Text>
          {isListening && (
            <Animated.View
              style={[
                styles.soundWave,
                {
                  transform: [{ scale: getMicScale() }],
                  borderColor: '#FF3B30',
                },
              ]}
            />
          )}
        </Animated.View>
      </TouchableOpacity>

      {/* Status Text */}
      <Text style={styles.statusText}>
        {errorMessage ||
          (isListening
            ? 'Listening... Speak now!'
            : webViewReady
            ? 'WebView Speech Ready'
            : 'Loading WebView speech...')}
      </Text>

      {/* Debug Info */}
      {isListening && (
        <View style={styles.debugContainer}>
          <Text style={styles.dbText}>
            Volume: {Math.round(decibelLevel)} dB
          </Text>
          <Text style={styles.debugText}>
            Data: {decibelData.current.length} points
          </Text>
        </View>
      )}

      {/* Transcript */}
      {spokenText && (
        <View style={styles.transcriptContainer}>
          <Text style={styles.transcript}>"{spokenText}"</Text>
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
    minHeight: 300,
  },
  hiddenWebView: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  micButton: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 5,
  },
  micIcon: {
    fontSize: 40,
    color: 'white',
  },
  soundWave: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    opacity: 0.6,
  },
  statusText: {
    marginTop: 20,
    fontSize: 18,
    color: '#333',
    textAlign: 'center',
    fontWeight: '500',
  },
  debugContainer: {
    marginTop: 15,
    alignItems: 'center',
  },
  dbText: {
    fontSize: 16,
    color: '#666',
    fontWeight: '600',
  },
  debugText: {
    fontSize: 12,
    color: '#999',
    marginTop: 5,
  },
  transcriptContainer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: '#F0F0F0',
    borderRadius: 10,
    minWidth: 200,
  },
  transcript: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    fontStyle: 'italic',
    fontWeight: '500',
  },
  errorText: {
    color: '#FF3B30',
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 20,
  },
  actionButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default WebViewVoiceAssistant;
