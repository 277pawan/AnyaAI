import React from 'react';
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
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Feather from 'react-native-vector-icons/Feather';

const HomeScreen: React.FC = () => {
  const theme = useColorScheme();
  const isDarkMode = theme === 'dark';
  const backgroundColor = isDarkMode ? '#000000' : '#ffffff';
  const textColor = isDarkMode ? '#ffffff' : '#000000';
  const cardBackgroundColor = isDarkMode ? '#1a1a1a' : '#f8f9fa';
  const borderColor = isDarkMode ? '#333333' : '#e5e7eb';

  const [modalVisible, setModalVisible] = React.useState(false);
  const [selectedQuery, setSelectedQuery] = React.useState('');

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
    {
      id: '4',
      query: 'Check weather updates for the week',
      status: 'Success',
      timestamp: '3 hours ago',
    },
  ];

  const quickActions = [
    {
      id: 'lights',
      icon: MaterialCommunityIcons,
      iconName: 'lightbulb-group-outline',
      label: 'Lights',
      action: () => console.log('Lights pressed'),
    },
    {
      id: 'music',
      icon: MaterialCommunityIcons,
      iconName: 'music',
      label: 'Music',
      action: () => console.log('Music pressed'),
    },
    {
      id: 'command',
      icon: MaterialCommunityIcons,
      iconName: 'code-tags',
      label: 'Command',
      action: () => console.log('Command pressed'),
    },
  ];
  uu;
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
          {item.status === 'Success' ? (
            <MaterialCommunityIcons name="check" size={16} color="#10b981" />
          ) : (
            <MaterialCommunityIcons
              name="close-circle"
              size={16}
              color="#ef4444"
            />
          )}
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
          <Feather name="clock" size={12} color="#6b7280" />
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

      {/* Header Section */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <MaterialCommunityIcons name="robot" size={60} color="#2563eb" />
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

      {/* History Section */}
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
              <action.icon name={action.iconName} size={24} color="white" />
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
            <TouchableWithoutFeedback onPress={() => {}}>
              <View
                style={[
                  styles.modalContent,
                  { backgroundColor: cardBackgroundColor },
                ]}
              >
                <View
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                  }}
                >
                  <Text style={[styles.modalTitle, { color: textColor }]}>
                    Command Details
                  </Text>
                  <Feather
                    name="copy"
                    size={20}
                    color="white"
                    onPress={() => {}}
                  />
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
  container: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
  },
  logoContainer: {
    marginBottom: 15,
  },
  appTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  appSubtitle: {
    fontSize: 16,
    fontWeight: '400',
  },
  historySection: {
    flex: 1,
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 15,
  },
  historyList: {
    paddingBottom: 10,
  },
  historyCard: {
    padding: 16,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
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
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  historyStatus: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  timestampContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timestamp: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 4,
  },
  historyQuery: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '400',
  },
  quickActionsSection: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 80,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
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
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  modalScroll: {
    maxHeight: 200,
  },
  modalText: {
    fontSize: 16,
    lineHeight: 24,
  },
  modalCloseButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  modalCloseText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default HomeScreen;
