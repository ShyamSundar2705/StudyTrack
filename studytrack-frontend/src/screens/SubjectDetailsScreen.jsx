import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, spacing } from '../constraints/theme';
import { useTheme } from '../context/ThemeContext';
import { getSubjectDetails, updateSubject } from '../api/subjects';
import { getSessionsBySubject } from '../api/sessions';
import useSubjectStore from '../store/useSubjectStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomSheetPicker from '../components/BottomSheetPicker';
import NoteBottomSheet from '../components/NoteBottomSheet';

const CHART_HEIGHT = 160;

const SUBJECT_COLORS = [
  '#4A90E2', '#27AE60', '#A855F7', '#E74C3C',
  '#FFD700', '#FF6B2B', '#2D6BE4', '#16A085',
];

const GOAL_OPTIONS = [
  { label: '30 min',   value: 1800  },
  { label: '1 hour',   value: 3600  },
  { label: '1.5 hours',value: 5400  },
  { label: '2 hours',  value: 7200  },
  { label: '3 hours',  value: 10800 },
  { label: '4 hours',  value: 14400 },
  { label: 'No goal',  value: 0     },
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
    if (ts === now.getTime())               label = 'Today';
    else if (ts === yesterday.getTime())    label = 'Yesterday';
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

function buildWeekBarData(rawSessions) {
  const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const today = new Date();
  const dow = today.getDay();
  const daysFromMonday = dow === 0 ? 6 : dow - 1;

  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - daysFromMonday + i);
    d.setHours(0, 0, 0, 0);
    days.push(d);
  }

  const secByDay = {};
  (rawSessions ?? []).forEach((s) => {
    if (!s.durationSeconds) return;
    const d = new Date(s.startedAt); d.setHours(0, 0, 0, 0);
    secByDay[d.getTime()] = (secByDay[d.getTime()] ?? 0) + s.durationSeconds;
  });

  const maxSec = Math.max(...days.map((d) => secByDay[d.getTime()] ?? 0), 1);
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);

  return days.map((d, i) => ({
    day:     DAY_LABELS[i],
    pct:     (secByDay[d.getTime()] ?? 0) / maxSec,
    active:  d.getTime() === todayStart.getTime(),
    seconds: secByDay[d.getTime()] ?? 0,
  }));
}

