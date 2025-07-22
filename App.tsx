import React from 'react';
import { StyleSheet, useColorScheme } from 'react-native';
import HomeScreen from './src/screens/homeScreen';
import Explore from './src/screens/explore';
import Settings from './src/screens/settings';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const Tab = createBottomTabNavigator();

const App = () => {
  const theme = useColorScheme();
  const iconColor = theme === 'dark' ? 'white' : 'black';
  const bgColor = theme === 'dark' ? 'black' : 'white';
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Tab.Navigator
          initialRouteName="Home"
          screenOptions={({ route }) => ({
            tabBarActiveTintColor: iconColor,
            tabBarInactiveTintColor: 'gray',
            tabBarStyle: { height: 64, backgroundColor: bgColor },
            tabBarIconStyle: { height: 32 },
            headerShown: false,
            tabBarIcon: ({ color, size }) => {
              let iconName;

              switch (route.name) {
                case 'Home':
                  iconName = 'home';
                  break;
                case 'Explore':
                  iconName = 'compass';
                  break;
                case 'Settings':
                  iconName = 'cog';
                  break;
                default:
                  iconName = 'circle';
              }

              return (
                <MaterialCommunityIcons
                  name={iconName}
                  color={color}
                  size={32}
                />
              );
            },
          })}
        >
          <Tab.Screen
            name="Home"
            component={HomeScreen}
            options={{ tabBarLabel: 'Home', tabBarShowLabel: true }}
          />
          <Tab.Screen name="Explore" component={Explore} />
          <Tab.Screen name="Settings" component={Settings} />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
};

export default App;
