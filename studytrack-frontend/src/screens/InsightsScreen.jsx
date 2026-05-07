import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../constraints/theme';
import { getInsights } from '../api/users';
import useUserStore from '../store/useUserStore';
import useSubjectStore from '../store/useSubjectStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BAR_HEIGHT = 160;

const INT = {
  empty: { color: colors.surfaceDeep,   opacity: 1    },
  l1:    { color: colors.accentPrimary, opacity: 0.15 },
  l2:    { color: colors.accentPrimary, opacity: 0.40 },
  l3:    { color: colors.accentPrimary, opacity: 0.65 },
  l4:    { color: colors.accentLight,   opacity: 1    },
  l5:    { color: colors.accentPrimary, opacity: 1    },
};

const LEGEND = [
  { color: colors.surfaceDeep,   opacity: 1    },
  { color: colors.accentPrimary, opacity: 0.20 },
  { color: colors.accentPrimary, opacity: 0.50 },
  { color: colors.accentLight,   opacity: 1    },
];

const PERIODS = ['Week', 'Month', 'All Time'];
const PERIOD_KEYS = ['week', 'month', 'all'];

// Placeholder data used until API responds
const DEFAULT_DATA = {
  totalTime: '47h 12m',
  dailyAvg:  '1h 32m',
  bestDay:   '6h 48m',
  heatmap: [
    ['empty','empty','empty','l1','l2','l4','l5'],
    ['l2','l4','empty','empty','l1','empty','l3'],
    ['l4','l5','l5','empty','l2','l1','empty'],
    ['empty','l1','l4','l5','empty','l1','l5'],
    ['l2','empty','empty','l4','l5','empty','empty'],
  ],
  barData: [
    { day: 'M', pct: 0.60, active: false, tooltip: null      },
    { day: 'T', pct: 0.40, active: false, tooltip: null      },
    { day: 'W', pct: 0.75, active: false, tooltip: null      },
    { day: 'T', pct: 0.85, active: true,  tooltip: '2h 06m' },
    { day: 'F', pct: 0.30, active: false, tooltip: null      },
    { day: 'S', pct: 0.15, active: false, tooltip: null      },
    { day: 'S', pct: 0.45, active: false, tooltip: null      },
  ],
  subjectDistribution: [
    { id: '1', name: 'Mathematics', pct: 40, color: colors.accentPrimary },
    { id: '2', name: 'Physics',     pct: 26, color: colors.accent2       },
    { id: '3', name: 'English Lit', pct: 20, color: colors.success       },
    { id: '4', name: 'Piano',       pct: 14, color: colors.danger        },
  ],
  streak: 14,
  totalSessions: 127,
};

