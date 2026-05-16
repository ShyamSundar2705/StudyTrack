import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkColors, lightColors } from '../constraints/theme';

export const ACCENT_COLORS = {
  blue:   { primary: '#2D6BE4', light: '#4A90E2' },
  purple: { primary: '#7C3AED', light: '#A78BFA' },
  green:  { primary: '#16A34A', light: '#34D399' },
  orange: { primary: '#EA580C', light: '#FB923C' },
  teal:   { primary: '#0D9488', light: '#2DD4BF' },
};

const ThemeContext = createContext({
  theme: 'dark',
  colors: darkColors,
  setTheme: () => {},
  accent: 'blue',
  setAccent: () => {},
});

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState('dark');
  const [accent, setAccentState] = useState('blue');

  useEffect(() => {
    AsyncStorage.getItem('app_theme').then((saved) => {
      if (saved === 'light' || saved === 'dark') setThemeState(saved);
    }).catch(() => {});
    AsyncStorage.getItem('app_accent').then((saved) => {
      if (saved && ACCENT_COLORS[saved]) setAccentState(saved);
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

  const setAccent = async (newAccent) => {
    if (!ACCENT_COLORS[newAccent]) return;
    setAccentState(newAccent);
    await AsyncStorage.setItem('app_accent', newAccent).catch(() => {});
    try {
      const api = require('../api/client').default;
      await api.patch('/users/me/preferences', { accentColor: newAccent });
    } catch (err) {
      console.error('Accent save failed:', err);
    }
  };

  const baseColors = theme === 'light' ? lightColors : darkColors;
  const accentValues = ACCENT_COLORS[accent] ?? ACCENT_COLORS.blue;
  const activeColors = {
    ...baseColors,
    accentPrimary: accentValues.primary,
    accentLight:   accentValues.light,
  };

  return (
    <ThemeContext.Provider value={{ theme, colors: activeColors, setTheme, accent, setAccent }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
