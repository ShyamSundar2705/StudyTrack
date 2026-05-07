import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform, Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '../constraints/theme';

import useTimerStore    from '../store/useTimerStore';
import useSessionStore  from '../store/useSessionStore';
import useSubjectStore  from '../store/useSubjectStore';
import useUserStore     from '../store/useUserStore';
import usePomodoroStore from '../store/usePomodoroStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CommonActions } from '@react-navigation/native';
import { navigationRef } from '../navigation/navigationRef';

import { getTodaySessions, startSession as apiStartSession } from '../api/sessions';
import { getSubjects } from '../api/subjects';
import { getPreferences } from '../api/users';
import { requestNotificationPermission, schedulePomoPhaseEndAlert } from '../utils/notifications';
import ManualLogModal from '../components/ManualLogModal';

const RING_RADIUS        = 130;
const RING_CIRCUMFERENCE = Math.round(2 * Math.PI * RING_RADIUS); // ~817
const ASYNC_KEY          = 'studytrack:interrupted_session';

function fmtDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function fmtMmSs(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const PHASE_LABELS = {
  focus:       '🍅',
  short_break: '☕',
  long_break:  '🎉',
};

function fmtSessionTime(isoStart, elapsedSeconds) {
  const start = new Date(isoStart);
  const end   = new Date(start.getTime() + elapsedSeconds * 1000);
  const opts  = { hour: 'numeric', minute: '2-digit' };
  return `${start.toLocaleTimeString([], opts)} – ${end.toLocaleTimeString([], opts)}`;
}

export default function HomeTimerScreen({ navigation }) {
  const subjects              = useSubjectStore((s) => s.subjects);
  const setSubjects           = useSubjectStore((s) => s.setSubjects);
  const { startSession }      = useSessionStore();
  const todaySessions         = useSessionStore((s) => s.todaySessions);
  const setTodaySessions      = useSessionStore((s) => s.setTodaySessions);
  const addSession            = useSessionStore((s) => s.addSession);
  const { startTimer, setElapsedSeconds } = useTimerStore();
  const dailyGoalSeconds      = useUserStore((s) => s.dailyGoalSeconds);
  const insets                = useSafeAreaInsets();

  const isPomoMode            = usePomodoroStore((s) => s.isPomoMode);
  const currentPhase          = usePomodoroStore((s) => s.currentPhase);
  const currentRound          = usePomodoroStore((s) => s.currentRound);
  const enablePomoMode        = usePomodoroStore((s) => s.enablePomoMode);
  const disablePomoMode       = usePomodoroStore((s) => s.disablePomoMode);
  const setPomoConfig         = usePomodoroStore((s) => s.setConfig);
  const getCurrentPhaseDuration = usePomodoroStore((s) => s.getCurrentPhaseDuration);

  const [selectedId, setSelectedId] = useState(subjects[0]?.id ?? '1');
  const [showManualLog, setShowManualLog] = useState(false);

  const selectedSubject = subjects.find((s) => s.id === selectedId);
  const ringColor       = selectedSubject?.color ?? colors.accentLight;

  // Daily ring: progress = today's completed seconds / goal
  const todaySeconds = todaySessions.reduce((sum, s) => sum + s.elapsedSeconds, 0);
  const ringOffset   = Math.round(RING_CIRCUMFERENCE * (1 - Math.min(todaySeconds / dailyGoalSeconds, 1)));

  // Check for an interrupted session on first mount and offer to resume
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(ASYNC_KEY);
        if (!raw) return;
        const saved   = JSON.parse(raw);
        const subject = subjects.find((s) => s.id === saved.subjectId);
        const label   = subject?.name ?? 'Unknown';
        const mins    = Math.floor(saved.elapsedSeconds / 60);
        Alert.alert(
          'Resume Session?',
          `You have an unfinished ${label} session (${mins}m). Resume it?`,
          [
            {
              text: 'Discard',
              style: 'destructive',
              onPress: () => AsyncStorage.removeItem(ASYNC_KEY),
            },
            {
              text: 'Resume',
              onPress: () => {
                startSession(saved.subjectId, saved.backendSessionId ?? null);
                setElapsedSeconds(saved.elapsedSeconds);
                startTimer();
                navigation.navigate('SessionActive');
              },
            },
          ]
        );
      } catch (_) {}
    })();
  }, []);

  // Fetch Pomodoro config on mount
  useEffect(() => {
    getPreferences().then((prefs) => {
      if (!prefs) return;
      setPomoConfig({
        focusMinutes:      prefs.focusMinutes,
        shortBreakMinutes: prefs.shortBreakMinutes,
        longBreakMinutes:  prefs.longBreakMinutes,
        longBreakAfter:    prefs.longBreakAfter,
        autoStartBreaks:   prefs.autoStartBreaks,
      });
    }).catch(() => {});
  }, []);

  // Fetch subjects + today's sessions on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [subjectsData, sessionsData] = await Promise.all([
          getSubjects(),
          getTodaySessions(),
        ]);
        if (cancelled) return;
        if (subjectsData?.length) {
          setSubjects(subjectsData);
          setSelectedId(subjectsData[0].id); // sync picker to real DB ID
        } else if (Array.isArray(subjectsData) && subjectsData.length === 0) {
          // User has no subjects — reset to AuthStack at root level so SubjectSetup is reachable
          navigationRef.current?.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: 'Auth', state: { routes: [{ name: 'SubjectSetup' }] } }],
            })
          );
          return;
        }
        if (sessionsData?.length) setTodaySessions(sessionsData);
      } catch (_) {}
    })();
    return () => { cancelled = true; };
  }, []);

  const handlePomoToggle = () => {
    if (isPomoMode) disablePomoMode();
    else            enablePomoMode();
  };

  const handleStart = async () => {
    if (isPomoMode) {
      const duration = getCurrentPhaseDuration();
      await requestNotificationPermission();
      schedulePomoPhaseEndAlert(currentPhase, duration).catch((e) => console.warn('schedulePomoPhaseEndAlert failed:', e));

      let backendSessionId = null;
      if (currentPhase === 'focus') {
        try {
          const result     = await apiStartSession(selectedId);
          backendSessionId = result?.data?.session?.id ?? null;
        } catch (_) {}
        startSession(selectedId, backendSessionId);
      }

      startTimer(true, duration);
      navigation.navigate('SessionActive', {
        isPomo: true, phase: currentPhase, totalSeconds: duration, subjectId: selectedId,
      });
    } else {
      let backendSessionId = null;
      try {
        const result     = await apiStartSession(selectedId);
        backendSessionId = result?.data?.session?.id ?? null;
      } catch (_) {}

      startSession(selectedId, backendSessionId);
      startTimer();
      navigation.navigate('SessionActive');
    }
  };

  return (
    <View style={styles.container}>

      {/* ── Header ──────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.headerTitle}>StudyTrack</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.iconBtn}>
            <Ionicons name="notifications-outline" size={24} color={colors.textSecondary} />
          </TouchableOpacity>
          <View style={styles.avatar}>
            <Ionicons name="person-outline" size={20} color={colors.textSecondary} />
          </View>
        </View>
      </View>

      {/* ── Scrollable body ─────────────────────────────────── */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        {/* Subject chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.subjectScroll}
          contentContainerStyle={styles.subjectList}
        >
          {subjects.map((s) => (
            <TouchableOpacity
              key={s.id}
              style={[styles.subjectChip, s.id === selectedId && styles.subjectChipActive]}
              onPress={() => setSelectedId(s.id)}
            >
              <Text style={[styles.subjectChipText, s.id === selectedId && styles.subjectChipTextActive]}>
                {s.name}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.addChip}>
            <Ionicons name="add" size={18} color={colors.accentPrimary} />
            <Text style={styles.addChipText}>Add</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Pomodoro status pill */}
        {isPomoMode && (
          <View style={styles.pomoPill}>
            <Text style={styles.pomoPillText}>
              {currentPhase === 'focus'
                ? `🍅 Round ${currentRound} • Focus ${fmtMmSs(getCurrentPhaseDuration())}`
                : currentPhase === 'short_break'
                  ? `☕ Short Break ${fmtMmSs(getCurrentPhaseDuration())}`
                  : `🎉 Long Break ${fmtMmSs(getCurrentPhaseDuration())}`}
            </Text>
          </View>
        )}

        {/* Timer ring */}
        <View style={styles.timerSection}>
          <Text style={styles.subjectLabel}>
            {(selectedSubject?.name ?? 'SUBJECT').toUpperCase()}
          </Text>

          <View style={styles.ringWrap}>
            <Svg width={280} height={280} style={styles.ringsvg}>
              {/* Track ring */}
              <Circle
                cx={140} cy={140} r={RING_RADIUS}
                fill="transparent"
                stroke={colors.border}
                strokeWidth={4}
              />
              {/* Progress ring — driven by todaySeconds / dailyGoalSeconds */}
              <Circle
                cx={140} cy={140} r={RING_RADIUS}
                fill="transparent"
                stroke={ringColor}
                strokeWidth={6}
                strokeLinecap="round"
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={ringOffset}
              />
            </Svg>

            <View style={styles.timerInner}>
              <Text style={styles.timerText}>00:00:00</Text>
              <Text style={styles.timerSub}>Today {fmtDuration(todaySeconds)}</Text>
            </View>
          </View>
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          <View style={styles.controlItem}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => setShowManualLog(true)}>
              <Ionicons name="create-outline" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.controlLabel}>MANUAL</Text>
          </View>

          <TouchableOpacity style={styles.playBtn} onPress={handleStart}>
            <Ionicons name="play" size={36} color={colors.textPrimary} />
          </TouchableOpacity>

          <View style={styles.controlItem}>
            <TouchableOpacity
              style={[styles.secondaryBtn, isPomoMode && styles.pomoActive]}
              onPress={handlePomoToggle}
            >
              <Ionicons name="timer-outline" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.controlLabel}>POMO</Text>
          </View>
        </View>

        {/* Today's sessions */}
        <View style={styles.sessionsSection}>
          <View style={styles.sessionsHeader}>
            <Text style={styles.sessionsTitle}>Today's Sessions</Text>
            <TouchableOpacity style={styles.seeAllBtn}>
              <Text style={styles.seeAllText}>See all</Text>
              <Ionicons name="arrow-forward" size={16} color={colors.accentLight} />
            </TouchableOpacity>
          </View>

          {todaySessions.map((s) => {
            const subj  = subjects.find((sub) => sub.id === s.subjectId);
            const color = subj?.color ?? colors.accentLight;
            return (
              <View key={s.id} style={[styles.sessionCard, { borderLeftColor: color }]}>
                <View style={styles.sessionLeft}>
                  <View style={[styles.sessionDot, { backgroundColor: color }]} />
                  <View>
                    <Text style={styles.sessionSubject}>{s.subjectName ?? subj?.name}</Text>
                    <Text style={styles.sessionTime}>
                      {fmtSessionTime(s.startedAt, s.elapsedSeconds)}
                    </Text>
                  </View>
                </View>
                <Text style={styles.sessionDuration}>{fmtDuration(s.elapsedSeconds)}</Text>
              </View>
            );
          })}

          <TouchableOpacity style={styles.logBtn} onPress={() => setShowManualLog(true)}>
            <Ionicons name="time-outline" size={16} color={colors.accentLight} />
            <Text style={styles.logBtnText}>Log a past session</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <ManualLogModal
        visible={showManualLog}
        onClose={() => setShowManualLog(false)}
        onSaved={(session) => addSession(session)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // ── Header ────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.accentPrimary,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  iconBtn: {
    padding: spacing.xs,
    borderRadius: 20,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Scroll ────────────────────────────────────────────────────
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: spacing.xl },

  // ── Subject chips ─────────────────────────────────────────────
  subjectScroll: {
    marginTop: spacing.lg,
    marginBottom: spacing.xxl,
  },
  subjectList: {
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  subjectChip: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xs,
    borderRadius: 20,
    backgroundColor: colors.surface,
  },
  subjectChipActive: {
    backgroundColor: colors.accentLight,
  },
  subjectChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  subjectChipTextActive: {
    color: colors.textPrimary,
  },
  addChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  addChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.accentPrimary,
  },

  // ── Timer ring ────────────────────────────────────────────────
  timerSection: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  subjectLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accentLight,
    letterSpacing: 2,
    marginBottom: spacing.md,
  },
  ringWrap: {
    width: 280,
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // SVG rotated so 0° starts at 12 o'clock, not 3 o'clock
  ringsvg: {
    position: 'absolute',
    transform: [{ rotate: '-90deg' }],
  },
  timerInner: {
    alignItems: 'center',
  },
  timerText: {
    fontSize: 56,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -1,
    fontFamily: Platform.select({ ios: 'Courier New', android: 'monospace' }),
  },
  timerSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },

  // ── Controls ──────────────────────────────────────────────────
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 40,
    marginTop: spacing.xl,
    marginBottom: spacing.xxl,
  },
  controlItem: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  secondaryBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 1.5,
  },
  pomoActive: {
    backgroundColor: colors.accentPrimary,
  },
  pomoPill: {
    alignSelf:        'center',
    backgroundColor:  colors.surfaceElevated,
    borderRadius:     20,
    paddingHorizontal: spacing.lg,
    paddingVertical:   spacing.xs,
    marginBottom:      spacing.md,
  },
  pomoPillText: {
    fontSize:   13,
    fontWeight: '600',
    color:      colors.accentLight,
  },
  playBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accentPrimary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 12,
  },

  // ── Sessions ──────────────────────────────────────────────────
  sessionsSection: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  sessionsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  sessionsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.accentLight,
  },
  sessionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderLeftWidth: 4,
    marginBottom: spacing.lg,
  },
  sessionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  sessionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sessionSubject: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  sessionTime: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  sessionDuration: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  logBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: spacing.lg,
  },
  logBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },

});
