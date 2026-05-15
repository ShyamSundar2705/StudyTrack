import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkColors, lightColors } from '../constraints/theme';

const ThemeContext = createContext({ theme: 'dark', colors: darkColors, setTheme: () => {} });

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState('dark');

  useEffect(() => {
    AsyncStorage.getItem('app_theme').then((saved) => {
      if (saved === 'light' || saved === 'dark') setThemeState(saved);
    }).catch(() => {});
  }, []);

  const setTheme = async (newTheme) => {
    setThemeState(newTheme);
    await AsyncStorage.setItem('app_theme', newTheme).catch(() => {});
    try {
      const api = require('../api/client').default;
      await api.patch('/users/me/preferences', { theme: newTheme });
    } catch (err) {
      console.error('Theme save failed:', err);
    }
  };

  const activeColors = theme === 'light' ? lightColors : darkColors;

  return (
    <ThemeContext.Provider value={{ theme, colors: activeColors, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
