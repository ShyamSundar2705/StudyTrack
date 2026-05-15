import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../constraints/theme';
import { getMe, getStats } from '../api/users';
import api, { TOKEN_KEY } from '../api/client';
import supabase from '../api/supabase';
import useUserStore    from '../store/useUserStore';
import useSubjectStore from '../store/useSubjectStore';
import useSessionStore from '../store/useSessionStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import EditProfileSheet from '../components/EditProfileSheet';
import AchievementModal from '../components/AchievementModal';
import { shareProfile } from '../utils/shareStats';
import { ACHIEVEMENT_META } from '../constants/achievements';

const DEFAULT_LIFETIME = [
  { icon: 'time-outline',     value: '1,248', label: 'Total Hours' },
  { icon: 'reload-outline',   value: '412',   label: 'Sessions'    },
  { icon: 'layers-outline',   value: '8',     label: 'Subjects'    },
  { icon: 'calendar-outline', value: '184',   label: 'Days Active' },
];

const ACCOUNT_ROWS = [
  { icon: 'notifications-outline', label: 'Notifications',    danger: false },
  { icon: 'alarm-outline',          label: 'Reminders',        danger: false },
  { icon: 'shield-outline',         label: 'Privacy & Security', danger: false },
];

export default function ProfileScreen({ navigation }) {
  const { width: windowWidth } = useWindowDimensions();
  // card inner width = window - 2×scrollH padding - 2×card padding - 2×border
  const achievementItemWidth = (windowWidth - 2 * spacing.xl - 2 * spacing.xl - 2 - 3 * spacing.sm) / 4;

  const name             = useUserStore((s) => s.name);
  const handle           = useUserStore((s) => s.handle);
  const avatar           = useUserStore((s) => s.avatar);
  const streak           = useUserStore((s) => s.streak);
  const dailyGoalSeconds = useUserStore((s) => s.dailyGoalSeconds);
  const storeUser        = { name, handle, avatar, streak, dailyGoalSeconds };
  const setUser       = useUserStore((s) => s.setUser);
  const insets        = useSafeAreaInsets();
  const storeSubjects = useSubjectStore((s) => s.subjects);
  const todaySessions = useSessionStore((s) => s.todaySessions);
  const todayTotal    = todaySessions.reduce((sum, s) => sum + s.elapsedSeconds, 0);

  const [profile,  setProfile]  = useState(null);
  const [lifetime, setLifetime] = useState(DEFAULT_LIFETIME);
  const [loading,  setLoading]  = useState(false);
  const [profileUser,         setProfileUser]         = useState(null);
  const [showEditSheet,       setShowEditSheet]       = useState(false);
  const [selectedAchievement, setSelectedAchievement] = useState(null);
  const [achievements,        setAchievements]        = useState([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [user, stats, achRes] = await Promise.all([
          getMe(),
          getStats(),
          api.get('/users/me/achievements').then(r => r.data.data?.achievements ?? []).catch(() => []),
        ]);
        if (!cancelled) {
          setUser(user);
          setProfile(user);
          setProfileUser(user);
          setAchievements(achRes);
          if (stats) {
            setLifetime([
              { icon: 'time-outline',     value: String(stats.totalHours ?? user.totalHours), label: 'Total Hours' },
              { icon: 'reload-outline',   value: String(stats.totalSessions ?? 412),           label: 'Sessions'    },
              { icon: 'layers-outline',   value: String(stats.totalSubjects ?? 8),             label: 'Subjects'    },
              { icon: 'calendar-outline', value: String(stats.daysActive ?? 184),              label: 'Days Active' },
            ]);
          }
        }
      } catch (_) {}
      finally { if (!cancelled) setLoading(false); }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const resetUser     = useUserStore((s) => s.reset);
  const setSubjects   = useSubjectStore((s) => s.setSubjects);
  const setTodaySessions = useSessionStore((s) => s.setTodaySessions);

  const handleProfileSaved = (updatedUser) => {
    setProfileUser(updatedUser);
    setProfile(updatedUser);
  };

  const handleShareProfile = async () => {
    const statsRes = await api.get('/users/me/stats')
      .then(r => r.data.data?.stats ?? null)
      .catch(() => null);
    const { name: storeName, handle: storeHandle } = useUserStore.getState();
    await shareProfile({
      name:          profileUser?.name ?? storeName,
      handle:        profileUser?.handle ?? storeHandle,
      totalSeconds:  statsRes?.totalSeconds ?? 0,
      totalSessions: statsRes?.totalSessions ?? 0,
      currentStreak: useUserStore.getState().streak ?? 0,
      subjectCount:  statsRes?.totalSubjects ?? 0,
      topSubject:    statsRes?.topSubject ?? null,
    });
  };

  const handleSignOut = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          await SecureStore.deleteItemAsync(TOKEN_KEY);
          resetUser();
          setSubjects([]);
          setTodaySessions([]);
          navigation.reset({ index: 0, routes: [{ name: 'Auth' }] });
        },
      },
    ]);
  };

  const user     = profile ?? storeUser;
  const subjects = storeSubjects.map((s) => ({
    id:    s.id,
    name:  s.name,
    hours: `${(s.totalSeconds / 3600).toFixed(1)} hrs`,
    color: s.color,
  }));

  // Daily goal progress
  const goalPct    = Math.min(Math.round((todayTotal / (user.dailyGoalSeconds ?? 21600)) * 100), 100);
  const totalFmt   = (() => { const h = Math.floor(todayTotal / 3600); const m = Math.floor((todayTotal % 3600) / 60); return `${h}h ${m}m`; })();
  const goalFmt    = (() => { const h = Math.floor((user.dailyGoalSeconds ?? 21600) / 3600); return `${h}h`; })();

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.accentPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.iconBtn} onPress={handleShareProfile}>
            <Ionicons name="share-outline" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.iconBtn, { marginLeft: spacing.sm }]} onPress={() => navigation.navigate('AppSettings')}>
            <Ionicons name="settings-outline" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Identity Card */}
        <View style={styles.identityCard}>
          {/* Decorative circle top-right */}
          <View style={styles.identityDecorCircle} />

          <View style={styles.identityRow}>
            {/* Initial avatar */}
            <View style={[styles.avatarCircle, { backgroundColor: user.avatarColor ?? 'rgba(255,255,255,0.2)' }]}>
              <Text style={styles.avatarInitial}>{(user.name?.[0] ?? 'S').toUpperCase()}</Text>
            </View>
            <View style={styles.identityInfo}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                <Text style={styles.identityName}>{user.name}</Text>
                {loading && <ActivityIndicator color="rgba(255,255,255,0.7)" size="small" />}
              </View>
              <Text style={styles.identityHandle}>@{user.handle}</Text>
              <Text style={styles.identityMember}>Member since Sept 2023</Text>
            </View>
          </View>

          {/* Streak pill */}
          <View style={styles.streakPill}>
            <View style={styles.streakLeft}>
              <Ionicons name="flame" size={18} color={colors.warning} />
              <Text style={styles.streakText}>{user.streak} Day Streak</Text>
            </View>
            <Text style={styles.streakSub}>Keep it up!</Text>
          </View>

          {/* Edit profile pill */}
          <TouchableOpacity
            style={styles.editProfilePill}
            onPress={() => setShowEditSheet(true)}
          >
            <Ionicons name="pencil-outline" size={14} color={colors.textPrimary} />
            <Text style={styles.editProfilePillText}>Edit profile</Text>
          </TouchableOpacity>
        </View>

        {/* Today's Progress */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Today's Progress</Text>
          <Text style={styles.progressPct}>{goalPct}%</Text>
        </View>
        <View style={styles.progressCard}>
          <View style={styles.progressLabelRow}>
            <Text style={styles.progressLabel}>Focus Time</Text>
            <Text style={styles.progressValue}>{totalFmt} / {goalFmt}</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${goalPct}%` }]} />
          </View>
        </View>

        {/* Lifetime Stats */}
        <Text style={[styles.sectionTitle, { marginTop: spacing.xl, marginBottom: spacing.md }]}>
          Lifetime Stats
        </Text>
        <View style={styles.statsGrid}>
          <View style={styles.statsVDivider} />
          <View style={styles.statsHDivider} />

          {lifetime.map((s, idx) => (
            <View key={s.label} style={styles.statCell}>
              <Ionicons name={s.icon} size={20} color={colors.accentPrimary} />
              <View>
                <Text style={styles.statValue}>{s.value}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Subjects Overview */}
        <View style={[styles.sectionHeader, { marginTop: spacing.xl }]}>
          <Text style={styles.sectionTitle}>Subjects Overview</Text>
          <TouchableOpacity>
            <Text style={styles.editBtn}>Edit</Text>
          </TouchableOpacity>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.subjectsRow}
        >
          {subjects.map((s) => (
            <TouchableOpacity
              key={s.name}
              style={styles.subjectCard}
              activeOpacity={0.7}
              onPress={() => navigation.push('SubjectDetails', { subjectId: s.id })}
            >
              {/* Colored left accent bar */}
              <View style={[styles.subjectAccentBar, { backgroundColor: s.color }]} />
              <Text style={styles.subjectName}>{s.name}</Text>
              <Text style={styles.subjectHours}>{s.hours}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Achievements */}
        <Text style={[styles.sectionTitle, { marginTop: spacing.xl, marginBottom: spacing.md }]}>
          Achievements
        </Text>
        {(() => {
          const unlockedTypes = new Set(achievements.map(a => a.type));
          const allTypes = Object.keys(ACHIEVEMENT_META);
          const unlockedItems = achievements
            .filter(a => ACHIEVEMENT_META[a.type])
            .map(a => ({ ...ACHIEVEMENT_META[a.type], type: a.type, unlockedAt: a.unlockedAt, unlocked: true }));
          const lockedItems = allTypes
            .filter(t => !unlockedTypes.has(t))
            .map(t => ({ ...ACHIEVEMENT_META[t], type: t, unlockedAt: null, unlocked: false }));
          const allDisplay = [...unlockedItems, ...lockedItems];
          const visibleAchievements = allDisplay.slice(0, 8);
          const remaining = allDisplay.length - visibleAchievements.length;

          return (
            <View style={styles.achievementsCard}>
              <View style={styles.achievementsGrid}>
                {visibleAchievements.map((a) => (
                  <TouchableOpacity
                    key={a.id}
                    style={[styles.achievementItem, { width: achievementItemWidth }]}
                    onPress={() => setSelectedAchievement(a)}
                    activeOpacity={0.7}
                  >
                    <View style={[
                      styles.achievementCircle,
                      a.unlocked
                        ? { backgroundColor: `${a.iconColor}26`, borderColor: a.iconColor }
                        : { backgroundColor: colors.surfaceDeep, borderColor: 'transparent' },
                    ]}>
                      {a.unlocked
                        ? <Ionicons name={a.icon} size={22} color={a.iconColor} />
                        : <Ionicons name="lock-closed" size={18} color={colors.textSecondary} style={{ opacity: 0.3 }} />
                      }
                    </View>
                    <Text style={a.unlocked ? styles.achievementLabel : styles.achievementLabelLocked}>
                      {a.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {remaining > 0 && (
                <TouchableOpacity style={styles.seeAllRow}>
                  <Text style={styles.seeAllText}>See all ({allDisplay.length}) →</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })()}

        {/* Account Settings */}
        <Text style={[styles.sectionTitle, { marginTop: spacing.xl, marginBottom: spacing.md }]}>
          Account
        </Text>
        <View style={styles.accountCard}>
          {ACCOUNT_ROWS.map((row, idx) => (
            <TouchableOpacity
              key={row.label}
              style={[styles.accountRow, idx < ACCOUNT_ROWS.length - 1 && styles.accountRowBorder]}
              activeOpacity={0.7}
            >
              <View style={styles.accountRowLeft}>
                <Ionicons name={row.icon} size={20} color={colors.textSecondary} />
                <Text style={styles.accountRowLabel}>{row.label}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          ))}

          {/* Sign Out */}
          <TouchableOpacity style={styles.signOutRow} activeOpacity={0.7} onPress={handleSignOut}>
            <Ionicons name="log-out-outline" size={20} color={colors.danger} />
            <Text style={styles.signOutLabel}>Sign Out</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>

      <EditProfileSheet
        visible={showEditSheet}
        user={profile}
        onClose={() => setShowEditSheet(false)}
        onSaved={handleProfileSaved}
      />
      <AchievementModal
        visible={selectedAchievement !== null}
        achievement={selectedAchievement}
        onClose={() => setSelectedAchievement(null)}
      />
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
    justifyContent: 'space-between',
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.accentPrimary,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* Scroll */
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: spacing.xl, paddingTop: spacing.xl },

  /* Identity Card */
  identityCard: {
    backgroundColor: colors.accentPrimary,
    borderRadius: radius.xl,
    padding: spacing.xl,
    overflow: 'hidden',
    position: 'relative',
  },
  identityDecorCircle: {
    position: 'absolute',
    top: -48,
    right: -48,
    width: 192,
    height: 192,
    borderRadius: 96,
    backgroundColor: colors.textPrimary,
    opacity: 0.1,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
    marginBottom: spacing.lg,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontSize: 36,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  identityInfo: {
    flex: 1,
  },
  identityName: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  identityHandle: {
    fontSize: 14,
    color: colors.textPrimary,
    opacity: 0.8,
    marginBottom: 4,
  },
  identityMember: {
    fontSize: 12,
    color: colors.textPrimary,
    opacity: 0.6,
  },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceBlue,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accentPrimary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  streakLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  streakText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  streakSub: {
    fontSize: 12,
    color: colors.textPrimary,
    opacity: 0.7,
  },

  /* Progress section */
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  progressPct: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.accentPrimary,
  },
  progressCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.xl,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  progressLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  progressValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  progressTrack: {
    height: 12,
    backgroundColor: colors.border,
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accentPrimary,
    borderRadius: 6,
  },

  /* Lifetime stats */
  statsGrid: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    overflow: 'hidden',
    flexDirection: 'row',
    flexWrap: 'wrap',
    position: 'relative',
  },
  statsVDivider: {
    position: 'absolute',
    left: '50%',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: colors.border,
    zIndex: 1,
  },
  statsHDivider: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: '50%',
    height: 1,
    backgroundColor: colors.border,
    zIndex: 1,
  },
  statCell: {
    width: '50%',
    height: 128,
    padding: spacing.lg,
    justifyContent: 'space-between',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },

  /* Subjects */
  editBtn: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.accentPrimary,
  },
  subjectsRow: {
    gap: spacing.md,
    paddingRight: spacing.xl,
  },
  subjectCard: {
    width: 140,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  subjectAccentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  subjectName: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
    marginLeft: spacing.xs,
  },
  subjectHours: {
    fontSize: 12,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },

  /* Achievements */
  achievementsCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.xl,
  },
  achievementsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'flex-start',
  },
  achievementItem: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  achievementCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  achievementLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  achievementLabelLocked: {
    fontSize: 10,
    fontWeight: '500',
    color: colors.textSecondary,
    textAlign: 'center',
    opacity: 0.5,
  },
  seeAllRow: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  seeAllText: {
    fontSize: 13,
    color: colors.accentPrimary,
    fontWeight: '600',
  },

  /* Edit Profile Pill */
  editProfilePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    marginTop: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  editProfilePillText: {
    fontSize: 13,
    color: colors.textPrimary,
  },

  /* Account */
  accountCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  accountRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  accountRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  accountRowLabel: {
    fontSize: 15,
    color: colors.textPrimary,
  },
  signOutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  signOutLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.danger,
  },


});
