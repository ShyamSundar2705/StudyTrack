import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
// TODO: useTheme() for dynamic theme support
import { colors, radius, spacing } from '../constraints/theme';
import { getGroupLeaderboard } from '../api/leaderboard';
import { getGroupSocket } from '../api/socket';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useUserStore from '../store/useUserStore';

const SCOPE_KEYS    = ['group', 'category', 'global'];
const PERIOD_LABELS = ['Today', 'This Week', 'This Month', 'All Time'];
const PERIOD_KEYS   = ['today', 'week', 'month', 'all'];

const TREND_CONFIG = {
  up:     { icon: 'arrow-up',       color: colors.success        },
  down:   { icon: 'arrow-down',     color: colors.danger         },
  stable: { icon: 'remove-outline', color: colors.textSecondary  },
};

function fmtDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function buildPodiumAndRanked(leaderboard, currentUserId) {
  const sorted = [...leaderboard].sort((a, b) => a.rank - b.rank);
  const podiumColors = { 1: colors.gold, 2: colors.silver, 3: colors.bronze };
  const barHeights   = { 1: 144, 2: 96, 3: 80 };

  const top3 = sorted.slice(0, 3);
  const byRank = Object.fromEntries(top3.map(e => [e.rank, e]));

  const podiumOrder = [byRank[2], byRank[1], byRank[3]].filter(Boolean);
  const podium = podiumOrder.map(e => ({
    pos:         e.rank,
    name:        e.name,
    time:        fmtDuration(e.durationSeconds),
    borderColor: podiumColors[e.rank] ?? colors.border,
    barH:        barHeights[e.rank]   ?? 60,
    isGold:      e.rank === 1,
  }));

  const ranked = sorted.slice(3).map(e => ({
    pos:        e.rank,
    name:       e.userId === currentUserId ? 'YOU' : e.name,
    time:       fmtDuration(e.durationSeconds),
    trend:      'stable',
    trendLabel: 'Stable',
    isMe:       e.userId === currentUserId,
  }));

  return { podium, ranked };
}

