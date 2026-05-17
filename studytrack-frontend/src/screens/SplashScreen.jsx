import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import { radius, spacing } from '../constraints/theme';
import { TOKEN_KEY } from '../api/client';
import supabase from '../api/supabase';
import client from '../api/client';
import useUserStore from '../store/useUserStore';
import AuthModal from '../components/AuthModal';
import { getPreferences } from '../api/users';
import { requestNotificationPermission, scheduleDailyReminder } from '../utils/notifications';
import { useTheme, ACCENT_COLORS } from '../context/ThemeContext';

WebBrowser.maybeCompleteAuthSession();

export default function SplashScreen({ navigation }) {
  const { colors, setAccent } = useTheme();
  const styles = getStyles(colors);

  const [checking, setChecking] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const setUser = useUserStore((s) => s.setUser);

  useEffect(() => {
    WebBrowser.warmUpAsync();

    // Guards against double-navigation when multiple listeners fire together
    const triggered = { current: false };

    const handleUrl = async ({ url }) => {
      if (!url || !url.includes('auth/callback') || triggered.current) return;
      const { data, error } = await supabase.auth.getSessionFromUrl({ url });
      if (!error && data?.session) {
        triggered.current = true;
        setChecking(false);
        await handleSupabaseSession(data.session);
      }
    };

    // Cold-start: app was launched by the deep link
    Linking.getInitialURL().then((url) => { if (url) handleUrl({ url }); });

    // Foreground: app was already open when OAuth redirected back
    const linkingSub = Linking.addEventListener('url', handleUrl);

    // Fallback: covers cases where Linking misses the URL (e.g. some Android variants)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session && !triggered.current) {
        triggered.current = true;
        setChecking(false);
        await handleSupabaseSession(session);
      }
    });

    // Returning users: restore existing session on launch
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && !triggered.current) {
        triggered.current = true;
        handleSupabaseSession(session).finally(() => setChecking(false));
      } else if (!session) {
        setChecking(false);
      }
    }).catch(() => setChecking(false));

    return () => {
      WebBrowser.coolDownAsync();
      linkingSub.remove();
      subscription.unsubscribe();
    };
  }, []);

  const exchangeAndNavigate = async (supabaseAccessToken) => {
    try {
      // Clear any stale app JWT so the request interceptor doesn't overwrite
      // the Supabase token with an old value before we reach the exchange endpoint.
      await SecureStore.deleteItemAsync(TOKEN_KEY);

      // ── Pre-flight: verify the backend is reachable ────────────────────────
      try {
        await client.get('/health', { timeout: 5000 });
      } catch (e) {
        Alert.alert(
          'Cannot reach server',
          'Make sure the backend is running and your phone is on the same WiFi as your computer.'
        );
        return;
      }

      const response = await client.post('/auth/supabase', {}, {
        headers: { Authorization: `Bearer ${supabaseAccessToken}` },
        timeout: 10000,
      });

      const { token, user } = response.data.data;

      await SecureStore.setItemAsync(TOKEN_KEY, token);
      setUser(user);

      const dest = user.isNewUser ? 'SubjectSetup' : 'Main';
      navigation.replace(dest);

      // Request permission immediately — independent of preferences fetch
      requestNotificationPermission().catch(() => {});

      // Fetch preferences and schedule daily reminder if enabled
      getPreferences().then(async (prefs) => {
        if (!prefs) return;
        useUserStore.getState().setPreferences(prefs);
        if (prefs.studyReminders) {
          await scheduleDailyReminder(prefs.reminderTime ?? '20:00');
        }
        if (prefs.accentColor && ACCENT_COLORS[prefs.accentColor]) {
          setAccent(prefs.accentColor);
        }
      }).catch(() => {});
    } catch (error) {
      Alert.alert(
        'Sign in failed',
        error.message || 'Something went wrong. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  const handleSupabaseSession = async (session) => {
    await exchangeAndNavigate(session.access_token);
  };

  const handleGoogleSignIn = async () => {
    try {
      setAuthLoading(true);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'studytrack://auth/callback',
          skipBrowserRedirect: true,
        },
      });

      if (error || !data?.url) return;

      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        'exp://192.168.0.106:8081'
      );

      if (result.type === 'success' && result.url) {
        const code = new URL(result.url).searchParams.get('code');
        if (!code) {
          Alert.alert('OAuth error', 'No code param in redirect URL: ' + result.url);
          return;
        }

        const exchangePromise = supabase.auth.exchangeCodeForSession(code);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('exchangeCodeForSession timed out')),
            15000
          )
        );

        let sessionData, sessionError;
        try {
          const res = await Promise.race([exchangePromise, timeoutPromise]);
          sessionData = res.data;
          sessionError = res.error;
        } catch (timeoutErr) {
          Alert.alert('Exchange timed out', 'Supabase took too long. Check internet connection.');
          return;
        }

        if (sessionError) {
          Alert.alert('Exchange error', sessionError.message);
          return;
        }

        if (!sessionData?.session) {
          Alert.alert('No session returned', 'exchangeCodeForSession returned null session');
          return;
        }

        await handleSupabaseSession(sessionData.session);
      }
    } catch (err) {
      Alert.alert('Sign in error', err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleEmailSuccess = async (supabaseAccessToken) => {
    setShowEmailModal(false);
    try {
      setAuthLoading(true);
      await exchangeAndNavigate(supabaseAccessToken);
    } catch (err) {
      Alert.alert('Sign-in failed', err.message ?? 'Something went wrong.');
    } finally {
      setAuthLoading(false);
    }
  };

  if (checking) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={colors.accentPrimary} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.bgGlow} />

      <View style={styles.topSection}>
        <View style={styles.logoWrap}>
          <Ionicons name="timer" size={40} color={colors.accentLight} />
        </View>
        <Text style={styles.appName}>StudyTrack</Text>
        <Text style={styles.tagline}>Study smarter. Together.</Text>
      </View>

      <View style={styles.middleSection}>
        <View style={[styles.card, styles.card1]}>
          <Text style={styles.cardEmoji}>🔥</Text>
          <Text style={styles.cardText}>14 Day Streak</Text>
        </View>
        <View style={[styles.card, styles.card2]}>
          <Text style={styles.cardEmoji}>⏱</Text>
          <Text style={[styles.cardText, styles.cardTextLg]}>4h 32m Today</Text>
        </View>
        <View style={[styles.card, styles.card3]}>
          <Text style={styles.cardEmoji}>👥</Text>
          <Text style={styles.cardText}>Group #1</Text>
        </View>
      </View>

      <View style={styles.bottomSection}>
        <TouchableOpacity
          style={[styles.googleBtn, authLoading && styles.btnDisabled]}
          activeOpacity={0.85}
          onPress={handleGoogleSignIn}
          disabled={authLoading}
        >
          {authLoading ? (
            <ActivityIndicator color={colors.accentPrimary} size="small" />
          ) : (
            <Ionicons name="logo-google" size={18} color={colors.accentPrimary} />
          )}
          <Text style={styles.googleBtnText}>Continue with Google</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.emailBtn, authLoading && styles.btnDisabled]}
          activeOpacity={0.85}
          onPress={() => setShowEmailModal(true)}
          disabled={authLoading}
        >
          <Text style={styles.emailBtnText}>Sign in with Email</Text>
        </TouchableOpacity>

        <Text style={styles.footerText}>
          {'By continuing you agree to our '}
          <Text style={styles.footerLink}>Terms</Text>
          {' & '}
          <Text style={styles.footerLink}>Privacy Policy</Text>
        </Text>
      </View>

      <AuthModal
        visible={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        onSuccess={handleEmailSuccess}
      />
    </View>
  );
}

