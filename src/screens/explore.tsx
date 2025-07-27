import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  useColorScheme,
} from 'react-native';
import MaterialCommunityIcon from 'react-native-vector-icons/MaterialCommunityIcons';

const Explore = ({ navigation }: any) => {
  const theme = useColorScheme();
  const isDarkMode = theme === 'dark';
  const backgroundColor = isDarkMode ? '#0a0a0a' : '#ffffff';
  const textColor = isDarkMode ? '#ffffff' : '#000000';
  const cardBackgroundColor = isDarkMode ? '#1a1a1a' : '#f8f9fa';
  const borderColor = isDarkMode ? '#333333' : '#e5e7eb';

  const smartHome = [
    {
      id: 1,
      content: 'Living Room',
      icon: 'lightbulb-on-outline',
      status: '3 lights on',
      color: '#1ae4ff',
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

      color: '#00ff11',
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
      color: '#f55c5c',
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

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: backgroundColor,
      padding: 20,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 30,
      paddingBottom: 15,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255,255,255,0.1)',
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
      color: textColor,
      fontSize: 18,
      fontWeight: 'bold',
    },
    appTitle: {
      color: textColor,
      fontSize: 18,
      fontWeight: '600',
    },
    appSubtitle: {
      color: textColor,
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
      borderRadius: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2.84,
      elevation: 2,
      borderWidth: 0.1,
      borderColor: borderColor,
    },
    quickAction: {
      flex: 1,
      backgroundColor: cardBackgroundColor,
      borderWidth: 1,
      borderColor: borderColor,
      borderRadius: 15,
      padding: 20,
      alignItems: 'center',
    },
    quickActionIcon: {
      fontSize: 24,
      marginBottom: 8,
    },
    quickActionTitle: {
      color: textColor,
      fontSize: 14,
      fontWeight: '600',
      marginBottom: 4,
      textAlign: 'center',
    },
    quickActionDesc: {
      color: textColor,
      fontSize: 11,
      textAlign: 'center',
    },
    categorySection: {
      backgroundColor: cardBackgroundColor,
      borderWidth: 1,
      borderColor: borderColor,
      borderRadius: 20,
      padding: 10,
      marginBottom: 24,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 3.84,
      elevation: 5,
    },
    categoryHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 15,
    },
    categoryTitle: {
      color: textColor,
      fontSize: 16,
      fontWeight: '600',
    },
    deviceCount: {
      backgroundColor: 'rgba(0, 212, 255, 0.2)',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 15,
      borderWidth: 0.2,
      borderColor: textColor,
    },
    deviceCountText: {
      color: isDarkMode ? '#00d4ff' : 'black',
      fontSize: 11,
    },
    categoryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    categoryItem: {
      width: '48%',
      backgroundColor: backgroundColor,
      borderWidth: 1,
      borderColor: borderColor,
      borderRadius: 12,
      padding: 15,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2.84,
      elevation: 1,
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
      color: textColor,
      fontSize: 12,
      fontWeight: '500',
      marginBottom: 3,
      textAlign: 'center',
    },
    itemStatus: {
      color: textColor,
      fontSize: 10,
      textAlign: 'center',
    },
    voiceButtonContainer: {
      alignItems: 'center',
      marginTop: 20,
      marginBottom: 30,
    },
  });

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
