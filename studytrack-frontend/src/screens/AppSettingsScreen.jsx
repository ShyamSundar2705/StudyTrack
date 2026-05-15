import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../constraints/theme';
import { useTheme } from '../context/ThemeContext';
import useUserStore from '../store/useUserStore';
import usePomodoroStore from '../store/usePomodoroStore';
import { signOut, getPreferences, updatePreferences } from '../api/users';
import BottomSheetPicker from '../components/BottomSheetPicker';
import TimePickerModal from '../components/TimePickerModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleDailyReminder, cancelDailyReminder } from '../utils/notifications';
import { formatTime12h } from '../utils/dateTime';

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
  syncDevices:    true,
  shareAnalytics: true,
};

const BACKEND_KEY_MAP = {
  pushNotifs:     'notificationsEnabled',
  reminders:      'studyReminders',
  groupActivity:  'groupActivityAlerts',
  achievements:   'achievementAlerts',
  hideDigits:     'hideTimerDigits',
  motivational:   'motivationalQuotes',
  pomodoroSounds: 'pomodoroSounds',
  shareAnalytics: 'shareAnalytics',
};

// Interactive toggle
const Toggle = ({ on, onPress }) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
    <View style={[styles.toggleTrack, on && styles.toggleTrackOn]}>
      <View style={[styles.toggleKnob, on && styles.toggleKnobOn]} />
    </View>
  </TouchableOpacity>
);

// Standard settings row with left icon + label + right content
const SettingsRow = ({ icon, iconColor = colors.accentLight, label, right, borderBottom = true, rowStyle }) => (
  <View style={[styles.row, borderBottom && styles.rowBorder, rowStyle]}>
    <View style={styles.rowLeft}>
      <Ionicons name={icon} size={20} color={iconColor} />
      <Text style={styles.rowLabel}>{label}</Text>
    </View>
    {right}
  </View>
);

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
  const touchedKeys = useRef(new Set());
  const scrollRef   = useRef(null);
  const pomoY       = useRef(0);

  const handlePomoLayout = (e) => {
    pomoY.current = e.nativeEvent.layout.y;
    if (route.params?.scrollToPomo) {
      setTimeout(() => {
        scrollRef.current?.scrollTo({ y: pomoY.current - spacing.xl, animated: true });
      }, 200);
    }
  };

  const POMO_OPTIONS = {
    focusMinutes:      [1,15,20,25,30,35,40,45,50,55,60].map((v) => ({ label: `${v} min`, value: v })),
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
        pushNotifs:     prefs.notificationsEnabled,
        reminders:      prefs.studyReminders,
        groupActivity:  prefs.groupActivityAlerts,
        achievements:   prefs.achievementAlerts,
        hideDigits:     prefs.hideTimerDigits,
        motivational:   prefs.motivationalQuotes,
        pomodoroSounds: prefs.pomodoroSounds,
        shareAnalytics: prefs.shareAnalytics,
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
  const { theme: activeTheme, setTheme } = useTheme();

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
        <Text style={styles.sectionHeader}>NOTIFICATIONS</Text>
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
              <View style={styles.accentSwatch} />
            }
            borderBottom={false}
          />
        </View>

        {/* ── DATA & PRIVACY ── */}
        <Text style={styles.sectionHeader}>DATA & PRIVACY</Text>
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

        {/* App Info footer */}
        <View style={styles.appInfo}>
          <Text style={styles.appVersion}>StudyTrack v2.4.1</Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((i) => (
              <Ionicons key={i} name="star" size={18} color={colors.gold} />
            ))}
          </View>
          <TouchableOpacity style={styles.whatsNewBtn}>
            <Text style={styles.whatsNewText}>What's New in this version</Text>
            <Ionicons name="open-outline" size={14} color={colors.accentPrimary} />
          </TouchableOpacity>
        </View>

        {/* Sign Out button */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={20} color={colors.danger} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.accentPrimary,
  },

  /* Scroll */
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl },

  /* Profile row */
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  profileLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  profileAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInitial: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  profileName: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  profileHandle: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  editProfileText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.accentPrimary,
  },

  /* Section header */
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
    marginTop: spacing.xl,
    paddingLeft: 2,
  },

  /* Card */
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },

  /* Standard row */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 52,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowLeftColumn: {
    flex: 1,
    gap: 4,
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  rowSubtitle: {
    fontSize: 11,
    color: colors.textSecondary,
    marginLeft: 36, // icon width + gap
    lineHeight: 15,
  },
  rowRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  valueText: {
    fontSize: 13,
    color: colors.accentLight,
  },
  mutedText: {
    fontSize: 12,
    color: colors.textSecondary,
  },

  /* Toggle */
  toggleTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.border,
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  toggleTrackOn: {
    backgroundColor: colors.accentPrimary,
  },
  toggleKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.textPrimary,
    alignSelf: 'flex-start',
  },
  toggleKnobOn: {
    alignSelf: 'flex-end',
  },

  /* Strict Mode row */
  strictRow: {
    backgroundColor: 'rgba(231,76,60,0.06)',
    paddingLeft: 0,
    paddingRight: spacing.lg,
    position: 'relative',
  },
  strictAccentBar: {
    width: 3,
    alignSelf: 'stretch',
    backgroundColor: colors.danger,
    marginRight: spacing.lg,
  },

  /* Theme segment */
  themeSegment: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceDeep,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.accentPrimary,
    padding: 3,
  },
  themeSegmentActive: {
    width: 44,
    height: 26,
    backgroundColor: colors.surface,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeSegmentActiveText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  themeSegmentInactive: {
    width: 44,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeSegmentInactiveText: {
    fontSize: 12,
    color: colors.textSecondary,
  },

  /* Accent swatch */
  accentSwatch: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.accentPrimary,
    borderWidth: 2,
    borderColor: colors.border,
  },

  /* Delete Account row */
  deleteRow: {
    paddingLeft: 0,
    paddingRight: spacing.lg,
  },
  deleteAccentBar: {
    width: 3,
    alignSelf: 'stretch',
    backgroundColor: colors.danger,
    marginRight: spacing.lg,
  },

  /* App Info */
  appInfo: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    gap: spacing.sm,
  },
  appVersion: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  starsRow: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 4,
  },
  whatsNewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.sm,
  },
  whatsNewText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.accentPrimary,
  },

  /* Sign Out */
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
    backgroundColor: colors.surfaceDeep,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    paddingVertical: spacing.lg,
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.danger,
  },


});
