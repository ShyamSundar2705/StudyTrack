import { useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';

import AppNavigator from './src/navigation/AppNavigator';
import { navigationRef } from './src/navigation/navigationRef';
import { registerNotificationTapHandler } from './src/utils/notifications';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';

const prefix = Linking.createURL('/');

const linking = {
  prefixes: [prefix, 'studytrack://'],
  config: {
    screens: {
      Auth: {
        screens: {
          Splash: 'auth/callback',
        },
      },
    },
  },
};

function AppShell() {
  const { theme } = useTheme();
  const notificationListener = useRef(null);

  useEffect(() => {
    notificationListener.current = registerNotificationTapHandler(navigationRef);
    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
    };
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer ref={navigationRef} linking={linking}>
        <StatusBar style={theme === 'light' ? 'dark' : 'light'} />
        <AppNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  );
}
