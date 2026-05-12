import React, { useRef, useCallback, useMemo, useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Animated,
  Alert, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { colors, radius, spacing } from '../constraints/theme';
import { getInsights } from '../api/users';
import useUserStore from '../store/useUserStore';
import useSubjectStore from '../store/useSubjectStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { shareInsightsStats } from '../utils/shareStats';
import SubjectFilterSheet from '../components/SubjectFilterSheet';

const BAR_HEIGHT = 160;
const PERIODS = ['Week', 'Month', 'All Time'];
const PERIOD_KEYS = ['week', 'month', 'allTime'];
const PERIOD_SUBLABEL = { week: 'This week', month: 'This month', allTime: 'All time' };

function formatDuration(seconds) {
  if (!seconds) return '0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function heatmapColor(seconds) {
  if (seconds === 0) return '#1A1A1A';
  if (seconds < 3600) return '#1A2744';
  if (seconds < 7200) return '#1E3A6E';
  if (seconds < 14400) return '#2D6BE4';
  if (seconds < 21600) return '#4A90E2';
  return '#7AB3F0';
}

function utcTodayStr() {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

function padAllTimeHeatmap(entries) {
  if (entries.length === 0) return [];
  const firstDate = new Date(entries[0].date + 'T00:00:00Z');
  const dayOfWeek = firstDate.getUTCDay();
  const pads = Array(isNaN(dayOfWeek) ? 0 : dayOfWeek).fill({ date: '', seconds: 0 });
  const padded = [...pads, ...entries];
  while (padded.length % 7 !== 0) padded.push({ date: '', seconds: 0 });
  return padded;
}

function weekdayLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  return d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }).slice(0, 3);
}

function monthAbbrLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  return d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }).slice(0, 3);
}