export default function LeaderboardScreen({ navigation }) {
  const insets           = useSafeAreaInsets();
  const userId           = useUserStore((s) => s.id);
  const group            = useUserStore((s) => s.group);
  const dailyGoalSeconds = useUserStore((s) => s.dailyGoalSeconds);

  const [activeScope,  setActiveScope]  = useState(0);
  const [activePeriod, setActivePeriod] = useState(1);
  const [podium,       setPodium]       = useState([]);
  const [ranked,       setRanked]       = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [comingSoon,   setComingSoon]   = useState(false);
  const [myRank,       setMyRank]       = useState(null);

  const loadRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setComingSoon(false);

    if (activeScope !== 0) {
      setComingSoon(true);
      setPodium([]);
      setRanked([]);
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        const groupId = group?.id;
        if (!groupId) { setPodium([]); setRanked([]); return; }
        const leaderboard = await getGroupLeaderboard(groupId, PERIOD_KEYS[activePeriod]);
        if (!cancelled) {
          const { podium: p, ranked: r } = buildPodiumAndRanked(leaderboard, userId);
          setPodium(p);
          setRanked(r);
          const me = leaderboard.find(e => e.userId === userId);
          setMyRank(me?.rank ?? null);
        }
      } catch (_) {}
      finally { if (!cancelled) setLoading(false); }
    };
    loadRef.current = load;
    load();
    return () => { cancelled = true; };
  }, [activeScope, activePeriod, group?.id, userId]);

  useEffect(() => {
    const socket = getGroupSocket();
    const onLeaderboardUpdate = () => { if (loadRef.current) loadRef.current(); };
    socket.on('leaderboard_update', onLeaderboardUpdate);
    return () => { socket.off('leaderboard_update', onLeaderboardUpdate); };
  }, []);

  return (
    <View style={styles.container}>

      {/* ── Header ────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={colors.accentPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Leaderboard</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.headerBtn}>
            <Ionicons name="share-outline" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn}>
            <Ionicons name="options-outline" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* ── Scope toggle ────────────────────────────────── */}
        <View style={styles.scopeToggle}>
          {['My Group', 'Category', 'Global'].map((label, i) => (
            <TouchableOpacity
              key={label}
              style={[styles.scopeBtn, i === activeScope && styles.scopeBtnActive]}
              onPress={() => setActiveScope(i)}
            >
              <Text style={[styles.scopeBtnText, i === activeScope && styles.scopeBtnTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Period chips ─────────────────────────────────── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.periodChips}
        >
          {PERIOD_LABELS.map((label, i) => (
            <TouchableOpacity
              key={label}
              style={[styles.periodChip, i === activePeriod && styles.periodChipActive]}
              onPress={() => setActivePeriod(i)}
            >
              <Text style={[styles.periodChipText, i === activePeriod && styles.periodChipTextActive]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {loading && <ActivityIndicator color={colors.accentPrimary} size="small" style={{ alignSelf: 'center', marginBottom: 4 }} />}

        {comingSoon ? (
          <View style={styles.centeredState}>
            <Ionicons name="construct-outline" size={48} color={colors.textSecondary} />
            <Text style={styles.comingSoonText}>Coming Soon</Text>
            <Text style={styles.comingSoonSub}>
              {SCOPE_KEYS[activeScope] === 'category' ? 'Category' : 'Global'} leaderboards are not yet available.
            </Text>
          </View>
        ) : (
          <>
            {/* ── Podium ──────────────────────────────────────── */}
            {podium.length > 0 && (
              <View style={styles.podium}>
                {podium.map((entry) => (
                  <View
                    key={entry.pos}
                    style={[
                      styles.podiumCol,
                      entry.isGold && styles.podiumColGold,
                    ]}
                  >
                    {entry.isGold && (
                      <Ionicons
                        name="trophy"
                        size={28}
                        color={colors.gold}
                        style={styles.crownIcon}
                      />
                    )}

                    <View style={[
                      styles.podiumAvatarWrap,
                      { borderColor: entry.borderColor },
                      entry.isGold && styles.podiumAvatarWrapGold,
                    ]}>
                      <View style={styles.podiumAvatarInner}>
                        <Ionicons name="person" size={entry.isGold ? 28 : 22} color={colors.textSecondary} />
                      </View>
                    </View>

                    <View style={[styles.rankBadge, { backgroundColor: entry.borderColor }]}>
                      <Text style={styles.rankBadgeText}>{entry.pos}</Text>
                    </View>

                    <Text style={styles.podiumName}>{entry.name}</Text>
                    <Text style={[styles.podiumTime, entry.isGold && styles.podiumTimeGold]}>
                      {entry.time}
                    </Text>

                    <View style={[
                      styles.podiumBar,
                      { height: entry.barH },
                      entry.isGold
                        ? { backgroundColor: colors.surfaceElevated, borderColor: colors.gold }
                        : { backgroundColor: colors.surface, borderColor: colors.border },
                    ]} />
                  </View>
                ))}
              </View>
            )}

            {/* ── Ranked list ─────────────────────────────────── */}
            {ranked.length > 0 && (
              <View style={styles.rankedList}>
                {ranked.map((entry) => {
                  const trend = TREND_CONFIG[entry.trend];
                  return (
                    <View
                      key={entry.pos}
                      style={[styles.rankedRow, entry.isMe && styles.rankedRowMe]}
                    >
                      {entry.isMe && <View style={styles.meAccentBar} />}
                      <Text style={[styles.rankedPos, entry.isMe && styles.rankedPosMe]}>
                        {entry.pos}
                      </Text>

                      <View style={[
                        styles.rankedAvatar,
                        entry.isMe && { borderWidth: 2, borderColor: colors.accentPrimary },
                      ]}>
                        <Ionicons name="person" size={18} color={colors.textSecondary} />
                      </View>

                      <View style={styles.rankedInfo}>
                        <Text style={styles.rankedName}>{entry.name}</Text>
                        <View style={styles.rankedTrend}>
                          <Ionicons name={trend.icon} size={14} color={trend.color} />
                          <Text style={[
                            styles.rankedTrendLabel,
                            entry.trend === 'up' && entry.isMe && { color: colors.success },
                          ]}>
                            {entry.trendLabel}
                          </Text>
                        </View>
                      </View>

                      <Text style={[styles.rankedTime, entry.isMe && styles.rankedTimeMe]}>
                        {entry.time}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}

            {/* ── Your position card ───────────────────────────── */}
            <View style={styles.positionCard}>
              <View style={styles.positionHeader}>
                <Text style={styles.positionTitle}>Your position</Text>
                {myRank != null && (
                  <Text style={styles.positionPct}>#{myRank} in group</Text>
                )}
              </View>

              <View style={styles.positionStats}>
                {[
                  { label: 'Group',    value: myRank != null ? `#${myRank}` : '–' },
                  { label: 'Category', value: '#–' },
                  { label: 'Global',   value: '#–' },
                ].map((s) => (
                  <View key={s.label} style={styles.positionStatCell}>
                    <Text style={styles.positionStatLabel}>{s.label}</Text>
                    <Text style={styles.positionStatValue}>{s.value}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.nextRankRow}>
                <View style={styles.nextRankLabels}>
                  <Text style={styles.nextRankText}>Next Rank: {myRank != null && myRank > 1 ? `#${myRank - 1}` : '–'}</Text>
                  <Text style={styles.nextRankText}>Keep studying!</Text>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: '75%' }]} />
                </View>
              </View>
            </View>
          </>
        )}

        {/* ── Motivational banner ──────────────────────────── */}
        <TouchableOpacity
          style={styles.motivBanner}
          onPress={() => navigation.navigate('HomeTab')}
        >
          <View style={styles.motivLeft}>
            <Ionicons name="flash" size={20} color={colors.textPrimary} />
            <View>
              <Text style={styles.motivTitle}>Daily Goal: {Math.floor((dailyGoalSeconds ?? 3600) / 3600)}h</Text>
              <Text style={styles.motivSub}>You're just 16 minutes away from a new streak!</Text>
            </View>
          </View>
          <View style={styles.motivPlayBtn}>
            <Ionicons name="play" size={24} color={colors.accentPrimary} />
          </View>
        </TouchableOpacity>

        <View style={{ height: 80 }} />
      </ScrollView>

      {/* ── Floating Study Now button ────────────────────── */}
      <TouchableOpacity
        style={styles.floatingBtn}
        onPress={() => navigation.navigate('HomeTab')}
      >
        <Ionicons name="timer-outline" size={20} color={colors.textPrimary} />
        <Text style={styles.floatingBtnText}>Study Now</Text>
      </TouchableOpacity>
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
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  headerBtn: { padding: spacing.xs },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.accentPrimary },

  // ── Scroll ───────────────────────────────────────────────────
  scroll: { flex: 1 },
  scrollContent: { padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xl },

  // ── Scope toggle ──────────────────────────────────────────────
  scopeToggle: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    padding: 4,
  },
  scopeBtn: {
    flex: 1,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.lg,
    borderRadius: 999,
    alignItems: 'center',
  },
  scopeBtnActive: { backgroundColor: colors.accentPrimary },
  scopeBtnText: { fontSize: 14, fontWeight: '500', color: colors.textSecondary },
  scopeBtnTextActive: { color: colors.textPrimary },

  // ── Period chips ──────────────────────────────────────────────
  periodChips: { gap: spacing.xs },
  periodChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  periodChipActive: {
    borderColor: colors.accentPrimary,
    backgroundColor: colors.surfaceBlue,
  },
  periodChipText: { fontSize: 14, fontWeight: '500', color: colors.textSecondary },
  periodChipTextActive: { color: colors.accentPrimary },

  // ── Coming soon ───────────────────────────────────────────────
  centeredState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl * 2,
    gap: spacing.md,
  },
  comingSoonText: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  comingSoonSub: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },

  // ── Podium ────────────────────────────────────────────────────
  podium: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xs,
  },
  podiumCol: { alignItems: 'center', width: 96 },
  podiumColGold: { width: 112, marginBottom: -spacing.md },
  crownIcon: { marginBottom: spacing.xs },
  podiumAvatarWrap: {
    borderWidth: 2,
    borderRadius: 999,
    padding: 2,
    marginBottom: spacing.xs,
  },
  podiumAvatarWrapGold: { borderWidth: 4 },
  podiumAvatarInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -spacing.sm,
    marginBottom: spacing.xs,
  },
  rankBadgeText: { fontSize: 10, fontWeight: '700', color: colors.background },
  podiumName: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
  podiumTime: { fontSize: 12, color: colors.textSecondary, marginBottom: spacing.xs },
  podiumTimeGold: { color: colors.gold, fontWeight: '700' },
  podiumBar: {
    width: '100%',
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    marginTop: spacing.xs,
  },

  // ── Ranked list ───────────────────────────────────────────────
  rankedList: { gap: spacing.md },
  rankedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    overflow: 'hidden',
  },
  rankedRowMe: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.accentPrimary,
  },
  meAccentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: colors.accentPrimary,
  },
  rankedPos: { fontSize: 14, fontWeight: '700', color: colors.textSecondary, width: 16 },
  rankedPosMe: { color: colors.accentPrimary, marginLeft: 4 },
  rankedAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceDeep,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  rankedInfo: { flex: 1, gap: 2 },
  rankedName: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  rankedTrend: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  rankedTrendLabel: { fontSize: 10, color: colors.textSecondary, textTransform: 'uppercase' },
  rankedTime: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  rankedTimeMe: { color: colors.accentPrimary },

  // ── Position card ─────────────────────────────────────────────
  positionCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    gap: spacing.lg,
  },
  positionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  positionTitle: { fontSize: 24, fontWeight: '600', color: colors.textPrimary },
  positionPct: { fontSize: 14, fontWeight: '700', color: colors.accentPrimary },
  positionStats: { flexDirection: 'row', gap: spacing.xs },
  positionStatCell: {
    flex: 1,
    backgroundColor: colors.surfaceDeep,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  positionStatLabel: {
    fontSize: 10,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  positionStatValue: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  nextRankRow: { gap: spacing.xs },
  nextRankLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  nextRankText: { fontSize: 12, color: colors.textSecondary },
  progressTrack: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accentPrimary,
    borderRadius: 3,
  },

  // ── Motivational banner ───────────────────────────────────────
  motivBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.accentPrimary,
    borderRadius: radius.md,
    padding: spacing.xxl,
    overflow: 'hidden',
  },
  motivLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, flex: 1 },
  motivTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  motivSub: {
    fontSize: 12,
    color: colors.textPrimary,
    opacity: 0.8,
    marginTop: 2,
    flexShrink: 1,
  },
  motivPlayBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.textPrimary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Floating button ───────────────────────────────────────────
  floatingBtn: {
    position: 'absolute',
    bottom: spacing.xxl,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.accentPrimary,
    paddingHorizontal: spacing.xl * 2,
    paddingVertical: spacing.lg,
    borderRadius: 999,
    shadowColor: colors.accentPrimary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 10,
  },
  floatingBtnText: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
});
