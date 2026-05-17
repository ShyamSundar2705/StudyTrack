import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Linking,
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Ionicons } from '@expo/vector-icons';
import { radius, spacing } from '../constraints/theme';
import { useTheme, ACCENT_COLORS } from '../context/ThemeContext';
import useUserStore from '../store/useUserStore';
import usePomodoroStore from '../store/usePomodoroStore';
import { signOut, getPreferences, updatePreferences } from '../api/users';
import BottomSheetPicker from '../components/BottomSheetPicker';
import TimePickerModal from '../components/TimePickerModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleDailyReminder, cancelDailyReminder } from '../utils/notifications';
import { formatTime12h } from '../utils/dateTime';
import appJson from '../../app.json';

const SETTINGS_KEY = 'studytrack:settings';

const DEFAULTS = {
  pushNotifs:     true,
  reminders:      true,
  groupActivity:  false,
  achievements:   true,
  focusMode:      true,
  keepAwake:      true,
  hideDigits:     false,
  motivational:   true,
  pomodoroMode:   true,
  pomodoroSounds: true,
  appBlocker:     true,
  strictMode:     false,
  syncDevices:       true,
  shareAnalytics:    true,
  profilePublic:     true,
  showInLeaderboard: true,
  shareStudyStats:   true,
};

const BACKEND_KEY_MAP = {
  pushNotifs:     'notificationsEnabled',
  reminders:      'studyReminders',
  groupActivity:  'groupActivityAlerts',
  achievements:   'achievementAlerts',
  hideDigits:     'hideTimerDigits',
  motivational:   'motivationalQuotes',
  pomodoroSounds:    'pomodoroSounds',
  shareAnalytics:    'shareAnalytics',
  profilePublic:     'profilePublic',
  showInLeaderboard: 'showInLeaderboard',
  shareStudyStats:   'shareStudyStats',
};

const APP_VERSION = appJson.expo.version;

const CHANGELOG = [
  { version: '1.0.0', items: ['Achievement system with 11 unlockable badges', 'Edit profile — name, handle, avatar color', 'Share your profile card with friends', 'Theme toggle: Dark / Light mode', 'Privacy settings for leaderboard and profile'] },
];

// Interactive toggle
const Toggle = ({ on, onPress }) => {
  const { colors } = useTheme();
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <View style={{
        width: 44, height: 24, borderRadius: 12,
        backgroundColor: on ? colors.accentPrimary : colors.border,
        justifyContent: 'center', paddingHorizontal: 2,
      }}>
        <View style={{
          width: 20, height: 20, borderRadius: 10,
          backgroundColor: colors.textPrimary,
          alignSelf: on ? 'flex-end' : 'flex-start',
        }} />
      </View>
    </TouchableOpacity>
  );
};

// Standard settings row with left icon + label + right content
const SettingsRow = ({ icon, iconColor, label, right, borderBottom = true, rowStyle }) => {
  const { colors } = useTheme();
  return (
    <View style={[
      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md, paddingHorizontal: spacing.lg, minHeight: 52 },
      borderBottom && { borderBottomWidth: 1, borderBottomColor: colors.border },
      rowStyle,
    ]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <Ionicons name={icon} size={20} color={iconColor ?? colors.accentLight} />
        <Text style={{ fontSize: 14, fontWeight: '500', color: colors.textPrimary }}>{label}</Text>
      </View>
      {right}
    </View>
  );
};