export default function InsightsScreen({ navigation }) {
  const storeStreak = useUserStore((s) => s.streak);
  const insets = useSafeAreaInsets();
  const todayStr = useMemo(utcTodayStr, []);
  const subjects = useSubjectStore((s) => s.subjects);

  const [period, setPeriod] = useState('week');
  const [insightsData, setInsightsData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const [showShareSheet, setShowShareSheet] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState(null);
  const [showFilterSheet, setShowFilterSheet] = useState(false);

  const shareSheetY = useRef(new Animated.Value(800)).current;
  const pulseAnim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  useEffect(() => {
    if (showShareSheet) {
      Animated.spring(shareSheetY, {
        toValue: 0, useNativeDriver: true, tension: 65, friction: 11,
      }).start();
    } else {
      Animated.timing(shareSheetY, {
        toValue: 800, duration: 220, useNativeDriver: true,
      }).start();
    }
  }, [showShareSheet]);

  const fetchInsights = useCallback(async (p, subjectId) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await getInsights(p, subjectId);
      setInsightsData(res);
    } catch {
      setError(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => { fetchInsights(period, selectedSubjectId); }, [period, selectedSubjectId, fetchInsights])
  );

  const handleExportCSV = async () => {
    if (!insightsData?.bySubject?.length) {
      Alert.alert('No data to export', 'Study some sessions first!');
      return;
    }

    const headers = 'Subject,Total Hours,Sessions,Percentage\n';
    const rows = (insightsData.bySubject ?? [])
      .map(s => [
        s.name,
        (s.seconds / 3600).toFixed(2),
        s.sessions ?? 0,
        s.percentage.toFixed(1) + '%',
      ].join(','))
      .join('\n');
    const csvContent = headers + rows;

    try {
      const FileSystem = require('expo-file-system/legacy');
      const fileUri = FileSystem.cacheDirectory + `studytrack_stats_${period}.csv`;
      await FileSystem.writeAsStringAsync(fileUri, csvContent, {
        encoding: 'utf8',
      });
      const Sharing = require('expo-sharing').default ?? require('expo-sharing');
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'text/csv',
          dialogTitle: 'Export Study Stats',
          UTI: 'public.comma-separated-values-text',
        });
      } else {
        Alert.alert('Sharing not available', 'Cannot share files on this device.');
      }
    } catch (err) {
      console.error('CSV export failed:', err);
      Alert.alert('Export failed', err.message);
    }
  };

  const activeSubject = selectedSubjectId
    ? subjects.find(s => s.id === selectedSubjectId)
    : null;

  const subjectHours = useMemo(() => {
    if (!insightsData?.bySubject) return {};
    return Object.fromEntries(
      insightsData.bySubject.map(s => [s.subjectId, formatDuration(s.seconds)])
    );
  }, [insightsData]);

  const isEmpty = insightsData && insightsData.totalSeconds === 0;
  const hasData = insightsData && !isEmpty;

  const heatmapTitle = useMemo(() => {
    const base = period === 'week'
      ? 'This Week'
      : period === 'allTime'
        ? 'All Time'
        : new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    if (activeSubject) return `${activeSubject.name} heatmap`;
    return base;
  }, [period, activeSubject]);

  const metricSublabel = useMemo(() => {
    const base = PERIOD_SUBLABEL[period];
    if (activeSubject) return `${activeSubject.name} — ${base.toLowerCase()}`;
    return base;
  }, [period, activeSubject]);

  function renderHeatmap() {
    if (!hasData) return null;
    const entries = insightsData.heatmap ?? [];

    if (period === 'week') {
      return (
        <View style={{ flexDirection: 'row', gap: 6 }}>
          {entries.map((entry, i) => (
            <View
              key={entry.date || i}
              style={[
                styles.heatmapCell,
                {
                  flex: 1,
                  aspectRatio: 1,
                  backgroundColor: heatmapColor(entry.seconds),
                  borderWidth: entry.date === todayStr ? 1.5 : 0,
                  borderColor: colors.textPrimary,
                },
              ]}
            />
          ))}
        </View>
      );
    }

    if (period === 'month') {
      return (
        <View style={{ gap: 6 }}>
          {Array.from({ length: 5 }, (_, row) => (
            <View key={row} style={{ flexDirection: 'row', gap: 6 }}>
              {entries.slice(row * 6, row * 6 + 6).map((entry, i) => (
                <View
                  key={entry.date || i}
                  style={[
                    styles.heatmapCell,
                    {
                      flex: 1,
                      aspectRatio: 1,
                      backgroundColor: heatmapColor(entry.seconds),
                      borderWidth: entry.date === todayStr ? 1.5 : 0,
                      borderColor: colors.textPrimary,
                    },
                  ]}
                />
              ))}
            </View>
          ))}
        </View>
      );
    }

    // allTime
    if (!entries.length) return null;
    const padded = padAllTimeHeatmap(entries);
    const totalCells = padded.length;
    if (totalCells <= 0) return null;
    const numCols = Math.ceil(totalCells / 7);
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {Array.from({ length: numCols }, (_, col) => (
            <View key={col} style={{ gap: 4 }}>
              {Array.from({ length: 7 }, (_, row) => {
                const entry = padded[col * 7 + row] || { date: '', seconds: 0 };
                if (!entry.date) {
                  return <View key={row} style={[styles.heatmapCell, { backgroundColor: 'transparent' }]} />;
                }
                return (
                  <View
                    key={row}
                    style={[
                      styles.heatmapCell,
                      {
                        backgroundColor: heatmapColor(entry.seconds),
                        borderWidth: entry.date === todayStr ? 1.5 : 0,
                        borderColor: colors.textPrimary,
                      },
                    ]}
                  />
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
    );
  }

  function renderBarChart() {
    if (!hasData) return null;
    const entries = insightsData.dailyBreakdown ?? [];
    const maxSeconds = entries.length
      ? Math.max(...entries.map(e => e.seconds ?? 0), 1)
      : 1;

    return (
      <View style={styles.barChart}>
        {entries.map((entry, i) => {
          const pct = entry.seconds / maxSeconds;
          const isToday = period === 'allTime'
            ? entry.date.startsWith(todayStr.slice(0, 7))
            : entry.date === todayStr;

          let label = '';
          if (period === 'week') {
            label = weekdayLabel(entry.date);
          } else if (period === 'month') {
            label = i % 5 === 0 ? String(Number(entry.date.split('-')[2])) : '';
          } else {
            label = monthAbbrLabel(entry.date);
          }

          return (
            <View key={entry.date || i} style={styles.barCol}>
              <View
                style={[
                  styles.barRect,
                  {
                    height: pct > 0 ? Math.max(BAR_HEIGHT * pct, 4) : 0,
                    backgroundColor: pct === 0
                      ? colors.surface
                      : isToday ? colors.accentLight : colors.accentPrimary,
                  },
                ]}
              />
              <Text style={[styles.barLabel, isToday && styles.barLabelActive]}>{label}</Text>
            </View>
          );
        })}
      </View>
    );
  }

  return (
    <View style={styles.container}>

      {/* ── Header ────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.headerBtn}>
            <Ionicons name="menu-outline" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Insights</Text>
        </View>
        <View style={styles.headerRight}>
          {/* Share icon */}
          <TouchableOpacity style={styles.headerBtn} onPress={() => setShowShareSheet(true)}>
            <Ionicons name="share-outline" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
          {/* Filter icon with active dot */}
          <TouchableOpacity style={styles.headerBtn} onPress={() => setShowFilterSheet(true)}>
            <Ionicons name="filter-outline" size={22} color={selectedSubjectId ? colors.accentPrimary : colors.textSecondary} />
            {selectedSubjectId != null && <View style={styles.filterDot} />}
          </TouchableOpacity>
          <View style={styles.avatar}>
            <Ionicons name="person-outline" size={18} color={colors.textSecondary} />
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Period toggle ── */}
        <View style={styles.periodToggle}>
          {PERIODS.map((label, i) => (
            <TouchableOpacity
              key={label}
              style={[styles.periodBtn, period === PERIOD_KEYS[i] && styles.periodBtnActive]}
              onPress={() => setPeriod(PERIOD_KEYS[i])}
            >
              <Text style={[styles.periodBtnText, period === PERIOD_KEYS[i] && styles.periodBtnTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Active filter banner ── */}
        {activeSubject && (
          <View style={styles.filterBanner}>
            <View style={[styles.filterBannerDot, { backgroundColor: activeSubject.color }]} />
            <Text style={styles.filterBannerText}>{activeSubject.name}</Text>
            <TouchableOpacity onPress={() => setSelectedSubjectId(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.filterBannerClose}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Loading skeleton ── */}
        {isLoading && (
          <Animated.View style={[styles.skeletonContainer, { opacity: pulseAnim }]}>
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              {[0, 1, 2].map(i => <View key={i} style={[styles.skeletonBlock, { flex: 1, height: 80 }]} />)}
            </View>
            <View style={[styles.skeletonBlock, { height: 160 }]} />
            <View style={[styles.skeletonBlock, { height: 200 }]} />
            {[0, 1, 2].map(i => <View key={i} style={[styles.skeletonBlock, { height: 48 }]} />)}
          </Animated.View>
        )}

        {/* ── Error state ── */}
        {!isLoading && error && (
          <View style={styles.centeredState}>
            <Ionicons name="alert-circle-outline" size={32} color={colors.danger} />
            <Text style={styles.stateTitle}>Failed to load insights</Text>
            <TouchableOpacity onPress={() => fetchInsights(period, selectedSubjectId)}>
              <Text style={styles.stateAction}>Try again</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Empty state ── */}
        {!isLoading && !error && isEmpty && (
          <View style={styles.centeredState}>
            <Ionicons name="book-open" size={40} color={colors.border} />
            <Text style={styles.stateTitle}>No study data yet</Text>
            <Text style={styles.stateSubtitle}>
              {activeSubject
                ? `No sessions for ${activeSubject.name} in this period`
                : 'Start a session to see your insights'}
            </Text>
          </View>
        )}

        {/* ── Data ── */}
        {!isLoading && !error && hasData && (
          <>
            {/* Hero stats */}
            <View style={styles.metricsRow}>
              {[
                { label: 'Total time', value: formatDuration(insightsData.totalSeconds) },
                { label: 'Daily avg',  value: formatDuration(insightsData.dailyAverageSeconds) },
                { label: 'Best day',   value: formatDuration(insightsData.bestDaySeconds) },
              ].map((m) => (
                <View key={m.label} style={styles.metricCard}>
                  <Text style={styles.metricLabel}>{m.label}</Text>
                  <Text style={styles.metricValue}>{m.value}</Text>
                  <Text style={styles.metricSublabel}>{metricSublabel}</Text>
                  <View style={styles.metricBar} />
                </View>
              ))}
            </View>

            {/* Heatmap card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{heatmapTitle}</Text>
              {renderHeatmap()}
              <View style={styles.legend}>
                <Text style={styles.legendText}>Less</Text>
                <View style={styles.legendCells}>
                  {['#1A1A1A', '#1A2744', '#1E3A6E', '#2D6BE4', '#4A90E2', '#7AB3F0'].map((c, i) => (
                    <View key={i} style={[styles.legendCell, { backgroundColor: c }]} />
                  ))}
                </View>
                <Text style={styles.legendText}>More</Text>
              </View>
            </View>

            {/* Daily breakdown bar chart */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Daily breakdown</Text>
              {renderBarChart()}
            </View>

            {/* Subject breakdown */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Subject distribution</Text>
              <View style={styles.subjectList}>
                {(insightsData.bySubject ?? []).slice(0, 5).map((s) => (
                  <TouchableOpacity
                    key={s.subjectId}
                    style={styles.subjectRow}
                    onPress={() => navigation.navigate('SubjectDetails', { subjectId: s.subjectId })}
                    activeOpacity={0.7}
                  >
                    <View style={styles.subjectMeta}>
                      <View style={[styles.subjectDot, { backgroundColor: s.colorHex }]} />
                      <Text style={styles.subjectName}>{s.name}</Text>
                      <Text style={styles.subjectHours}>{formatDuration(s.seconds)}</Text>
                    </View>
                    <Text style={styles.subjectPct}>{s.percentage.toFixed(0)}%</Text>
                    <View style={styles.progressTrack}>
                      <View
                        style={[styles.progressFill, { width: `${s.percentage}%`, backgroundColor: s.colorHex }]}
                      />
                    </View>
                  </TouchableOpacity>
                ))}
                {(insightsData.bySubject ?? []).length > 5 && (
                  <TouchableOpacity onPress={() => {}}>
                    <Text style={styles.seeAll}>See all subjects →</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Streak & sessions */}
            <View style={styles.statsRow}>
              <View style={styles.statsCard}>
                <Ionicons name="flame" size={36} color={colors.warning} />
                <Text style={styles.statsValue}>{insightsData.streak ?? storeStreak} days</Text>
                <Text style={styles.statsLabel}>Current Streak</Text>
              </View>
              <View style={styles.statsCard}>
                <Ionicons name="checkmark-circle" size={36} color={colors.accentPrimary} />
                <Text style={styles.statsValue}>{insightsData.totalSessions}</Text>
                <Text style={styles.statsLabel}>Total Sessions</Text>
              </View>
            </View>
          </>
        )}

      </ScrollView>

      {/* ── Share Action Sheet ── */}
      <Modal visible={showShareSheet} transparent animationType="none" onRequestClose={() => setShowShareSheet(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setShowShareSheet(false)} />
        <Animated.View
          style={[styles.shareSheet, { transform: [{ translateY: shareSheetY }], paddingBottom: insets.bottom + 32 }]}
        >
          <View style={styles.handle} />
          <Text style={styles.shareHeader}>Share Stats</Text>

          {/* Share as Text */}
          <TouchableOpacity
            style={styles.shareRow}
            activeOpacity={0.7}
            onPress={async () => {
              setShowShareSheet(false);
              await shareInsightsStats({
                period,
                totalSeconds: insightsData?.totalSeconds,
                dailyAverageSeconds: insightsData?.dailyAverageSeconds,
                bestDaySeconds: insightsData?.bestDaySeconds,
                bySubject: insightsData?.bySubject,
                streak: useUserStore.getState().streak,
                userName: useUserStore.getState().name,
                subjectName: activeSubject?.name,
              });
            }}
          >
            <Ionicons name="share-outline" size={20} color={colors.accentLight} />
            <View style={styles.shareRowText}>
              <Text style={styles.shareRowLabel}>Share as Text</Text>
              <Text style={styles.shareRowSub}>Send to any app</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.shareDivider} />

          {/* Export as CSV */}
          <TouchableOpacity
            style={styles.shareRow}
            activeOpacity={0.7}
            onPress={() => {
              setShowShareSheet(false);
              handleExportCSV();
            }}
          >
            <Ionicons name="document-text-outline" size={20} color={colors.accentLight} />
            <View style={styles.shareRowText}>
              <Text style={styles.shareRowLabel}>Export as CSV</Text>
              <Text style={styles.shareRowSub}>Download session data</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowShareSheet(false)} activeOpacity={0.8}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </Animated.View>
      </Modal>

      {/* ── Subject Filter Sheet ── */}
      <SubjectFilterSheet
        visible={showFilterSheet}
        selectedSubjectId={selectedSubjectId}
        onSelect={(id) => setSelectedSubjectId(id)}
        onClose={() => setShowFilterSheet(false)}
        subjectHours={subjectHours}
      />

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.xxl, paddingBottom: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  headerLeft:  { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  headerBtn:   { padding: spacing.xs },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.accentPrimary },
  avatar: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
  },
  filterDot: {
    position: 'absolute', top: 0, right: 0,
    width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accentPrimary,
  },

  scroll: { flex: 1 },
  scrollContent: { padding: spacing.xxl, gap: spacing.xl, paddingBottom: spacing.xl },

  periodToggle: {
    flexDirection: 'row', backgroundColor: colors.surfaceDeep, borderRadius: radius.xl, padding: 4,
  },
  periodBtn:         { flex: 1, paddingVertical: spacing.xs, alignItems: 'center', borderRadius: radius.md },
  periodBtnActive:   { backgroundColor: colors.accentPrimary },
  periodBtnText:     { fontSize: 14, fontWeight: '500', color: colors.textSecondary },
  periodBtnTextActive: { color: colors.textPrimary },

  filterBanner: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surfaceBlue,
    borderWidth: 0.5, borderColor: colors.accentPrimary,
    borderRadius: 10, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  filterBannerDot:   { width: 8, height: 8, borderRadius: 4 },
  filterBannerText:  { flex: 1, fontSize: 13, color: colors.accentLight },
  filterBannerClose: { fontSize: 16, color: colors.textSecondary },

  skeletonContainer: { gap: spacing.xl },
  skeletonBlock: { backgroundColor: colors.surface, borderRadius: radius.xl },

  centeredState: { alignItems: 'center', paddingVertical: spacing.xxl * 2, gap: spacing.lg },
  stateTitle:    { fontSize: 15, color: colors.textPrimary },
  stateSubtitle: { fontSize: 13, color: colors.textSecondary, textAlign: 'center' },
  stateAction:   { fontSize: 14, color: colors.accentPrimary, fontWeight: '500' },

  metricsRow: { flexDirection: 'row', gap: spacing.md },
  metricCard: {
    flex: 1, backgroundColor: colors.surface, borderRadius: radius.xl,
    padding: spacing.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', gap: 4,
  },
  metricLabel:   { fontSize: 12, color: colors.textSecondary },
  metricValue:   { fontSize: 18, fontWeight: '600', color: colors.textPrimary, lineHeight: 22 },
  metricSublabel: { fontSize: 10, color: colors.textSecondary },
  metricBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 3, backgroundColor: colors.accentPrimary,
  },

  card: {
    backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xxl,
    borderWidth: 1, borderColor: colors.border, gap: spacing.xxl,
  },
  cardTitle: { fontSize: 18, fontWeight: '600', color: colors.textPrimary },

  heatmapCell: { width: 12, height: 12, borderRadius: 2 },
  legend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.xs },
  legendText:  { fontSize: 12, color: colors.textSecondary },
  legendCells: { flexDirection: 'row', gap: 4 },
  legendCell:  { width: 12, height: 12, borderRadius: 2 },

  barChart: {
    height: BAR_HEIGHT + 24, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
  },
  barCol:         { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: spacing.md, minWidth: 0 },
  barRect:        { width: '80%', minWidth: 2, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  barLabel:       { fontSize: 10, color: colors.textSecondary },
  barLabelActive: { color: colors.accentLight, fontWeight: '700' },

  subjectList: { gap: spacing.xl },
  subjectRow:  { gap: spacing.xs },
  subjectMeta: { flexDirection: 'row', alignItems: 'center' },
  subjectDot:  { width: 8, height: 8, borderRadius: 4 },
  subjectName: { fontSize: 14, fontWeight: '500', color: colors.textPrimary, paddingLeft: spacing.sm, flex: 1 },
  subjectHours: { fontSize: 12, color: colors.textSecondary },
  subjectPct:  { fontSize: 12, color: colors.textSecondary },
  progressTrack: { height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: 'hidden' },
  progressFill:  { height: '100%', borderRadius: 4 },
  seeAll: { fontSize: 13, color: colors.accentLight, textAlign: 'right' },

  statsRow: { flexDirection: 'row', gap: spacing.lg },
  statsCard: {
    flex: 1, backgroundColor: colors.surface, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border, padding: spacing.xl, alignItems: 'center', gap: spacing.xs,
  },
  statsValue: { fontSize: 24, fontWeight: '600', color: colors.textPrimary },
  statsLabel: { fontSize: 12, color: colors.textSecondary },

  // Share sheet
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  shareSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl,
  },
  handle: {
    width: 40, height: 4, backgroundColor: colors.borderLight, borderRadius: 2,
    alignSelf: 'center', marginTop: spacing.md,
  },
  shareHeader: {
    fontSize: 16, fontWeight: '700', color: colors.textPrimary,
    paddingHorizontal: spacing.xxl, paddingTop: spacing.lg, paddingBottom: spacing.sm,
  },
  shareRow: {
    height: 64, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.xxl, gap: spacing.md,
  },
  shareRowText: { flex: 1, gap: 3 },
  shareRowLabel: { fontSize: 15, color: colors.textPrimary },
  shareRowSub:   { fontSize: 12, color: colors.textSecondary },
  shareDivider:  { height: 0.5, backgroundColor: colors.border, marginHorizontal: spacing.xxl },
  cancelBtn: {
    marginHorizontal: spacing.xxl, marginTop: spacing.md, height: 52,
    backgroundColor: colors.surfaceDeep, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  cancelText: { fontSize: 15, color: colors.textPrimary },
});
