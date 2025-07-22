import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  SafeAreaView,
  useColorScheme,
  View,
  Modal,
  ScrollView,
  FlatList,
  TouchableWithoutFeedback,
  StatusBar,
} from 'react-native';
import VoiceAssistant from './components/MicWaves/micVisualizer';
import MaterialCommunityIcon from 'react-native-vector-icons/MaterialCommunityIcons';

const HomeScreen: React.FC = ({ navigation }: any) => {
  const theme = useColorScheme();
  const isDarkMode = theme === 'dark';
  const backgroundColor = isDarkMode ? '#000000' : '#ffffff';
  const textColor = isDarkMode ? '#ffffff' : '#000000';
  const cardBackgroundColor = isDarkMode ? '#1a1a1a' : '#f8f9fa';
  const borderColor = isDarkMode ? '#333333' : '#e5e7eb';

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedQuery, setSelectedQuery] = useState('');
  const [isAssistantActive, setIsAssistantActive] = useState(false);
  const [decibelData, setDecibelData] = useState<number[]>([]);
  const [recordingDuration, setRecordingDuration] = useState(0);

  const handleStart = () => {
    console.log('🎙️ Started Listening');
  };

  const handleStop = (duration: number, audioBuffer: number[]) => {
    console.log(
      `🛑 Stopped after ${duration.toFixed(2)} sec`,
      audioBuffer.length,
    );
  };

  const handleDecibel = (db: number) => {
    console.log(`🔊 Current dB: ${db}`);
  };

  const handleSpeech = (text: string) => {
    console.log(`💬 Recognized: ${text}`);
  };

  const handleStartListening = useCallback(() => {
    setIsAssistantActive(true);
    setDecibelData([]);
  }, []);

  const handleStopListening = useCallback(
    (duration: number) => {
      setIsAssistantActive(false);
      setRecordingDuration(duration);
      console.log('Recording stopped after', duration, 'seconds');
      console.log('Decibel data:', decibelData);
    },
    [decibelData],
  );

  const handleDecibelChange = useCallback((db: number) => {
    setDecibelData(prev => [...prev, db]);
  }, []);

  const historyData = [
    {
      id: '1',
      query: 'Turn on lights',
      status: 'Success',
      timestamp: '2 min ago',
    },
    {
      id: '2',
      query:
        'Play my favorite playlist on Spotify in the living room speaker and also dim the bedroom lights',
      status: 'Failed',
      timestamp: '5 min ago',
    },
    {
      id: '3',
      query: 'Open Visual Studio Code',
      status: 'Success',
      timestamp: '1 hour ago',
    },
  ];

  const quickActions = [
    {
      id: 'lights',
      icon: 'lightbulb-on-outline',
      label: 'Lights',
      action: () => navigation.navigate('Explore'),
    },
    {
      id: 'music',
      icon: 'music-circle-outline',
      label: 'Music',
      action: () => console.log('Music pressed'),
    },
    {
      id: 'command',
      icon: 'flash-outline',
      label: 'Command',
      action: () => console.log('Command pressed'),
    },
  ];

  const renderHistoryItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.historyCard,
        { backgroundColor: cardBackgroundColor, borderColor },
      ]}
      onPress={() => {
        setSelectedQuery(item.query);
        setModalVisible(true);
      }}
      activeOpacity={0.7}
    >
      <View style={styles.historyHeader}>
        <View style={styles.statusContainer}>
          <MaterialCommunityIcon
            name={item.status === 'Success' ? 'check-circle' : 'close-circle'}
            color={item.status === 'Success' ? '#10b981' : '#ef4444'}
            size={16}
          />
          <Text
            style={[
              styles.historyStatus,
              { color: item.status === 'Success' ? '#10b981' : '#ef4444' },
            ]}
          >
            {item.status === 'Success' ? 'Executed' : 'Failed'}
          </Text>
        </View>
        <View style={styles.timestampContainer}>
          <MaterialCommunityIcon
            name="clock-outline"
            color="#9ca3af"
            size={14}
          />
          <Text style={styles.timestamp}>{item.timestamp}</Text>
        </View>
      </View>
      <Text
        numberOfLines={2}
        style={[styles.historyQuery, { color: textColor }]}
      >
        "{item.query}"
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor }]}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor={backgroundColor}
      />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <MaterialCommunityIcon name="robot" size={60} color={textColor} />
          <VoiceAssistant
            onStartListening={handleStart}
            onStopListening={handleStop}
            onDecibelChange={handleDecibel}
            onSpeechResult={handleSpeech}
          />
        </View>
        <Text style={[styles.appTitle, { color: textColor }]}>
          Anya AI Assistant
        </Text>
        <Text
          style={[
            styles.appSubtitle,
            { color: isDarkMode ? '#9ca3af' : '#6b7280' },
          ]}
        >
          Your smart home companion
        </Text>
      </View>

      {/* History */}
      <View style={styles.historySection}>
        <Text style={[styles.sectionTitle, { color: textColor }]}>
          Recent Activity
        </Text>
        <FlatList
          data={historyData}
          keyExtractor={item => item.id}
          renderItem={renderHistoryItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.historyList}
        />
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActionsSection}>
        <Text style={[styles.sectionTitle, { color: textColor }]}>
          Quick Actions
        </Text>
        <View style={styles.quickActionsGrid}>
          {quickActions.map(action => (
            <TouchableOpacity
              key={action.id}
              style={styles.actionButton}
              onPress={action.action}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcon
                name={action.icon}
                size={24}
                color="white"
              />
              <Text style={styles.actionButtonText}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setModalVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View
                style={[
                  styles.modalContent,
                  { backgroundColor: cardBackgroundColor },
                ]}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <Text style={[styles.modalTitle, { color: textColor }]}>
                    Command Details
                  </Text>
                  <TouchableOpacity onPress={() => {}} style={{ padding: 4 }}>
                    <MaterialCommunityIcon
                      name="content-copy"
                      color={textColor}
                      size={18}
                      style={{ marginBottom: 12 }}
                    />
                  </TouchableOpacity>
                </View>
                <ScrollView style={styles.modalScroll}>
                  <Text style={[styles.modalText, { color: textColor }]}>
                    "{selectedQuery}"
                  </Text>
                </ScrollView>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.modalCloseText}>Close</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { alignItems: 'center', paddingVertical: 30, paddingHorizontal: 20 },
  logoContainer: { marginBottom: 15 },
  appTitle: { fontSize: 28, fontWeight: 'bold', marginBottom: 5 },
  appSubtitle: { fontSize: 16, fontWeight: '400' },
  historySection: { flex: 1, paddingHorizontal: 20, marginBottom: 20 },
  sectionTitle: { fontSize: 20, fontWeight: '600', marginBottom: 15 },
  historyList: { paddingBottom: 10 },
  historyCard: {
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusContainer: { flexDirection: 'row', alignItems: 'center' },
  historyStatus: { fontSize: 14, fontWeight: '500', marginLeft: 6 },
  timestampContainer: { flexDirection: 'row', alignItems: 'center' },
  timestamp: { fontSize: 12, marginLeft: 4, color: '#6b7280' },
  historyQuery: { fontSize: 15, lineHeight: 20, fontWeight: '400' },
  quickActionsSection: { paddingHorizontal: 20, paddingBottom: 30 },
  quickActionsGrid: { flexDirection: 'row', justifyContent: 'space-around' },
  actionButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
    elevation: 5,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxHeight: '70%',
    elevation: 5,
  },
  modalTitle: { fontSize: 18, fontWeight: '600', marginBottom: 16 },
  modalScroll: { maxHeight: 200 },
  modalText: { fontSize: 16, lineHeight: 24 },
  modalCloseButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  modalCloseText: { color: 'white', fontSize: 16, fontWeight: '500' },
});

export default HomeScreen;