export default function SubjectDetailsScreen({ navigation, route }) {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  const subjectId = route?.params?.subjectId;
  const insets    = useSafeAreaInsets();
  const storeSubject  = useSubjectStore((s) => s.subjects.find((sub) => sub.id === subjectId));
  const updateStoreSubject = useSubjectStore((s) => s.updateSubject);

  const [subject,           setSubject]           = useState(storeSubject ?? null);
  const [rawSessions,       setRawSessions]       = useState([]);
  const [computedStats,     setComputedStats]     = useState(null);
  const [loading,           setLoading]           = useState(false);
  const [activeFilter,      setActiveFilter]      = useState('all');
  const [goalPickerVisible, setGoalPickerVisible] = useState(false);
  const [showNoteSheet,     setShowNoteSheet]     = useState(false);
  const [showColorPicker,   setShowColorPicker]   = useState(false);
  const [colorSaving,       setColorSaving]       = useState(false);

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
          const sessions = history?.data?.sessions ?? [];
          setRawSessions(sessions);
          const completed = sessions.filter((s) => s.durationSeconds);
          const totalSecs = completed.reduce((sum, s) => sum + s.durationSeconds, 0);
          const avgSecs   = completed.length > 0 ? Math.round(totalSecs / completed.length) : 0;
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
        setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [subjectId]);

  // Derived values from rawSessions
  const weekBarData = useMemo(() => buildWeekBarData(rawSessions), [rawSessions]);
  const weeklySeconds = useMemo(() => weekBarData.reduce((s, d) => s + d.seconds, 0), [weekBarData]);

  const todaySubjectSeconds = useMemo(() => {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    return rawSessions
      .filter((s) => {
        if (!s.durationSeconds) return false;
        const d = new Date(s.startedAt); d.setHours(0, 0, 0, 0);
        return d.getTime() === todayStart.getTime();
      })
      .reduce((sum, s) => sum + s.durationSeconds, 0);
  }, [rawSessions]);

  const filteredSessionGroups = useMemo(() => {
    if (activeFilter === 'all') return buildSessionGroups(rawSessions);
    const cutoff = new Date();
    if (activeFilter === 'week') cutoff.setDate(cutoff.getDate() - 7);
    else if (activeFilter === 'month') cutoff.setMonth(cutoff.getMonth() - 1);
    cutoff.setHours(0, 0, 0, 0);
    const filtered = rawSessions.filter((s) => new Date(s.startedAt) >= cutoff);
    return buildSessionGroups(filtered);
  }, [rawSessions, activeFilter]);

  const subjectColor   = subject?.color ?? colors.accentLight;
  const stats          = computedStats ?? { sessions: 0, streakDays: 0, avgSeconds: 0, totalSeconds: 0 };
  const subjectGoal    = subject?.dailyGoalSeconds ?? 0;
  const goalPct        = subjectGoal > 0
    ? Math.min(100, Math.round((todaySubjectSeconds / subjectGoal) * 100))
    : 0;

  // ── Handlers ────────────────────────────────────────────────────────

  const handleStudyNow = () => {
    navigation.navigate('Main', {
      screen: 'HomeTab',
      params: { screen: 'HomeTimer', params: { preSelectSubjectId: subjectId } },
    });
  };

  const handleSetGoal = async (seconds) => {
    setGoalPickerVisible(false);
    try {
      await updateSubject(subjectId, { dailyGoalSeconds: seconds });
      setSubject((prev) => ({ ...prev, dailyGoalSeconds: seconds }));
    } catch (_) {}
  };

  const handleColorChange = async (color) => {
    if (colorSaving) return;
    setColorSaving(true);
    try {
      await updateSubject(subjectId, { colorHex: color });
      setSubject((prev) => ({ ...prev, color }));
      if (updateStoreSubject) updateStoreSubject({ id: subjectId, color });
    } catch (_) {}
    setColorSaving(false);
    setShowColorPicker(false);
  };

  return (
    <View style={styles.container}>
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
          <TouchableOpacity style={styles.headerBtn} onPress={() => setShowNoteSheet(true)}>
            <Ionicons name="create-outline" size={22} color={colors.accentPrimary} />
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
          <View style={styles.heroTop}>
            <View style={styles.heroIdent}>
              <View style={[styles.avatar, { backgroundColor: subjectColor }]}>
                <Text style={styles.avatarText}>{(subject?.name ?? 'S')[0].toUpperCase()}</Text>
              </View>
              <View>
                <Text style={styles.heroTitle}>{subject?.name ?? 'Subject'}</Text>
                <Text style={styles.heroSub}>
                  {subject?.createdAt
                    ? `Created ${new Date(subject.createdAt).toLocaleDateString('default', { month: 'short', year: 'numeric' })}`
                    : 'Created Jan 2024'}
                </Text>
              </View>
            </View>
            <TouchableOpacity style={styles.changeColorBtn} onPress={() => setShowColorPicker(v => !v)}>
              <Text style={styles.changeColorText}>Change color</Text>
            </TouchableOpacity>
          </View>

          {/* Inline color picker */}
          {showColorPicker && (
            <View style={styles.colorPickerRow}>
              {SUBJECT_COLORS.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.colorSwatch,
                    { backgroundColor: c },
                    c === subjectColor && styles.colorSwatchSelected,
                  ]}
                  onPress={() => handleColorChange(c)}
                  disabled={colorSaving}
                />
              ))}
            </View>
          )}

          <View style={styles.statsGrid}>
            {[
              { label: 'Total',    value: fmtSeconds(stats.totalSeconds)  },
              { label: 'Sessions', value: String(stats.sessions)          },
              { label: 'Streak',   value: `${stats.streakDays} days`      },
              { label: 'Avg',      value: fmtSeconds(stats.avgSeconds)    },
            ].map((s) => (
              <View key={s.label} style={styles.statCell}>
                <Text style={styles.statCellLabel}>{s.label}</Text>
                <Text style={styles.statCellValue}>{s.value}</Text>
              </View>
            ))}
          </View>

          <View style={styles.heroActions}>
            <TouchableOpacity style={styles.studyBtn} onPress={handleStudyNow}>
              <Ionicons name="play" size={16} color={colors.textPrimary} />
              <Text style={styles.studyBtnText}>Study now</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.goalBtn} onPress={() => setGoalPickerVisible(true)}>
              <Text style={styles.goalBtnText}>Set goal</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.noteBtn} onPress={() => setShowNoteSheet(true)}>
              <Ionicons name="add" size={16} color={colors.textSecondary} />
              <Text style={styles.noteBtnText}>Add note</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Weekly trend card ───────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.trendHeader}>
            <View>
              <Text style={styles.cardSubLabel}>WEEKLY TREND</Text>
              <Text style={styles.cardTitle}>{fmtSeconds(weeklySeconds)}</Text>
            </View>
          </View>

          <View style={styles.barChart}>
            {weekBarData.map((bar, i) => (
              <View key={i} style={styles.barCol}>
                <View
                  style={[
                    styles.barRect,
                    { height: Math.max(4, CHART_HEIGHT * bar.pct) },
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
            {subjectGoal > 0 ? (
              <>
                <View style={styles.goalRow}>
                  <Text style={styles.goalPct}>{goalPct}%</Text>
                  <Text style={styles.goalTarget}>{fmtSeconds(subjectGoal)} / day</Text>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${goalPct}%` }]} />
                </View>
                <Text style={styles.goalNote}>{fmtSeconds(todaySubjectSeconds)} studied today</Text>
              </>
            ) : (
              <TouchableOpacity onPress={() => setGoalPickerVisible(true)} style={styles.noGoalRow}>
                <Ionicons name="flag-outline" size={18} color={colors.textSecondary} />
                <Text style={styles.noGoalText}>Tap "Set goal" to track daily progress</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── Session history ─────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.historyHeader}>
            <Text style={styles.sectionTitle}>Session History</Text>
            <View style={styles.filterTabs}>
              {['all', 'week', 'month'].map((f) => (
                <TouchableOpacity
                  key={f}
                  style={[styles.filterTab, activeFilter === f && styles.filterTabActive]}
                  onPress={() => setActiveFilter(f)}
                >
                  <Text style={activeFilter === f ? styles.filterTabTextActive : styles.filterTabText}>
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {filteredSessionGroups.map((group) => (
            <View key={group.label} style={styles.sessionGroup}>
              <Text style={styles.groupLabel}>{group.label.toUpperCase()}</Text>
              {group.sessions.map((s) => (
                <View key={s.id} style={styles.sessionCard}>
                  <View style={[styles.sessionAccentBar, { backgroundColor: subjectColor }]} />
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

        {!loading && filteredSessionGroups.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="time-outline" size={32} color={colors.border} />
            <Text style={styles.emptyStateText}>No sessions recorded yet</Text>
          </View>
        )}
      </ScrollView>

      {/* ── Goal picker ─────────────────────────────────── */}
      <BottomSheetPicker
        visible={goalPickerVisible}
        title="Daily Goal"
        options={GOAL_OPTIONS}
        selectedValue={subjectGoal}
        onSelect={handleSetGoal}
        onClose={() => setGoalPickerVisible(false)}
      />

      {/* ── Note sheet ──────────────────────────────────── */}
      <NoteBottomSheet
        visible={showNoteSheet}
        initialNote=""
        onSave={() => {}}
        onClose={() => setShowNoteSheet(false)}
      />
    </View>
  );
}

function getStyles(colors) { return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  atmosphereGlow: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
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
  headerLeft:  { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  headerBtn:   { padding: spacing.xs, borderRadius: 20 },
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
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: colors.accentLight,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  heroTitle:  { fontSize: 28, fontWeight: '600', color: colors.textPrimary },
  heroSub:    { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  changeColorBtn: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
  },
  changeColorText: { fontSize: 14, fontWeight: '500', color: colors.textPrimary },

  // Color picker
  colorPickerRow: {
    flexDirection: 'row',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  colorSwatch: {
    width: 36, height: 36, borderRadius: 18,
  },
  colorSwatchSelected: {
    borderWidth: 3,
    borderColor: colors.textPrimary,
  },

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
  barLabel:       { fontSize: 12, color: colors.textSecondary },
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
  goalPct:    { fontSize: 40, fontWeight: '700', color: colors.textPrimary },
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
  goalNote: { fontSize: 14, color: colors.textPrimary },
  noGoalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  noGoalText: { fontSize: 13, color: colors.textSecondary },

  // ── Session history ───────────────────────────────────────────
  section: { gap: spacing.lg },
  sectionTitle: { fontSize: 20, fontWeight: '600', color: colors.textPrimary },

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
    borderRadius: radius.sm,
  },
  filterTabActive: { backgroundColor: colors.accentPrimary },
  filterTabText:       { fontSize: 14, fontWeight: '500', color: colors.textSecondary },
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
  sessionTitle: { fontSize: 16, fontWeight: '600', color: colors.textPrimary },
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

  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
  emptyStateText: { fontSize: 14, color: colors.textSecondary },
}); }
