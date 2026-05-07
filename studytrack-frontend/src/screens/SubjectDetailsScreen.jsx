import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../constraints/theme';
import { getSubjectDetails } from '../api/subjects';
import { getSessionsBySubject } from '../api/sessions';
import useSubjectStore from '../store/useSubjectStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CHART_HEIGHT = 160;

const DEFAULT_BAR_DATA = [
  { day: 'M', pct: 0.40, active: false },
  { day: 'T', pct: 0.60, active: false },
  { day: 'W', pct: 0.35, active: false },
  { day: 'T', pct: 0.85, active: false },
  { day: 'F', pct: 0.55, active: false },
  { day: 'S', pct: 0.75, active: true  },
  { day: 'S', pct: 0.20, active: false },
];

const DEFAULT_SESSION_GROUPS = [
  { label: 'Today',     sessions: [
    { id: '1', title: 'Calculus III Practice', time: '09:15 AM - 10:45 AM', duration: '1h 30m' },
    { id: '2', title: 'Linear Algebra Review', time: '02:00 PM - 02:45 PM', duration: '45m'    },
  ]},
  { label: 'Yesterday', sessions: [
    { id: '3', title: 'Advanced Statistics', time: '03:30 PM - 05:30 PM', duration: '2h 00m' },
  ]},
];