export default function InsightsScreen({ navigation }) {
  const storeStreak = useUserStore((s) => s.streak);
  const [activePeriod, setActivePeriod] = useState(0);
  const [data, setData]     = useState(DEFAULT_DATA);
  const [loading, setLoading] = useState(false);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await getInsights(PERIOD_KEYS[activePeriod]);
        if (!cancelled && res) setData({ ...DEFAULT_DATA, ...res });
      } catch (_) {}
      finally { if (!cancelled) setLoading(false); }
    };
    load();
    return () => { cancelled = true; };
  }, [activePeriod]);

  const heatmap = data.heatmap ?? DEFAULT_DATA.heatmap;
  const barData = data.barData ?? DEFAULT_DATA.barData;
  const subjects = data.subjectDistribution ?? DEFAULT_DATA.subjectDistribution;

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
          <TouchableOpacity style={styles.headerBtn}>
            <Ionicons name="share-outline" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn}>
            <Ionicons name="options-outline" size={22} color={colors.textSecondary} />
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

        {/* ── Period toggle ───────────────────────────────── */}
        <View style={styles.periodToggle}>
          {PERIODS.map((label, i) => (
            <TouchableOpacity
              key={label}
              style={[styles.periodBtn, i === activePeriod && styles.periodBtnActive]}
              onPress={() => setActivePeriod(i)}
            >
              <Text style={[styles.periodBtnText, i === activePeriod && styles.periodBtnTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Hero metrics ────────────────────────────────── */}
        <View style={styles.metricsRow}>
          {[
            { label: 'Total time', value: data.totalTime },
            { label: 'Daily avg',  value: data.dailyAvg  },
            { label: 'Best day',   value: data.bestDay   },
          ].map((m) => (
            <View key={m.label} style={styles.metricCard}>
              <Text style={styles.metricLabel}>{m.label}</Text>
              <Text style={styles.metricValue}>{m.value}</Text>
              <View style={styles.metricBar} />
            </View>
          ))}
        </View>

        {/* ── Study heatmap ───────────────────────────────── */}
        <View style={styles.card}>
          <View style={styles.heatmapHeader}>
            <Text style={styles.cardTitle}>
              {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
            </Text>
            <View style={styles.monthNav}>
              <TouchableOpacity>
                <Ionicons name="chevron-back" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity>
                <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.heatmapGrid}>
            {heatmap.map((row, ri) => (
              <View key={ri} style={styles.heatmapRow}>
                {row.map((intensity, ci) => {
                  const cfg = INT[intensity];
                  return (
                    <View
                      key={ci}
                      style={[
                        styles.heatmapCell,
                        { backgroundColor: cfg.color, opacity: cfg.opacity },
                      ]}
                    />
                  );
                })}
              </View>
            ))}
          </View>

          {/* Legend */}
          <View style={styles.legend}>
            <Text style={styles.legendText}>Less</Text>
            <View style={styles.legendCells}>
              {LEGEND.map((l, i) => (
                <View
                  key={i}
                  style={[
                    styles.legendCell,
                    { backgroundColor: l.color, opacity: l.opacity },
                  ]}
                />
              ))}
            </View>
            <Text style={styles.legendText}>More</Text>
          </View>
        </View>

        {/* ── Daily breakdown bar chart ───────────────────── */}
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Text style={styles.cardTitle}>Daily breakdown</Text>
            {loading && <ActivityIndicator color={colors.accentPrimary} size="small" />}
          </View>
          <View style={styles.barChart}>
            {barData.map((bar, i) => (
              <View key={i} style={styles.barCol}>
                {/* Tooltip above active bar */}
                {bar.tooltip && (
                  <View style={[styles.tooltip, { bottom: BAR_HEIGHT * bar.pct + 10 }]}>
                    <Text style={styles.tooltipText}>{bar.tooltip}</Text>
                    <View style={styles.tooltipArrow} />
                  </View>
                )}
                <View
                  style={[
                    styles.barRect,
                    { height: BAR_HEIGHT * bar.pct },
                    { backgroundColor: bar.active ? colors.accentLight : colors.accentPrimary },
                  ]}
                />
                <Text style={[styles.barLabel, bar.active && styles.barLabelActive]}>
                  {bar.day}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* ── Subject distribution ────────────────────────── */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Subject distribution</Text>
          <View style={styles.subjectList}>
            {subjects.map((s) => (
              <TouchableOpacity
                key={s.id}
                style={styles.subjectRow}
                onPress={() => navigation.navigate('SubjectDetails', { subjectId: s.id })}
                activeOpacity={0.7}
              >
                <View style={styles.subjectMeta}>
                  <View style={[styles.subjectDot, { backgroundColor: s.color }]} />
                  <Text style={styles.subjectName}>{s.name}</Text>
                </View>
                <Text style={styles.subjectPct}>{s.pct}%</Text>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${s.pct}%`, backgroundColor: s.color },
                    ]}
                  />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── Streak & milestone cards ────────────────────── */}
        <View style={styles.statsRow}>
          <View style={styles.statsCard}>
            <Ionicons name="flame" size={36} color={colors.warning} />
            <Text style={styles.statsValue}>{data.streak ?? storeStreak} days</Text>
            <Text style={styles.statsLabel}>Current Streak</Text>
          </View>
          <View style={styles.statsCard}>
            <Ionicons name="checkmark-circle" size={36} color={colors.accentPrimary} />
            <Text style={styles.statsValue}>{data.totalSessions ?? 127}</Text>
            <Text style={styles.statsLabel}>Total Sessions</Text>
          </View>
        </View>
      </ScrollView>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

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
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  headerBtn: { padding: spacing.xs },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.accentPrimary,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Scroll ───────────────────────────────────────────────────
  scroll: { flex: 1 },
  scrollContent: {
    padding: spacing.xxl,
    gap: spacing.xl,
    paddingBottom: spacing.xl,
  },

  // ── Period toggle ─────────────────────────────────────────────
  periodToggle: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceDeep,
    borderRadius: radius.xl,
    padding: 4,
  },
  periodBtn: {
    flex: 1,
    paddingVertical: spacing.xs,
    alignItems: 'center',
    borderRadius: radius.md,
  },
  periodBtnActive: { backgroundColor: colors.accentPrimary },
  periodBtnText: { fontSize: 14, fontWeight: '500', color: colors.textSecondary },
  periodBtnTextActive: { color: colors.textPrimary },

  // ── Hero metrics ──────────────────────────────────────────────
  metricsRow: { flexDirection: 'row', gap: spacing.md },
  metricCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    gap: 4,
  },
  metricLabel: { fontSize: 12, color: colors.textSecondary },
  metricValue: { fontSize: 18, fontWeight: '600', color: colors.textPrimary, lineHeight: 22 },
  metricBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: colors.accentPrimary,
  },

  // ── Card wrapper ──────────────────────────────────────────────
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xxl,
  },
  cardTitle: { fontSize: 18, fontWeight: '600', color: colors.textPrimary },

  // ── Heatmap ───────────────────────────────────────────────────
  heatmapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: -spacing.md,
  },
  monthNav: { flexDirection: 'row', gap: spacing.xs },
  heatmapGrid: { gap: 6 },
  heatmapRow: { flexDirection: 'row', gap: 6 },
  heatmapCell: { flex: 1, aspectRatio: 1, borderRadius: 4 },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.xs,
    marginTop: -spacing.md,
  },
  legendText: { fontSize: 12, color: colors.textSecondary },
  legendCells: { flexDirection: 'row', gap: 4 },
  legendCell: { width: 12, height: 12, borderRadius: 2 },

  // ── Daily breakdown bar chart ─────────────────────────────────
  barChart: {
    height: BAR_HEIGHT + 24,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: -spacing.md,
  },
  barCol: {
    width: 32,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.md,
  },
  barRect: {
    width: '100%',
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  barLabel: { fontSize: 12, color: colors.textSecondary },
  barLabelActive: { color: colors.accentLight, fontWeight: '700' },
  tooltip: {
    position: 'absolute',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    zIndex: 10,
    alignSelf: 'center',
  },
  tooltipText: { fontSize: 14, fontWeight: '500', color: colors.textPrimary, whiteSpace: 'nowrap' },
  tooltipArrow: {
    position: 'absolute',
    bottom: -4,
    alignSelf: 'center',
    width: 8,
    height: 8,
    backgroundColor: colors.surface,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
    transform: [{ rotate: '45deg' }],
  },

  // ── Subject distribution ──────────────────────────────────────
  subjectList: { gap: spacing.xl },
  subjectRow: { gap: spacing.xs },
  subjectMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subjectDot: { width: 8, height: 8, borderRadius: 4, position: 'absolute' },
  subjectName: { fontSize: 14, fontWeight: '500', color: colors.textPrimary, paddingLeft: 16 },
  subjectPct: { fontSize: 12, color: colors.textSecondary },
  progressTrack: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 4 },

  // ── Streak & milestone ────────────────────────────────────────
  statsRow: { flexDirection: 'row', gap: spacing.lg },
  statsCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.xs,
  },
  statsValue: { fontSize: 24, fontWeight: '600', color: colors.textPrimary },
  statsLabel: { fontSize: 12, color: colors.textSecondary },

});
