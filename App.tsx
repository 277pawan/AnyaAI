import React, { useState, createContext, useEffect } from 'react';
import { useColorScheme, StatusBar, DeviceEventEmitter, View, Text, Image, TouchableOpacity } from 'react-native';
import HomeScreen from './src/screens/homeScreen';
import DashboardScreen from './src/screens/dashboardScreen';
import HistoryScreen from './src/screens/historyScreen';
import Settings from './src/screens/settings';
import AnyaSettings from './src/screens/anyaSettings';
import FocusScreen from './src/screens/focusScreen';
import { NotificationService } from './src/services/notificationService';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

export const ThemeContext = createContext({
  theme: 'dark',
  toggleTheme: () => {},
});

const Tab = createBottomTabNavigator();

const App = () => {
  const systemTheme = useColorScheme();
  const [appTheme, setAppTheme] = useState(systemTheme || 'dark');

  const toggleTheme = () => {
    setAppTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  const isDark = appTheme === 'dark';
  const iconColor = isDark ? '#ffffff' : '#000000';
  const bgColor = isDark ? '#050505' : '#ffffff';
  const tabBgColor = isDark ? '#111111' : '#f8f9fa';
  const tabColors: Record<string, string> = {
    AnyaAI: '#8b5cf6',
    Home: '#3b82f6',
    Focus: '#10b981',
    Profile: '#ef4444',
  };

  useEffect(() => {
    // Initialize OS-level Push Notification listeners on app boot
    NotificationService.setupListeners();
    NotificationService.requestPermissionAndGetToken().then(token => {
      console.log('App initialized with device token:', token);
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme: appTheme, toggleTheme }}>
      <SafeAreaProvider>
        <StatusBar
          barStyle={isDark ? 'light-content' : 'dark-content'}
          backgroundColor={bgColor}
        />
        <NavigationContainer>
          <Tab.Navigator
            initialRouteName="Anya"
            screenOptions={({ route }) => ({
              tabBarActiveTintColor: tabColors[route.name] || '#3b82f6',
              tabBarInactiveTintColor: isDark ? '#6b7280' : '#9ca3af',
              tabBarStyle: {
                height: 64,
                backgroundColor: tabBgColor,
                borderTopWidth: 0,
              },
              tabBarIconStyle: { height: 32 },
              headerShown: false,
              tabBarIcon: ({ color }) => {
                let iconName = 'circle';
                if (route.name === 'Anya') iconName = 'robot-outline';
                if (route.name === 'Dashboard')
                  iconName = 'view-dashboard-outline';
                if (route.name === 'Focus') iconName = 'bullseye-arrow';
                if (route.name === 'History') iconName = 'history';
                if (route.name === 'AnyaAI') iconName = 'robot-excited-outline';
                if (route.name === 'Profile') iconName = 'account-cog-outline';

                return (
                  <MaterialCommunityIcons
                    name={iconName}
                    color={color}
                    size={28}
                  />
                );
              },
            })}
          >
            <Tab.Screen
              name="Anya"
              component={HomeScreen}
              options={{ tabBarLabel: 'Anya' }}
            />
            <Tab.Screen name="Dashboard" component={DashboardScreen} />
            <Tab.Screen
              name="Focus"
              component={FocusScreen}
              options={{
                tabBarLabel: 'Focus',
                headerShown: false,
              }}
            />
            <Tab.Screen name="History" component={HistoryScreen} />
            <Tab.Screen
              name="AnyaAI"
              component={AnyaSettings}
              options={{
                tabBarLabel: 'Anya AI',
                headerShown: false,
              }}
            />
            <Tab.Screen
              name="Profile"
              component={Settings as React.FC}
              options={{
                headerShown: true,
                headerStyle: { backgroundColor: bgColor },
                headerTintColor: iconColor,
                headerShadowVisible: false,
              }}
            />
          </Tab.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </ThemeContext.Provider>
  );
};

export default App;