function fmtSeconds(s) {
  const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmtTime12(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function buildSessionGroups(rawSessions) {
  if (!rawSessions?.length) return [];
  const now       = new Date(); now.setHours(0, 0, 0, 0);
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  const map       = {};
  rawSessions.forEach((s) => {
    if (!s.endedAt || !s.durationSeconds) return;
    const d = new Date(s.startedAt); d.setHours(0, 0, 0, 0);
    const ts = d.getTime();
    let label;
    if (ts === now.getTime())       label = 'Today';
    else if (ts === yesterday.getTime()) label = 'Yesterday';
    else label = d.toLocaleDateString('default', { month: 'short', day: 'numeric' });
    if (!map[label]) map[label] = { label, sessions: [], ts };
    map[label].sessions.push({
      id:       s.id,
      title:    s.type === 'POMODORO' ? `Pomodoro Round ${s.pomodoroRound ?? ''}`.trim() : 'Focus Session',
      time:     `${fmtTime12(s.startedAt)} – ${fmtTime12(s.endedAt)}`,
      duration: fmtSeconds(s.durationSeconds),
      note:     s.note ?? null,
    });
  });
  return Object.values(map).sort((a, b) => b.ts - a.ts);
}

export default function SubjectDetailsScreen({ navigation, route }) {
  const subjectId = route?.params?.subjectId;
  const insets    = useSafeAreaInsets();
  const storeSubject = useSubjectStore((s) => s.subjects.find((sub) => sub.id === subjectId));

  const [subject,        setSubject]        = useState(storeSubject ?? null);
  const [barData,        setBarData]        = useState(DEFAULT_BAR_DATA);
  const [sessionGroups,  setSessionGroups]  = useState([]);
  const [computedStats,  setComputedStats]  = useState(null);
  const [loading,        setLoading]        = useState(false);

  useEffect(() => {
    if (!subjectId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const [detailsResult, historyResult] = await Promise.allSettled([
        getSubjectDetails(subjectId),
        getSessionsBySubject(subjectId),
      ]);
      if (!cancelled) {
        if (detailsResult.status === 'fulfilled' && detailsResult.value) {
          setSubject(detailsResult.value);
        }
        if (historyResult.status === 'fulfilled') {
          const history = historyResult.value;
          if (history?.barData) setBarData(history.barData);
          const rawSessions = history?.data?.sessions;
          if (rawSessions) {
            setSessionGroups(buildSessionGroups(rawSessions));
            const completed = rawSessions.filter((s) => s.durationSeconds);
            const totalSecs = completed.reduce((sum, s) => sum + s.durationSeconds, 0);
            const avgSecs   = completed.length > 0 ? Math.round(totalSecs / completed.length) : 0;
            // Per-subject streak: consecutive days counting back from today
            const daySet = new Set(
              completed.map((s) => {
                const d = new Date(s.startedAt); d.setHours(0, 0, 0, 0); return d.getTime();
              })
            );
            let streak = 0;
            const base = new Date(); base.setHours(0, 0, 0, 0);
            for (let i = 0; i < 365; i++) {
              if (daySet.has(base.getTime() - i * 86_400_000)) streak++;
              else break;
            }
            setComputedStats({ sessions: completed.length, streakDays: streak, avgSeconds: avgSecs, totalSeconds: totalSecs });
          }
        }
        setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [subjectId]);  // eslint-disable-line react-hooks/exhaustive-deps

  const subjectColor = subject?.color ?? colors.accentLight;
  const stats        = computedStats ?? { sessions: 0, streakDays: 0, avgSeconds: 0, totalSeconds: 0 };
  const totalFmt     = fmtSeconds(stats.totalSeconds);

  return (
    <View style={styles.container}>
      {/* Subtle top atmosphere glow */}
      <View style={styles.atmosphereGlow} />

      {/* ── Header ────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={colors.accentPrimary} />
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
            <Text style={styles.headerTitle}>{subject?.name ?? 'Subject'}</Text>
            {loading && <ActivityIndicator color={colors.accentPrimary} size="small" />}
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerBtn}>
            <Ionicons name="create-outline" size={22} color={colors.accentPrimary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn}>
            <Ionicons name="ellipsis-vertical" size={22} color={colors.accentPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Subject hero card ───────────────────────────── */}
        <View style={styles.heroCard}>
          {/* Identity row */}
          <View style={styles.heroTop}>
            <View style={styles.heroIdent}>
              <View style={[styles.avatar, { backgroundColor: subjectColor }]}>
                <Text style={styles.avatarText}>{(subject?.name ?? 'S')[0].toUpperCase()}</Text>
              </View>
              <View>
                <Text style={styles.heroTitle}>{subject?.name ?? 'Subject'}</Text>
                <Text style={styles.heroSub}>
                  {subject?.createdAt ? `Created ${new Date(subject.createdAt).toLocaleDateString('default', { month: 'short', year: 'numeric' })}` : 'Created Jan 2024'}
                </Text>
              </View>
            </View>
            <TouchableOpacity style={styles.changeColorBtn}>
              <Text style={styles.changeColorText}>Change color</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.statsGrid}>
            {[
              { label: 'Total',    value: totalFmt },
              { label: 'Sessions', value: String(stats.sessions)             },
              { label: 'Streak',   value: `${stats.streakDays} days`         },
              { label: 'Avg',      value: fmtSeconds(stats.avgSeconds)        },
            ].map((s) => (
              <View key={s.label} style={styles.statCell}>
                <Text style={styles.statCellLabel}>{s.label}</Text>
                <Text style={styles.statCellValue}>{s.value}</Text>
              </View>
            ))}
          </View>

          {/* Action buttons */}
          <View style={styles.heroActions}>
            <TouchableOpacity style={styles.studyBtn}>
              <Ionicons name="play" size={16} color={colors.textPrimary} />
              {/* TODO: API - start session for this subject */}
              <Text style={styles.studyBtnText}>Study now</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.goalBtn}>
              {/* TODO: API - open set goal modal */}
              <Text style={styles.goalBtnText}>Set goal</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.noteBtn}>
              <Ionicons name="add" size={16} color={colors.textSecondary} />
              {/* TODO: API - open add note modal */}
              <Text style={styles.noteBtnText}>Add note</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Weekly trend card ───────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.trendHeader}>
            <View>
              <Text style={styles.cardSubLabel}>WEEKLY TREND</Text>
              {/* TODO: API - show weekly total for selected week */}
              <Text style={styles.cardTitle}>12h 44m</Text>
            </View>
            <View style={styles.weekNav}>
              <TouchableOpacity style={styles.weekNavBtn}>
                <Ionicons name="chevron-back" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.weekNavBtn}>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Bar chart */}
          <View style={styles.barChart}>
            {barData.map((bar, i) => (
              <View key={i} style={styles.barCol}>
                <View
                  style={[
                    styles.barRect,
                    { height: CHART_HEIGHT * bar.pct },
                    bar.active ? styles.barActive : styles.barInactive,
                  ]}
                />
                <Text style={[styles.barLabel, bar.active && styles.barLabelActive]}>
                  {bar.day}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Daily goal card ─────────────────────────────── */}
        <View style={[styles.card, styles.goalCard]}>
          <View style={styles.goalAccentBar} />
          <View style={styles.goalBody}>
            <Text style={styles.cardSubLabel}>DAILY GOAL</Text>
            <View style={styles.goalRow}>
              {/* TODO: API - show actual progress percentage */}
              <Text style={styles.goalPct}>65%</Text>
              <Text style={styles.goalTarget}>2h 00m / day</Text>
            </View>
            <View style={styles.progressTrack}>
              {/* TODO: API - set width from (studied / goal) */}
              <View style={[styles.progressFill, { width: '65%' }]} />
            </View>
            {/* TODO: API - show today's studied time for this subject */}
            <Text style={styles.goalNote}>1h 18m studied today</Text>
          </View>
        </View>

        {/* ── Session history ─────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.historyHeader}>
            <Text style={styles.sectionTitle}>Session History</Text>
            {/* TODO: API - filter sessions by period */}
            <View style={styles.filterTabs}>
              <TouchableOpacity style={[styles.filterTab, styles.filterTabActive]}>
                <Text style={styles.filterTabTextActive}>All</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.filterTab}>
                <Text style={styles.filterTabText}>Week</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.filterTab}>
                <Text style={styles.filterTabText}>Month</Text>
              </TouchableOpacity>
            </View>
          </View>

          {sessionGroups.map((group) => (
            <View key={group.label} style={styles.sessionGroup}>
              <Text style={styles.groupLabel}>{group.label.toUpperCase()}</Text>
              {group.sessions.map((s) => (
                <View key={s.id} style={styles.sessionCard}>
                  <View style={styles.sessionAccentBar} />
                  <View style={styles.sessionBody}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.sessionTitle}>{s.title}</Text>
                      <Text style={styles.sessionTime}>{s.time}</Text>
                      {s.note ? (
                        <View style={styles.notePreviewRow}>
                          <Ionicons name="create-outline" size={12} color={colors.textSecondary} />
                          <Text style={styles.notePreviewText} numberOfLines={1}>
                            {s.note.length > 60 ? `${s.note.slice(0, 60)}...` : s.note}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.sessionDuration}>{s.duration}</Text>
                  </View>
                </View>
              ))}
            </View>
          ))}
        </View>

        {/* ── Session history empty state ──────────────────── */}
        {!loading && sessionGroups.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="time-outline" size={32} color={colors.border} />
            <Text style={styles.emptyStateText}>No sessions recorded yet</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  atmosphereGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 300,
    backgroundColor: colors.accentLight,
    opacity: 0.03,
  },

  // ── Header ───────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  headerBtn: { padding: spacing.xs, borderRadius: 20 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.accentPrimary },

  // ── Scroll ───────────────────────────────────────────────────
  scroll: { flex: 1 },
  scrollContent: {
    padding: spacing.lg,
    gap: spacing.xl,
    paddingBottom: spacing.xl,
  },

  // ── Hero card ─────────────────────────────────────────────────
  heroCard: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.accentPrimary,
    borderRadius: radius.xl,
    padding: spacing.xxl,
    gap: spacing.xl,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.lg,
  },
  heroIdent: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  heroTitle: { fontSize: 28, fontWeight: '600', color: colors.textPrimary },
  heroSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  changeColorBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
  },
  changeColorText: { fontSize: 14, fontWeight: '500', color: colors.textPrimary },

  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
  },
  statCell: {
    width: '47%',
    backgroundColor: colors.surfaceDeep,
    borderRadius: radius.sm,
    borderWidth: 0.5,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: 4,
  },
  statCellLabel: { fontSize: 12, color: colors.textSecondary },
  statCellValue: { fontSize: 24, fontWeight: '600', color: colors.textPrimary },

  heroActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  studyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.accentPrimary,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
  },
  studyBtnText: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  goalBtn: {
    borderWidth: 2,
    borderColor: colors.accentLight,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.md,
    borderRadius: radius.sm,
  },
  goalBtnText: { fontSize: 14, fontWeight: '700', color: colors.accentLight },
  noteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  noteBtnText: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },

  // ── Cards ─────────────────────────────────────────────────────
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.xxl,
    overflow: 'hidden',
  },
  cardSubLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  cardTitle: { fontSize: 24, fontWeight: '600', color: colors.textPrimary },

  // Weekly trend
  trendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xxl,
  },
  weekNav: { flexDirection: 'row', gap: spacing.xs },
  weekNavBtn: { padding: spacing.xs, borderRadius: radius.sm },

  barChart: {
    height: CHART_HEIGHT + 24,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.xs,
  },
  barRect: {
    width: '100%',
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    backgroundColor: colors.accentLight,
  },
  barInactive: { opacity: 0.2 },
  barActive:   { opacity: 1   },
  barLabel: { fontSize: 12, color: colors.textSecondary },
  barLabelActive: { color: colors.textPrimary, fontWeight: '700' },

  // Daily goal card
  goalCard: { flexDirection: 'row', padding: 0 },
  goalAccentBar: { width: 3, backgroundColor: colors.accentPrimary },
  goalBody: { flex: 1, padding: spacing.xxl, gap: spacing.lg },
  goalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  goalPct: { fontSize: 40, fontWeight: '700', color: colors.textPrimary },
  goalTarget: { fontSize: 12, color: colors.textSecondary, marginBottom: 4 },
  progressTrack: {
    height: 12,
    backgroundColor: colors.border,
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accentLight,
    borderRadius: 6,
  },
  goalNote: { fontSize: 16, color: colors.textPrimary },

  // ── Session history ───────────────────────────────────────────
  section: { gap: spacing.lg },
  sectionTitle: { fontSize: 24, fontWeight: '600', color: colors.textPrimary },

  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  filterTabs: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: 4,
  },
  filterTab: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 6,
    borderRadius: radius.xs,
  },
  filterTabActive: { backgroundColor: colors.accentPrimary },
  filterTabText: { fontSize: 14, fontWeight: '500', color: colors.textSecondary },
  filterTabTextActive: { fontSize: 14, fontWeight: '500', color: colors.textPrimary },

  sessionGroup: { gap: spacing.md },
  groupLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 2,
  },
  sessionCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  sessionAccentBar: { width: 3, backgroundColor: colors.accentLight },
  sessionBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  sessionTitle: { fontSize: 18, fontWeight: '600', color: colors.textPrimary },
  sessionTime:  { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  notePreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  notePreviewText: {
    fontSize: 12,
    color: colors.textSecondary,
    flex: 1,
  },
  sessionDuration: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.accentLight,
  },

  // ── Notes ─────────────────────────────────────────────────────
  noteCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.xxl,
    gap: spacing.md,
  },
  noteTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  noteTag: {
    backgroundColor: colors.surfaceBlue,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: 20,
  },
  noteTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.accentLight,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  noteTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  noteExcerpt: { fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
  noteDivider: { height: 1, backgroundColor: colors.border },
  noteFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  noteDate: { fontSize: 12, color: colors.textSecondary, fontStyle: 'italic' },

  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
  emptyStateText: { fontSize: 14, color: colors.textSecondary },
});
