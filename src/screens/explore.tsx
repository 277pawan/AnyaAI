import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import MaterialCommunityIcon from 'react-native-vector-icons/MaterialCommunityIcons';

const Explore = ({ navigation }: any) => {
  const smartHome = [
    {
      id: 1,
      content: 'Living Room',
      icon: 'lightbulb-on-outline',
      status: '3 lights on',
      color: 'yellow',
      action: () => console.log('Living Room controls'),
    },
    {
      id: 2,
      content: 'Speakers',
      icon: 'speaker-wireless',
      status: 'Connected',
      color: 'skyblue',
      action: () => console.log('Speaker controls'),
    },
    {
      id: 3,
      content: 'Temperature',
      icon: 'coolant-temperature',
      status: '22°C',
      color: '#437ecb',
      action: () => console.log('Temperature controls'),
    },
    {
      id: 4,
      content: 'Smart Plugs',
      icon: 'power-plug',
      status: '2 active',
      color: 'gray',
      action: () => console.log('Smart plug controls'),
    },
  ];

  const studyProductivity = [
    {
      id: 1,
      content: 'Chat',
      icon: 'chat-minus',
      status: 'Ready to talk',

      color: 'yellow',
      action: () => navigation?.navigate('ChatScreen'),
    },
    {
      id: 2,
      content: 'News',
      icon: 'newspaper-variant-multiple',
      status: 'Latest updates',
      color: 'gray',
      action: () => navigation?.navigate('NewsScreen'),
    },
    {
      id: 3,
      content: 'Server Status',
      icon: 'server-security',
      status: 'Healthy',
      color: 'skyblue',
      action: () => navigation?.navigate('ServerStatusScreen'),
    },
    {
      id: 4,
      content: 'Study Timer',
      icon: 'timer-sand',
      status: 'Ready to focus',
      color: '#e4b9b9',
      action: () => navigation?.navigate('StudyTimerScreen'),
    },
  ];

  const renderCategoryItem = (data: any, onPress?: () => void) => (
    <Pressable
      key={data.id}
      style={styles.categoryItem}
      onPress={onPress || data.action}
    >
      <View style={styles.itemContent}>
        <Text style={styles.itemIcon}>
          <MaterialCommunityIcon
            name={data.icon}
            size={24}
            color={data.color}
          />
        </Text>
        <View style={styles.itemText}>
          <Text style={styles.itemTitle}>{data.content}</Text>
          <Text style={styles.itemStatus}>{data.status}</Text>
        </View>
      </View>
    </Pressable>
  );

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <View style={styles.logoIcon}>
            <Text style={styles.logoText}>A</Text>
          </View>
          <View>
            <Text style={styles.appTitle}>Anya AI</Text>
            <Text style={styles.appSubtitle}>Your AI Assistant</Text>
          </View>
        </View>
        <View style={styles.statusIndicator}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>Online</Text>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity style={styles.quickAction}>
          <Text style={styles.quickActionIcon}>💡</Text>
          <Text style={styles.quickActionTitle}>Quick Lights</Text>
          <Text style={styles.quickActionDesc}>Toggle all lights</Text>
        </TouchableOpacity>
      </View>

      {/* Smart Home Control Section */}
      <View style={styles.categorySection}>
        <View style={styles.categoryHeader}>
          <Text style={styles.categoryTitle}>🏠 Smart Home Control</Text>
          <View style={styles.deviceCount}>
            <Text style={styles.deviceCountText}>
              {smartHome.length} controls
            </Text>
          </View>
        </View>
        <View style={styles.categoryGrid}>
          {smartHome.map(data => renderCategoryItem(data))}
        </View>
      </View>

      {/* Study & Productivity Section */}
      <View style={styles.categorySection}>
        <View style={styles.categoryHeader}>
          <Text style={styles.categoryTitle}>📚 Study & Productivity</Text>
          <View style={styles.deviceCount}>
            <Text style={styles.deviceCountText}>
              {studyProductivity.length} features
            </Text>
          </View>
        </View>
        <View style={styles.categoryGrid}>
          {studyProductivity.map(data => renderCategoryItem(data))}
        </View>
      </View>
    </ScrollView>
  );
};

export default Explore;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoIcon: {
    width: 40,
    height: 40,
    backgroundColor: '#00d4ff',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  logoText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  appTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  appSubtitle: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 12,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    backgroundColor: '#00ff88',
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    color: '#00ff88',
    fontSize: 12,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 15,
    marginBottom: 30,
  },
  quickAction: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
  },
  quickActionIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  quickActionTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
  },
  quickActionDesc: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 11,
    textAlign: 'center',
  },
  categorySection: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    padding: 10,
    marginBottom: 20,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  categoryTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  deviceCount: {
    backgroundColor: 'rgba(0, 212, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 15,
  },
  deviceCountText: {
    color: '#00d4ff',
    fontSize: 11,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryItem: {
    width: '48%',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 15,
  },
  itemContent: {
    alignItems: 'center',
  },
  itemIcon: {
    fontSize: 18,
    marginBottom: 8,
  },
  itemText: {
    alignItems: 'center',
  },
  itemTitle: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 3,
    textAlign: 'center',
  },
  itemStatus: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 10,
    textAlign: 'center',
  },
  voiceButtonContainer: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  voiceButton: {
    width: 60,
    height: 60,
    backgroundColor: '#00d4ff',
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#00d4ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  voiceButtonIcon: {
    fontSize: 24,
  },
});
