import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
// TODO: useTheme() for dynamic theme support
import { colors, radius, spacing } from '../constraints/theme';

import { completeSession as apiCompleteSession, startSession as apiStartSession } from '../api/sessions';
import { shareSession } from '../utils/shareSession';
import useSessionStore from '../store/useSessionStore';
import useSubjectStore from '../store/useSubjectStore';
import useUserStore    from '../store/useUserStore';
import useTimerStore   from '../store/useTimerStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function fmtDuration(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export default function SessionCompleteScreen({ navigation, route }) {
  const { durationSeconds = 0, subjectId, subjectName, startedAt, endedAt, backendSessionId, note } = route.params ?? {};

  const subjects         = useSubjectStore((s) => s.subjects);
  const todaySessions    = useSessionStore((s) => s.todaySessions);
  const dailyGoalSeconds = useUserStore((s) => s.dailyGoalSeconds);
  const { startSession } = useSessionStore();
  const { startTimer }   = useTimerStore();

  const insets  = useSafeAreaInsets();
  const subject = subjects.find((s) => s.id === subjectId);

  // Today total including the just-finished session
  const todayTotal = todaySessions.reduce((sum, s) => sum + s.elapsedSeconds, 0);
  const goalPct    = Math.min(Math.round((todayTotal / dailyGoalSeconds) * 100), 100);

  // Subject breakdown from today's sessions
  const breakdown = subjects
    .map((sub) => {
      const secs = todaySessions
        .filter((s) => s.subjectId === sub.id)
        .reduce((sum, s) => sum + s.elapsedSeconds, 0);
      return { ...sub, secs };
    })
    .filter((sub) => sub.secs > 0)
    .map((sub) => ({ ...sub, pct: todayTotal > 0 ? Math.round((sub.secs / todayTotal) * 100) : 0 }));

  // Session ordinal (1st, 2nd, etc.)
  const sessionNum = todaySessions.length;
  const ordinal = (n) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return `#${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
  };

  // Persist session to backend
  const [saving, setSaving] = useState(true);
  useEffect(() => {
    if (!backendSessionId) { setSaving(false); return; }
    apiCompleteSession(backendSessionId, durationSeconds, note)
      .catch(() => {})
      .finally(() => setSaving(false));
  }, []);

  const handleHome = () => navigation.navigate('Main');

  const handleShare = async () => {
    const streak = useUserStore.getState().streak;
    await shareSession({
      durationSeconds,
      subjectName: subjectName ?? subject?.name ?? 'my subject',
      streak: streak ?? 0,
    });
  };

  const handleStartAnother = async () => {
    let newBackendSessionId = null;
    try {
      const result = await apiStartSession(subjectId);
      newBackendSessionId = result?.data?.session?.id ?? null;
    } catch (_) {}

    startSession(subjectId, newBackendSessionId);
    startTimer();
    navigation.replace('SessionActive');
  };

  return (
    <View style={styles.container}>
      {/* Background ambient glows */}
      <View style={styles.bgGlowTopRight} />
      <View style={styles.bgGlowBottomLeft} />

      {/* ── Header ────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <TouchableOpacity style={styles.headerBtn} onPress={handleHome}>
          <Ionicons name="close" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Text style={styles.headerTitle}>Session Complete</Text>
          {saving && <ActivityIndicator color={colors.accentPrimary} size="small" />}
        </View>
        <TouchableOpacity style={styles.headerBtn} onPress={handleShare}>
          <Ionicons name="share-outline" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: spacing.xl + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Celebration ─────────────────────────────────── */}
        <View style={styles.celebration}>
          <View style={styles.checkCircle}>
            <Ionicons name="checkmark-circle" size={48} color={colors.accentPrimary} />
          </View>
          <Text style={styles.celebTitle}>Great work!</Text>
          <Text style={styles.celebSub}>
            {subject?.name ?? 'Session'} • Focus Session
          </Text>
        </View>

        {/* ── Primary stat card ───────────────────────────── */}
        <View style={styles.statCard}>
          <View style={styles.statCardTop}>
            <Text style={styles.statCardLabel}>TOTAL DURATION</Text>
            <Text style={styles.statCardDuration}>{fmtDuration(durationSeconds)}</Text>
          </View>

          <View style={styles.statCardDivider} />

          <View style={styles.statCardRow}>
            <View style={styles.statCardCol}>
              <Text style={styles.statMeta}>Started</Text>
              <Text style={styles.statMetaValue}>{startedAt ? fmtTime(startedAt) : '—'}</Text>
            </View>
            <View style={[styles.statCardCol, styles.statCardColMid]}>
              <Text style={styles.statMeta}>Ended</Text>
              <Text style={styles.statMetaValue}>{endedAt ? fmtTime(endedAt) : '—'}</Text>
            </View>
            <View style={styles.statCardCol}>
              <Text style={styles.statMeta}>Session today</Text>
              <Text style={styles.statMetaValue}>{ordinal(sessionNum)}</Text>
            </View>
          </View>
        </View>

        {/* ── Daily goal progress ──────────────────────────── */}
        <View style={styles.goalCard}>
          <View style={styles.goalAccentBar} />
          <View style={styles.goalContent}>
            <View style={styles.goalHeader}>
              <Text style={styles.goalLabel}>Daily goal progress</Text>
              <Text style={styles.goalValue}>
                {fmtDuration(todayTotal)} / {fmtDuration(dailyGoalSeconds)}
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${goalPct}%` }]} />
            </View>
            <Text style={styles.goalCaption}>{goalPct}% of daily goal reached 🎯</Text>
          </View>
        </View>

        {/* ── Subject breakdown ────────────────────────────── */}
        {breakdown.length > 0 && (
          <View style={styles.breakdownCard}>
            <View style={styles.breakdownHeader}>
              <Ionicons name="analytics-outline" size={16} color={colors.textPrimary} />
              <Text style={styles.breakdownTitle}>SUBJECT BREAKDOWN</Text>
            </View>

            {breakdown.map((s) => (
              <View key={s.id} style={styles.breakdownRow}>
                <View style={styles.breakdownLabels}>
                  <Text style={styles.breakdownSubject}>{s.name}</Text>
                  <Text style={styles.breakdownPct}>{s.pct}%</Text>
                </View>
                <View style={styles.breakdownTrack}>
                  <View
                    style={[
                      styles.breakdownFill,
                      { width: `${s.pct}%`, backgroundColor: s.color },
                    ]}
                  />
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ── Note card ───────────────────────────────────────── */}
        {note ? (
          <View style={styles.noteCard}>
            <View style={styles.noteAccentBar} />
            <View style={styles.noteContent}>
              <Text style={styles.noteLabel}>SESSION NOTE</Text>
              <View style={styles.noteRow}>
                <Ionicons name="create" size={16} color={colors.accentLight} />
                <Text style={styles.noteText}>{note}</Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* ── Action buttons ───────────────────────────────── */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.primaryBtn} onPress={handleHome}>
            <Text style={styles.primaryBtnText}>Back to Home</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.outlineBtn} onPress={handleStartAnother}>
            <Text style={styles.outlineBtnText}>Start Another Session</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.shareLink} onPress={handleShare}>
            <Ionicons name="share-outline" size={14} color={colors.accentLight} />
            <Text style={styles.shareLinkText}>Share your session →</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Ambient background glows (no blur available without expo-blur)
  bgGlowTopRight: {
    position: 'absolute',
    top: -80,
    right: -80,
    width: 300,
    height: 300,
    backgroundColor: colors.accentPrimary,
    borderRadius: 150,
    opacity: 0.04,
  },
  bgGlowBottomLeft: {
    position: 'absolute',
    bottom: -60,
    left: -60,
    width: 220,
    height: 220,
    backgroundColor: colors.accentPrimary,
    borderRadius: 110,
    opacity: 0.04,
  },

  // ── Header ───────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerBtn: {
    padding: spacing.xs,
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.accentPrimary,
    letterSpacing: 0.2,
  },

  // ── Scroll ───────────────────────────────────────────────────
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.xl,
  },

  // ── Celebration ──────────────────────────────────────────────
  celebration: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  checkCircle: {
    width: 88,
    height: 88,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 2,
    borderColor: colors.accentPrimary,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accentPrimary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    marginBottom: spacing.xs,
  },
  celebTitle: {
    fontSize: 32,
    fontWeight: '600',
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  celebSub: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.accentLight,
  },

  // ── Primary stat card ─────────────────────────────────────────
  statCard: {
    backgroundColor: colors.surfaceBlue,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  statCardTop: {
    alignItems: 'center',
    padding: spacing.xxl,
    paddingBottom: spacing.xl,
  },
  statCardLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 2,
    marginBottom: spacing.xs,
  },
  statCardDuration: {
    fontSize: 56,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -1,
    lineHeight: 60,
    fontFamily: Platform.select({ ios: 'Courier New', android: 'monospace' }),
  },
  statCardDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.xxl,
  },
  statCardRow: {
    flexDirection: 'row',
    paddingTop: spacing.xl,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.xxl,
  },
  statCardCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statCardColMid: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.border,
  },
  statMeta: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  statMetaValue: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
  },

  // ── Daily goal ────────────────────────────────────────────────
  goalCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  goalAccentBar: {
    width: 6,
    backgroundColor: colors.accentPrimary,
  },
  goalContent: {
    flex: 1,
    padding: spacing.xl,
    gap: spacing.md,
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  goalLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  goalValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  progressTrack: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accentPrimary,
    borderRadius: 4,
  },
  goalCaption: {
    fontSize: 12,
    color: colors.accentLight,
  },

  // ── Subject breakdown ─────────────────────────────────────────
  breakdownCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.xxl,
    gap: spacing.lg,
  },
  breakdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  breakdownTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 1,
  },
  breakdownRow: {
    gap: 6,
  },
  breakdownLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  breakdownSubject: {
    fontSize: 12,
    color: colors.textPrimary,
  },
  breakdownPct: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  breakdownTrack: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  breakdownFill: {
    height: '100%',
    borderRadius: 4,
  },

  // ── Note card ─────────────────────────────────────────────
  noteCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  noteAccentBar: {
    width: 3,
    backgroundColor: colors.accentPrimary,
  },
  noteContent: {
    flex: 1,
    padding: spacing.xl,
    gap: spacing.sm,
  },
  noteLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  noteText: {
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 20,
    flex: 1,
  },

  // ── Actions ───────────────────────────────────────────────────
  actions: {
    alignItems: 'center',
    gap: spacing.lg,
    paddingTop: spacing.xs,
  },
  primaryBtn: {
    width: '100%',
    height: 56,
    backgroundColor: colors.accentPrimary,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accentPrimary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  primaryBtnText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  outlineBtn: {
    width: '100%',
    height: 56,
    borderWidth: 2,
    borderColor: colors.accentLight,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineBtnText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.accentLight,
  },
  shareLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.xs,
  },
  shareLinkText: {
    fontSize: 12,
    color: colors.textSecondary,
    textDecorationLine: 'underline',
    textDecorationColor: colors.border,
  },
});