function getStyles(colors) {
  return StyleSheet.create({
    root:            { flex: 1, backgroundColor: colors.background },
    header:          { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingBottom: spacing.md, paddingHorizontal: spacing.xl, backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.border },
    backBtn:         { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    headerTitle:     { fontSize: 18, fontWeight: '700', color: colors.accentPrimary },
    scroll:          { flex: 1 },
    scrollContent:   { paddingHorizontal: spacing.lg, paddingTop: spacing.xl },
    profileRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, padding: spacing.lg, marginBottom: spacing.xl },
    profileLeft:     { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    profileAvatar:   { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.accentPrimary, alignItems: 'center', justifyContent: 'center' },
    profileInitial:  { fontSize: 22, fontWeight: '700', color: colors.textPrimary },
    profileName:     { fontSize: 17, fontWeight: '600', color: colors.textPrimary },
    profileHandle:   { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    editProfileBtn:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
    editProfileText: { fontSize: 14, fontWeight: '500', color: colors.accentPrimary },
    sectionHeader:   { fontSize: 12, fontWeight: '700', color: colors.textSecondary, letterSpacing: 1, textTransform: 'uppercase', marginBottom: spacing.sm, marginTop: spacing.xl, paddingLeft: 2 },
    card:            { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, overflow: 'hidden' },
    row:             { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md, paddingHorizontal: spacing.lg, minHeight: 52 },
    rowBorder:       { borderBottomWidth: 1, borderBottomColor: colors.border },
    rowLeft:         { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
    rowLeftColumn:   { flex: 1, gap: 4 },
    rowLabel:        { fontSize: 14, fontWeight: '500', color: colors.textPrimary },
    rowSubtitle:     { fontSize: 11, color: colors.textSecondary, marginLeft: 36, lineHeight: 15 },
    rowRightGroup:   { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    valueText:       { fontSize: 13, color: colors.accentLight },
    mutedText:       { fontSize: 12, color: colors.textSecondary },
    strictRow:       { backgroundColor: 'rgba(231,76,60,0.06)', paddingLeft: 0, paddingRight: spacing.lg, position: 'relative' },
    strictAccentBar: { width: 3, alignSelf: 'stretch', backgroundColor: colors.danger, marginRight: spacing.lg },
    themeSegment:         { flexDirection: 'row', backgroundColor: colors.surfaceDeep, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.accentPrimary, padding: 3 },
    themeSegmentActive:   { width: 44, height: 26, backgroundColor: colors.surface, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
    themeSegmentActiveText:   { fontSize: 12, fontWeight: '700', color: colors.textPrimary },
    themeSegmentInactive:     { width: 44, height: 26, alignItems: 'center', justifyContent: 'center' },
    themeSegmentInactiveText: { fontSize: 12, color: colors.textSecondary },
    accentSwatchRow:    { flexDirection: 'row', gap: 8 },
    accentSwatchCircle: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    accentSwatchSelected: { borderWidth: 2, borderColor: colors.textPrimary },
    deleteRow:       { paddingLeft: 0, paddingRight: spacing.lg },
    deleteAccentBar: { width: 3, alignSelf: 'stretch', backgroundColor: colors.danger, marginRight: spacing.lg },
    modalOverlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
    modalCard:       { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xl, width: '100%', maxHeight: '70%' },
    modalHeader:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
    modalTitle:      { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
    changelogEntry:  { marginBottom: spacing.lg },
    changelogVersion:{ fontSize: 14, fontWeight: '700', color: colors.accentPrimary, marginBottom: spacing.sm },
    changelogItem:   { fontSize: 13, color: colors.textSecondary, lineHeight: 20 },
    signOutBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.lg, backgroundColor: colors.surfaceDeep, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, paddingVertical: spacing.lg },
    signOutText:     { fontSize: 15, fontWeight: '700', color: colors.danger },
  });
}

export default function AppSettingsScreen({ navigation, route }) {
  const name   = useUserStore((s) => s.name);
  const handle = useUserStore((s) => s.handle);
  const avatar = useUserStore((s) => s.avatar);
  const reset  = useUserStore((s) => s.reset);

  const pomoConfig   = usePomodoroStore((s) => s.config);
  const setPomoConfig = usePomodoroStore((s) => s.setConfig);

  const [settings,           setSettings]          = useState(DEFAULTS);
  const [pickerVisible,      setPickerVisible]      = useState(false);
  const [pickerTarget,       setPickerTarget]       = useState(null);
  const [showReminderPicker, setShowReminderPicker] = useState(false);
  const [reminderTime,       setReminderTime]       = useState({ hours: 20, minutes: 0 });
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const touchedKeys = useRef(new Set());
  const scrollRef   = useRef(null);
  const pomoY       = useRef(0);
  const notifsY     = useRef(0);
  const privacyY    = useRef(0);

  const handlePomoLayout = (e) => {
    pomoY.current = e.nativeEvent.layout.y;
    if (route.params?.scrollToPomo) {
      setTimeout(() => {
        scrollRef.current?.scrollTo({ y: pomoY.current - spacing.xl, animated: true });
      }, 200);
    }
  };

  const handleNotifsLayout = (e) => {
    notifsY.current = e.nativeEvent.layout.y;
    const sec = route.params?.scrollToSection;
    if (sec === 'notifications' || sec === 'reminders') {
      setTimeout(() => {
        scrollRef.current?.scrollTo({ y: notifsY.current - spacing.xl, animated: true });
      }, 200);
    }
  };

  const handlePrivacyLayout = (e) => {
    privacyY.current = e.nativeEvent.layout.y;
    if (route.params?.scrollToSection === 'privacy') {
      setTimeout(() => {
        scrollRef.current?.scrollTo({ y: privacyY.current - spacing.xl, animated: true });
      }, 200);
    }
  };

  const POMO_OPTIONS = {
    focusMinutes:      [15,20,25,30,35,40,45,50,55,60].map((v) => ({ label: `${v} min`, value: v })),
    shortBreakMinutes: [3,5,7,10].map((v) => ({ label: `${v} min`, value: v })),
    longBreakMinutes:  [10,15,20,25,30].map((v) => ({ label: `${v} min`, value: v })),
    longBreakAfter:    [2,3,4,5,6].map((v) => ({ label: `${v} rounds`, value: v })),
  };

  const POMO_LABELS = {
    focusMinutes:      'Focus Duration',
    shortBreakMinutes: 'Short Break',
    longBreakMinutes:  'Long Break',
    longBreakAfter:    'Long Break After',
  };

  const openPicker = (key) => {
    setPickerTarget(key);
    setPickerVisible(true);
  };

  const handlePomoSelect = (value) => {
    if (!pickerTarget) return;
    setPomoConfig({ [pickerTarget]: value });
    updatePreferences({ [pickerTarget]: value }).catch(() => {});
  };

  // Load persisted settings on mount
  useEffect(() => {
    // Show cached settings instantly while the network request is in-flight
    AsyncStorage.getItem(SETTINGS_KEY).then((raw) => {
      if (raw) setSettings(prev => ({ ...prev, ...JSON.parse(raw) }));
    }).catch(() => {});

    // Backend is source of truth — overwrite cache on success
    getPreferences().then((prefs) => {
      if (!prefs) return;
      const backendSettings = {
        pushNotifs:        prefs.notificationsEnabled,
        reminders:         prefs.studyReminders,
        groupActivity:     prefs.groupActivityAlerts,
        achievements:      prefs.achievementAlerts,
        hideDigits:        prefs.hideTimerDigits,
        motivational:      prefs.motivationalQuotes,
        pomodoroSounds:    prefs.pomodoroSounds,
        shareAnalytics:    prefs.shareAnalytics,
        profilePublic:     prefs.profilePublic,
        showInLeaderboard: prefs.showInLeaderboard,
        shareStudyStats:   prefs.shareStudyStats,
      };
      setSettings(prev => {
        const safeBackend = Object.fromEntries(
          Object.entries(backendSettings).filter(([k]) => !touchedKeys.current.has(k))
        );
        const next = { ...prev, ...safeBackend };
        AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next)).catch(() => {});
        return next;
      });
      if (prefs.reminderTime) {
        const [h, m] = prefs.reminderTime.split(':').map(Number);
        setReminderTime({ hours: h, minutes: m });
      }
      if (prefs.focusMinutes != null) {
        setPomoConfig({
          focusMinutes:      prefs.focusMinutes,
          shortBreakMinutes: prefs.shortBreakMinutes,
          longBreakMinutes:  prefs.longBreakMinutes,
          longBreakAfter:    prefs.longBreakAfter,
          autoStartBreaks:   prefs.autoStartBreaks,
        });
      }
      if (prefs.accentColor && ACCENT_COLORS[prefs.accentColor]) {
        setAccent(prefs.accentColor);
      }
    }).catch(() => {});
  }, []);

  const toTimeString = (t) =>
    `${String(t.hours).padStart(2, '0')}:${String(t.minutes).padStart(2, '0')}`;

  // Toggle a setting and persist immediately
  const toggle = (key) => {
    const newValue = !settings[key];
    setSettings((prev) => {
      const next = { ...prev, [key]: newValue };
      touchedKeys.current.add(key);
      AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next)).catch(() => {});
      const backendField = BACKEND_KEY_MAP[key];
      if (backendField) {
        updatePreferences({ [backendField]: newValue }).catch(() => {});
        // Keep useUserStore.preferences in sync so notification checks read fresh values
        useUserStore.getState().setPreferences({ [backendField]: newValue });
      }
      return next;
    });
    // Notification side effects
    if (key === 'pushNotifs') {
      if (!newValue) {
        Notifications.cancelAllScheduledNotificationsAsync().catch(() => {});
      } else if (settings.reminders) {
        scheduleDailyReminder(toTimeString(reminderTime)).catch(() => {});
      }
    } else if (key === 'reminders') {
      if (!newValue) {
        cancelDailyReminder().catch(() => {});
      } else {
        scheduleDailyReminder(toTimeString(reminderTime)).catch(() => {});
      }
    }
  };

  const handleReminderTimeChange = (newTime) => {
    setReminderTime(newTime);
    const timeStr = toTimeString(newTime);
    if (settings.reminders) {
      scheduleDailyReminder(timeStr).catch(() => {});
    }
    updatePreferences({ reminderTime: timeStr }).catch(() => {});
    useUserStore.getState().setPreferences({ reminderTime: timeStr });
  };

  const handleRateApp = () => {
    Linking.openURL('https://play.google.com/store/apps/details?id=com.anonymous.StudyTrack').catch(() => {});
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try { await signOut(); } catch (_) {}
          reset();
          navigation.reset({ index: 0, routes: [{ name: 'Auth' }] });
        },
      },
    ]);
  };

  const insets = useSafeAreaInsets();
  const { theme: activeTheme, colors, setTheme, accent, setAccent } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.accentPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* User profile row */}
        <View style={styles.profileRow}>
          <View style={styles.profileLeft}>
            <View style={styles.profileAvatar}>
              <Text style={styles.profileInitial}>{avatar || name?.[0] || 'S'}</Text>
            </View>
            <View>
              <Text style={styles.profileName}>{name}</Text>
              <Text style={styles.profileHandle}>{handle}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.editProfileBtn}>
            <Text style={styles.editProfileText}>Edit profile</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.accentPrimary} />
          </TouchableOpacity>
        </View>

        {/* ── NOTIFICATIONS ── */}
        <Text style={styles.sectionHeader} onLayout={handleNotifsLayout}>NOTIFICATIONS</Text>
        <View style={styles.card}>
          <SettingsRow
            icon="notifications-outline"
            label="Push"
            right={<Toggle on={settings.pushNotifs} onPress={() => toggle('pushNotifs')} />}
          />
          <TouchableOpacity onPress={() => setShowReminderPicker(true)}>
            <SettingsRow
              icon="alarm-outline"
              label="Reminders"
              right={
                <View style={styles.rowRightGroup}>
                  <Text style={styles.valueText}>
                    {formatTime12h(reminderTime.hours, reminderTime.minutes)}
                  </Text>
                  <Toggle on={settings.reminders} onPress={() => toggle('reminders')} />
                </View>
              }
            />
          </TouchableOpacity>
          <SettingsRow
            icon="people-outline"
            label="Group Activity"
            right={<Toggle on={settings.groupActivity} onPress={() => toggle('groupActivity')} />}
          />
          <SettingsRow
            icon="trophy-outline"
            label="Achievement Alerts"
            right={<Toggle on={settings.achievements} onPress={() => toggle('achievements')} />}
            borderBottom={false}
          />
        </View>

        {/* ── FOCUS MODE ── */}
        <Text style={styles.sectionHeader}>FOCUS MODE</Text>
        <View style={styles.card}>
          <SettingsRow
            icon="scan-outline"
            label="Focus Mode"
            right={<Toggle on={settings.focusMode} onPress={() => toggle('focusMode')} />}
          />
          <SettingsRow
            icon="sunny-outline"
            label="Keep Awake"
            right={<Toggle on={settings.keepAwake} onPress={() => toggle('keepAwake')} />}
          />
          {/* Row with subtitle */}
          <View style={[styles.row, styles.rowBorder]}>
            <View style={styles.rowLeftColumn}>
              <View style={styles.rowLeft}>
                <Ionicons name="eye-off-outline" size={20} color={colors.accentLight} />
                <Text style={styles.rowLabel}>Hide Timer Digits</Text>
              </View>
              <Text style={styles.rowSubtitle}>Reduce pressure by hiding numerical countdown</Text>
            </View>
            <Toggle on={settings.hideDigits} onPress={() => toggle('hideDigits')} />
          </View>
          <View style={[styles.row]}>
            <View style={styles.rowLeftColumn}>
              <View style={styles.rowLeft}>
                <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.accentLight} />
                <Text style={styles.rowLabel}>Motivational Quotes</Text>
              </View>
              <Text style={styles.rowSubtitle}>Display inspiring messages during sessions</Text>
            </View>
            <Toggle on={settings.motivational} onPress={() => toggle('motivational')} />
          </View>
        </View>

        {/* ── POMODORO ── */}
        <Text style={styles.sectionHeader} onLayout={handlePomoLayout}>POMODORO</Text>
        <View style={styles.card}>
          <SettingsRow
            icon="timer-outline"
            label="Pomodoro Mode"
            right={<Toggle on={settings.pomodoroMode} onPress={() => toggle('pomodoroMode')} />}
          />
          {[
            { key: 'focusMinutes',      icon: 'time-outline',    label: 'Focus Duration' },
            { key: 'shortBreakMinutes', icon: 'cafe-outline',    label: 'Short Break' },
            { key: 'longBreakMinutes',  icon: 'moon-outline',    label: 'Long Break' },
            { key: 'longBreakAfter',    icon: 'refresh-outline', label: 'Long Break After' },
          ].map(({ key, icon, label }) => (
            <TouchableOpacity key={key} onPress={() => openPicker(key)}>
              <SettingsRow
                icon={icon}
                label={label}
                right={
                  <View style={styles.rowRightGroup}>
                    <Text style={styles.valueText}>
                      {key === 'longBreakAfter'
                        ? `${pomoConfig[key]} rounds`
                        : `${pomoConfig[key]} min`}
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                  </View>
                }
              />
            </TouchableOpacity>
          ))}
          <SettingsRow
            icon="musical-notes-outline"
            label="Sound"
            right={<Toggle on={settings.pomodoroSounds} onPress={() => toggle('pomodoroSounds')} />}
            borderBottom={false}
          />
        </View>

        {/* Pomodoro picker */}
        <BottomSheetPicker
          visible={pickerVisible}
          title={pickerTarget ? POMO_LABELS[pickerTarget] : ''}
          options={pickerTarget ? POMO_OPTIONS[pickerTarget] ?? [] : []}
          selectedValue={pickerTarget ? pomoConfig[pickerTarget] : null}
          onSelect={handlePomoSelect}
          onClose={() => setPickerVisible(false)}
        />

        {/* Reminder time picker */}
        <TimePickerModal
          visible={showReminderPicker}
          value={reminderTime}
          onChange={handleReminderTimeChange}
          onClose={() => setShowReminderPicker(false)}
        />

        {/* ── APP BLOCKER ── */}
        <Text style={styles.sectionHeader}>APP BLOCKER</Text>
        <View style={styles.card}>
          <SettingsRow
            icon="ban-outline"
            label="Enable Blocker"
            right={<Toggle on={settings.appBlocker} onPress={() => toggle('appBlocker')} />}
          />
          {/* Strict Mode — danger row */}
          <View style={[styles.row, styles.strictRow]}>
            <View style={styles.strictAccentBar} />
            <View style={styles.rowLeftColumn}>
              <View style={styles.rowLeft}>
                <Ionicons name="lock-closed" size={20} color={colors.danger} />
                <Text style={[styles.rowLabel, { color: colors.dangerLight }]}>Strict Mode</Text>
              </View>
              <Text style={styles.rowSubtitle}>Prevents disabling focus once started</Text>
            </View>
            <Toggle on={settings.strictMode} onPress={() => toggle('strictMode')} />
          </View>
        </View>

        {/* ── APPEARANCE ── */}
        <Text style={styles.sectionHeader}>APPEARANCE</Text>
        <View style={styles.card}>
          <SettingsRow
            icon="moon-outline"
            label="Theme"
            right={
              <View style={styles.themeSegment}>
                <TouchableOpacity
                  style={activeTheme === 'dark' ? styles.themeSegmentActive : styles.themeSegmentInactive}
                  onPress={() => setTheme('dark')}
                >
                  <Text style={activeTheme === 'dark' ? styles.themeSegmentActiveText : styles.themeSegmentInactiveText}>
                    Dark
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={activeTheme === 'light' ? styles.themeSegmentActive : styles.themeSegmentInactive}
                  onPress={() => setTheme('light')}
                >
                  <Text style={activeTheme === 'light' ? styles.themeSegmentActiveText : styles.themeSegmentInactiveText}>
                    Light
                  </Text>
                </TouchableOpacity>
              </View>
            }
          />
          <SettingsRow
            icon="color-palette-outline"
            label="Accent Color"
            right={
              <View style={styles.accentSwatchRow}>
                {Object.entries(ACCENT_COLORS).map(([key, { primary }]) => (
                  <TouchableOpacity
                    key={key}
                    onPress={() => setAccent(key)}
                    activeOpacity={0.8}
                    accessibilityLabel={`${key} accent color`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: accent === key }}
                    style={[
                      styles.accentSwatchCircle,
                      { backgroundColor: primary },
                      accent === key && styles.accentSwatchSelected,
                    ]}
                  >
                    {accent === key && (
                      <Ionicons name="checkmark" size={12} color="#fff" />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            }
            borderBottom={false}
          />
        </View>

        {/* ── DATA & PRIVACY ── */}
        <Text style={styles.sectionHeader} onLayout={handlePrivacyLayout}>DATA & PRIVACY</Text>
        <View style={styles.card}>
          <SettingsRow
            icon="cloud-outline"
            label="Sync Across Devices"
            right={<Toggle on={settings.syncDevices} onPress={() => toggle('syncDevices')} />}
          />
          <TouchableOpacity>
            <SettingsRow
              icon="download-outline"
              label="Backup Study Data"
              right={
                <View style={styles.rowRightGroup}>
                  <Text style={styles.mutedText}>Last: Today</Text>
                  <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
                </View>
              }
            />
          </TouchableOpacity>
          <TouchableOpacity>
            <SettingsRow
              icon="share-outline"
              label="Export My Data"
              right={<Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />}
            />
          </TouchableOpacity>
          {/* Share Analytics — with subtitle */}
          <View style={[styles.row, styles.rowBorder]}>
            <View style={styles.rowLeftColumn}>
              <View style={styles.rowLeft}>
                <Ionicons name="bar-chart-outline" size={20} color={colors.accentLight} />
                <Text style={styles.rowLabel}>Share Analytics</Text>
              </View>
              <Text style={styles.rowSubtitle}>Help improve StudyTrack anonymously</Text>
            </View>
            <Toggle on={settings.shareAnalytics} onPress={() => toggle('shareAnalytics')} />
          </View>
          {/* Profile Public */}
          <View style={[styles.row, styles.rowBorder]}>
            <View style={styles.rowLeftColumn}>
              <View style={styles.rowLeft}>
                <Ionicons name="person-circle-outline" size={20} color={colors.accentLight} />
                <Text style={styles.rowLabel}>Public Profile</Text>
              </View>
              <Text style={styles.rowSubtitle}>Allow others to view your profile</Text>
            </View>
            <Toggle on={settings.profilePublic} onPress={() => toggle('profilePublic')} />
          </View>
          {/* Show in Leaderboard */}
          <View style={[styles.row, styles.rowBorder]}>
            <View style={styles.rowLeftColumn}>
              <View style={styles.rowLeft}>
                <Ionicons name="podium-outline" size={20} color={colors.accentLight} />
                <Text style={styles.rowLabel}>Show in Leaderboard</Text>
              </View>
              <Text style={styles.rowSubtitle}>Appear in group leaderboards</Text>
            </View>
            <Toggle on={settings.showInLeaderboard} onPress={() => toggle('showInLeaderboard')} />
          </View>
          {/* Share Study Stats */}
          <View style={[styles.row, styles.rowBorder]}>
            <View style={styles.rowLeftColumn}>
              <View style={styles.rowLeft}>
                <Ionicons name="stats-chart-outline" size={20} color={colors.accentLight} />
                <Text style={styles.rowLabel}>Share Study Stats</Text>
              </View>
              <Text style={styles.rowSubtitle}>Let group members see your study time</Text>
            </View>
            <Toggle on={settings.shareStudyStats} onPress={() => toggle('shareStudyStats')} />
          </View>
          <TouchableOpacity>
            <SettingsRow
              icon="shield-outline"
              label="Privacy Policy"
              right={<Ionicons name="open-outline" size={16} color={colors.textSecondary} />}
            />
          </TouchableOpacity>
          <TouchableOpacity>
            <SettingsRow
              icon="document-text-outline"
              label="Terms of Service"
              right={<Ionicons name="open-outline" size={16} color={colors.textSecondary} />}
              borderBottom={false}
            />
          </TouchableOpacity>
        </View>

        {/* ── ACCOUNT ── */}
        <Text style={styles.sectionHeader}>ACCOUNT</Text>
        <View style={styles.card}>
          <TouchableOpacity>
            <SettingsRow
              icon="mail-outline"
              label="Change Email"
              right={<Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />}
            />
          </TouchableOpacity>
          {/* Delete Account — danger row */}
          <TouchableOpacity>
            <View style={[styles.row, styles.deleteRow]}>
              <View style={styles.deleteAccentBar} />
              <View style={styles.rowLeftColumn}>
                <View style={styles.rowLeft}>
                  <Ionicons name="trash-outline" size={20} color={colors.danger} />
                  <Text style={[styles.rowLabel, { color: colors.danger }]}>Delete Account</Text>
                </View>
                <Text style={styles.rowSubtitle}>This will permanently erase all focus data</Text>
              </View>
            </View>
          </TouchableOpacity>
        </View>

        {/* ── APP INFO ── */}
        <Text style={styles.sectionHeader}>APP INFO</Text>
        <View style={styles.card}>
          <SettingsRow
            icon="information-circle-outline"
            label="Version"
            right={<Text style={styles.mutedText}>{APP_VERSION}</Text>}
          />
          <TouchableOpacity onPress={() => setShowWhatsNew(true)}>
            <SettingsRow
              icon="sparkles-outline"
              label="What's New"
              right={<Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleRateApp}>
            <SettingsRow
              icon="star-outline"
              label="Rate StudyTrack"
              right={<Ionicons name="open-outline" size={16} color={colors.textSecondary} />}
              borderBottom={false}
            />
          </TouchableOpacity>
        </View>

        {/* What's New modal */}
        <Modal
          visible={showWhatsNew}
          transparent
          animationType="fade"
          onRequestClose={() => setShowWhatsNew(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>What's New</Text>
                <TouchableOpacity onPress={() => setShowWhatsNew(false)}>
                  <Ionicons name="close" size={22} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              {CHANGELOG.map((entry) => (
                <View key={entry.version} style={styles.changelogEntry}>
                  <Text style={styles.changelogVersion}>v{entry.version}</Text>
                  {entry.items.map((item, i) => (
                    <Text key={i} style={styles.changelogItem}>• {item}</Text>
                  ))}
                </View>
              ))}
            </View>
          </View>
        </Modal>

        {/* Sign Out button */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={20} color={colors.danger} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}
