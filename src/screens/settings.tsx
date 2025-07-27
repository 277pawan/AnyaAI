import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  Alert,
  useColorScheme,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const Settings = ({ navigation }: any) => {
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [autoConnect, setAutoConnect] = useState(true);

  const theme = useColorScheme();
  const bgColor = theme === 'dark' ? '#0a0a0a' : 'white';
  const cardBgColor = theme === 'dark' ? 'rgba(255,255,255,0.05)' : '#f8f9fa';
  const textColor = theme === 'dark' ? 'white' : 'black';

  const settingsData = [
    {
      id: 1,
      title: 'AI & Voice Settings',
      items: [
        {
          id: 'voice_enabled',
          title: 'Voice Commands',
          subtitle: 'Enable voice control',
          icon: 'microphone',
          type: 'switch',
          value: voiceEnabled,
          onChange: setVoiceEnabled,
        },
        {
          id: 'voice_language',
          title: 'Voice Language',
          subtitle: 'English (US)',
          icon: 'earth',
          type: 'navigate',
          onPress: () => navigation?.navigate('LanguageSettings'),
        },
        {
          id: 'wake_word',
          title: 'Wake Word',
          subtitle: 'Hey Anya',
          icon: 'ear-hearing',
          type: 'navigate',
          onPress: () => Alert.alert('Info :-)', 'Hey Anya'),
        },
      ],
    },
    {
      id: 2,
      title: 'Smart Home',
      items: [
        {
          id: 'auto_connect',
          title: 'Auto Connect Devices',
          subtitle: 'Connect to nearby devices',
          icon: 'link-variant',
          type: 'switch',
          value: autoConnect,
          onChange: setAutoConnect,
        },
        {
          id: 'device_management',
          title: 'Device Management',
          subtitle: 'Add, remove, configure devices',
          icon: 'cog',
          type: 'navigate',
          onPress: () => navigation?.navigate('DeviceManagement'),
        },
        {
          id: 'room_setup',
          title: 'Room Setup',
          subtitle: 'Configure room layouts',
          icon: 'home-outline',
          type: 'navigate',
          onPress: () => navigation?.navigate('RoomSetup'),
        },
      ],
    },
    {
      id: 3,
      title: 'Notifications & Privacy',
      items: [
        {
          id: 'notifications',
          title: 'Push Notifications',
          subtitle: 'System alerts and updates',
          icon: 'bell',
          type: 'switch',
          value: notifications,
          onChange: setNotifications,
        },
        {
          id: 'privacy',
          title: 'Privacy Settings',
          subtitle: 'Data usage and storage',
          icon: 'lock-outline',
          type: 'navigate',
          onPress: () => navigation?.navigate('PrivacySettings'),
        },
        {
          id: 'data_usage',
          title: 'Data Usage',
          subtitle: 'Monitor bandwidth usage',
          icon: 'chart-bar',
          type: 'navigate',
          onPress: () => navigation?.navigate('DataUsage'),
        },
      ],
    },
    {
      id: 4,
      title: 'System',
      items: [
        {
          id: 'server_config',
          title: 'Server Configuration',
          subtitle: 'Connection and performance',
          icon: 'server',
          type: 'navigate',
          onPress: () => navigation?.navigate('ServerConfig'),
        },
        {
          id: 'backup',
          title: 'Backup & Sync',
          subtitle: 'Data backup settings',
          icon: 'cloud-sync',
          type: 'navigate',
          onPress: () => navigation?.navigate('BackupSettings'),
        },
        {
          id: 'updates',
          title: 'System Updates',
          subtitle: 'Check for updates',
          icon: 'update',
          type: 'action',
          onPress: () => Alert.alert('Updates', 'System is up to date!'),
        },
      ],
    },
  ];

  const renderItem = (item: any) => {
    const isPressable = item.type === 'navigate' || item.type === 'action';
    const Content = (
      <View
        style={[
          styles.itemContainer,
          {
            backgroundColor: cardBgColor,
            borderTopWidth: 1,
            borderColor: 'rgba(255,255,255,0.1)',
          },
        ]}
      >
        <MaterialCommunityIcons
          name={item.icon}
          size={24}
          color="#666"
          style={styles.icon}
        />
        <View style={styles.textContainer}>
          <Text style={[styles.title, { color: textColor }]}>{item.title}</Text>
          <Text style={styles.subtitle}>{item.subtitle}</Text>
        </View>
        {item.type === 'switch' && (
          <Switch
            value={item.value}
            onValueChange={item.onChange}
            trackColor={{ false: '#ccc', true: '#81b0ff' }}
            thumbColor={'#4688fb'}
          />
        )}
        {isPressable && (
          <MaterialCommunityIcons
            name="chevron-right"
            size={24}
            color="#888"
            style={styles.chevron}
          />
        )}
      </View>
    );

    return isPressable ? (
      <Pressable key={item.id} onPress={item.onPress}>
        {Content}
      </Pressable>
    ) : (
      <View key={item.id}>{Content}</View>
    );
  };

  return (
    <ScrollView
      style={[
        styles.container,
        {
          backgroundColor: bgColor,
          borderTopWidth: 1,
          borderTopColor: 'rgba(255,255,255,0.1)',
        },
      ]}
    >
      {settingsData.map(section => (
        <View key={section.id} style={styles.section}>
          <Text
            style={(styles.sectionTitle, { color: textColor, fontSize: 16 })}
          >
            {section.title}
          </Text>
          {section.items.map(renderItem)}
        </View>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 8,
  },
  section: {
    margin: 10,
  },
  sectionTitle: {
    fontWeight: '800',
    marginBottom: 12,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    marginVertical: 8,
    borderRadius: 8,
    elevation: 1,
  },
  icon: {
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '500',
  },
  subtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  chevron: {
    padding: 4,
  },
});

export default Settings;