function getStyles(colors) { return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bgGlow: {
    position: 'absolute',
    top: -100,
    alignSelf: 'center',
    width: 300,
    height: 300,
    backgroundColor: colors.accentPrimary,
    borderRadius: 150,
    opacity: 0.05,
  },

  topSection: {
    flex: 45,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.xxl,
  },
  logoWrap: {
    width: 80,
    height: 80,
    backgroundColor: colors.surface,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xxl,
  },
  appName: {
    fontSize: 28,
    fontWeight: '600',
    color: colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: spacing.xs,
  },
  tagline: {
    fontSize: 16,
    fontWeight: '400',
    color: colors.textSecondary,
  },

  middleSection: {
    flex: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderLeftWidth: 3,
    borderLeftColor: colors.accentPrimary,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  card1: { transform: [{ rotate: '-6deg' }, { translateX: -48 }, { translateY: -16 }] },
  card2: {
    transform: [{ rotate: '3deg' }, { translateX: 40 }, { translateY: 8 }],
    zIndex: 20,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  card3: { transform: [{ rotate: '-2deg' }, { translateX: -16 }, { translateY: 48 }] },
  cardEmoji: { fontSize: 18 },
  cardText: { fontSize: 14, fontWeight: '500', color: colors.textPrimary },
  cardTextLg: { fontSize: 16 },

  bottomSection: {
    flex: 30,
    justifyContent: 'flex-end',
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.xxl,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    height: 52,
    backgroundColor: colors.textPrimary,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
  },
  googleBtnText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textDark,
  },
  emailBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderWidth: 0.5,
    borderColor: colors.textSecondary,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
  },
  emailBtnText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  footerText: {
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 16,
    color: colors.textSecondary,
    paddingHorizontal: spacing.lg,
  },
  footerLink: {
    color: colors.textPrimary,
    textDecorationLine: 'underline',
  },
}); }
