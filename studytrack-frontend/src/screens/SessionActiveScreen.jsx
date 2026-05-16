import React, { useState } from 'react';
import { useKeepAwake } from 'expo-keep-awake';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { radius, spacing } from '../constraints/theme';
import { useTheme } from '../context/ThemeContext';

import useTimerStore    from '../store/useTimerStore';
import useSessionStore  from '../store/useSessionStore';
import useSubjectStore  from '../store/useSubjectStore';
import useUserStore     from '../store/useUserStore';
import usePomodoroStore from '../store/usePomodoroStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { startSession as apiStartSession, completeSession as apiCompleteSession } from '../api/sessions';
import { cancelPomoAlert, schedulePomoPhaseEndAlert } from '../utils/notifications';
import NoteBottomSheet from '../components/NoteBottomSheet';
import SessionActionSheet from '../components/SessionActionSheet';
import SubjectSwitchSheet from '../components/SubjectSwitchSheet';

const RING_RADIUS        = 125;
const RING_CIRCUMFERENCE = Math.round(2 * Math.PI * RING_RADIUS); // ~785
const ASYNC_KEY          = 'studytrack:interrupted_session';

const PHASE_INFO = {
  focus:       { emoji: '🍅', label: 'FOCUS' },
  short_break: { emoji: '☕', label: 'SHORT BREAK' },
  long_break:  { emoji: '🎉', label: 'LONG BREAK' },
};

function formatTime(s) {
  const h   = Math.floor(s / 3600);
  const m   = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function fmtTotal(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
}

export default function SessionActiveScreen({ navigation, route }) {
  const { colors } = useTheme();
  const styles = getStyles(colors);

  useKeepAwake();

  const isPomo    = route.params?.isPomo    ?? false;
  const subjectId = route.params?.subjectId ?? null;

  // Timer store
  const { elapsedSeconds, isRunning, isCountdown, totalSeconds: timerTotal,
          pauseTimer, startTimer, resetTimer } = useTimerStore();

  // Session store
  const {
    activeSession, pauseSession, resumeSession, stopSession, logSession,
    startSession, todaySessions,
  } = useSessionStore();

  // Pomo store (scalar selectors — avoids object selector anti-pattern)
  const currentPhase           = usePomodoroStore((s) => s.currentPhase);
  const disablePomoMode        = usePomodoroStore((s) => s.disablePomoMode);
  const getCurrentPhaseDuration = usePomodoroStore((s) => s.getCurrentPhaseDuration);

  const subjects         = useSubjectStore((s) => s.subjects);
  const streak           = useUserStore((s) => s.streak);
  const dailyGoalSeconds = useUserStore((s) => s.dailyGoalSeconds);
  const insets           = useSafeAreaInsets();

  const [sessionNote, setSessionNote]         = useState('');
  const [showNoteSheet, setShowNoteSheet]     = useState(false);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [showSubjectSwitch, setShowSubjectSwitch] = useState(false);

  // Resolve subject from either the active session or the passed subjectId (break phases)
  const resolvedSubjectId = activeSession?.subjectId ?? subjectId;
  const subject           = subjects.find((s) => s.id === resolvedSubjectId);
  const subjectColor      = subject?.color ?? colors.accentLight;

  // isPaused: use activeSession flag for focus, timer running state for breaks
  const isPaused = activeSession ? (activeSession.isPaused ?? false) : !isRunning;

  // Pomo computed values
  const remainingSeconds = isPomo ? Math.max(0, timerTotal - elapsedSeconds) : elapsedSeconds;
  const phaseInfo        = isPomo ? PHASE_INFO[currentPhase] : null;
  // Phase is complete when countdown finishes (timer stops at totalSeconds)
  const phaseComplete    = isPomo && isCountdown && !isRunning && timerTotal > 0 && elapsedSeconds >= timerTotal;

  // Ring: in countdown mode depletes (remaining/total); otherwise fills (elapsed/goal)
  const ringProgress = isPomo
    ? Math.min(remainingSeconds / Math.max(timerTotal, 1), 1)
    : Math.min(elapsedSeconds / dailyGoalSeconds, 1);
  const ringOffset = Math.round(RING_CIRCUMFERENCE * (1 - ringProgress));

  // Center label
  const focusingLabel = isPomo
    ? (isPaused ? 'PAUSED' : `${phaseInfo?.emoji} ${phaseInfo?.label}`)
    : (isPaused ? 'PAUSED' : 'FOCUSING');

  // Pill text
  const startTimeLabel = activeSession
    ? new Date(activeSession.startedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : '';
  const pillText = isPomo
    ? `${phaseInfo?.label} • Round ${usePomodoroStore.getState().currentRound}`
    : `Focus Session • Started ${startTimeLabel}`;

  const todayTotal = todaySessions.reduce((sum, s) => sum + s.elapsedSeconds, 0);

  // ── Handlers ────────────────────────────────────────────────────

  const handlePause = () => {
    if (isPaused) {
      if (activeSession) resumeSession();
      startTimer(isCountdown, timerTotal);
    } else {
      if (activeSession) pauseSession();
      pauseTimer();
    }
  };

  const handleStop = () => {
    // Break phase: no session to complete — end pomo and go home
    if (isPomo && !activeSession) {
      cancelPomoAlert().catch(() => {});
      resetTimer();
      disablePomoMode();
      navigation.navigate('Main');
      return;
    }
    if (isPomo) cancelPomoAlert().catch(() => {});

    const endedAt                  = new Date().toISOString();
    const capturedElapsed          = elapsedSeconds;
    const capturedSubjectId        = activeSession.subjectId;
    const capturedStartedAt        = activeSession.startedAt;
    const capturedBackendSessionId = activeSession.backendSessionId;

    logSession({
      id:             Date.now().toString(),
      subjectId:      capturedSubjectId,
      subjectName:    subject?.name,
      startedAt:      capturedStartedAt,
      elapsedSeconds: capturedElapsed,
    });
    resetTimer();
    AsyncStorage.removeItem(ASYNC_KEY).catch(() => {});
    navigation.replace('SessionComplete', {
      durationSeconds:  capturedElapsed,
      subjectId:        capturedSubjectId,
      subjectName:      subject?.name,
      subjectColor:     subject?.color ?? subject?.colorHex,
      startedAt:        capturedStartedAt,
      endedAt,
      backendSessionId: capturedBackendSessionId,
      note:             sessionNote || undefined,
    });
  };

  const handleClose = () => {
    const isBreakPhase = isPomo && !activeSession;
    Alert.alert(
      isBreakPhase ? 'End Break?' : 'Abandon Session?',
      isBreakPhase
        ? 'Your current break will end and the Pomodoro timer will reset.'
        : 'Your progress and any note for this session will be lost.',
      [
        { text: 'Keep Going', style: 'cancel' },
        {
          text: isBreakPhase ? 'End Break' : 'Abandon',
          style: 'destructive',
          onPress: () => {
            if (isPomo) cancelPomoAlert().catch(() => {});
            if (!isBreakPhase) stopSession();
            resetTimer();
            if (isPomo) disablePomoMode();
            AsyncStorage.removeItem(ASYNC_KEY).catch(() => {});
            navigation.goBack();
          },
        },
      ]
    );
  };

  const handleStartNextPhase = async () => {
    const nextPhase     = currentPhase; // Already advanced by the timer store callback
    const nextDuration  = getCurrentPhaseDuration();
    const nextSubjectId = resolvedSubjectId;

    // Complete the focus session that just ended before moving to the break
    if (activeSession) {
      const capturedElapsed          = timerTotal;
      const capturedSubjectId        = activeSession.subjectId;
      const capturedStartedAt        = activeSession.startedAt;
      const capturedBackendSessionId = activeSession.backendSessionId;
      logSession({
        id:             Date.now().toString(),
        subjectId:      capturedSubjectId,
        subjectName:    subject?.name,
        startedAt:      capturedStartedAt,
        elapsedSeconds: capturedElapsed,
      });
      if (capturedBackendSessionId) {
        apiCompleteSession(capturedBackendSessionId, capturedElapsed).catch(() => {});
      }
    }

    resetTimer();

    let backendSessionId = null;
    if (nextPhase === 'focus' && nextSubjectId) {
      try {
        const result     = await apiStartSession(nextSubjectId);
        backendSessionId = result?.data?.session?.id ?? null;
      } catch (_) {}
      startSession(nextSubjectId, backendSessionId);
    }

    schedulePomoPhaseEndAlert(nextPhase, nextDuration).catch((e) => console.warn('schedulePomoPhaseEndAlert failed:', e));
    startTimer(true, nextDuration);
    navigation.replace('SessionActive', {
      isPomo:       true,
      phase:        nextPhase,
      totalSeconds: nextDuration,
      subjectId:    nextSubjectId,
    });
  };

  const handleEndPomo = () => {
    if (activeSession) {
      // Focus phase completed — log it and show the session summary
      const endedAt                  = new Date().toISOString();
      const capturedElapsed          = timerTotal;
      const capturedSubjectId        = activeSession.subjectId;
      const capturedStartedAt        = activeSession.startedAt;
      const capturedBackendSessionId = activeSession.backendSessionId;
      logSession({
        id:             Date.now().toString(),
        subjectId:      capturedSubjectId,
        subjectName:    subject?.name,
        startedAt:      capturedStartedAt,
        elapsedSeconds: capturedElapsed,
      });
      disablePomoMode();
      resetTimer();
      navigation.replace('SessionComplete', {
        durationSeconds:  capturedElapsed,
        subjectId:        capturedSubjectId,
        subjectName:      subject?.name,
        subjectColor:     subject?.color ?? subject?.colorHex,
        startedAt:        capturedStartedAt,
        endedAt,
        backendSessionId: capturedBackendSessionId,
        note:             sessionNote || undefined,
      });
    } else {
      // Break phase completed — no session to log, just go home
      resetTimer();
      disablePomoMode();
      navigation.navigate('Main');
    }
  };

  const handleAbandonSession = async () => {
    await cancelPomoAlert().catch(() => {});
    useTimerStore.getState().resetTimer();
    useSessionStore.getState().abandonSession();
    if (isPomo) usePomodoroStore.getState().resetPomo();
    AsyncStorage.removeItem(ASYNC_KEY).catch(() => {});
    navigation.goBack();
  };

  const handleSubjectSwitch = (newSubject) => {
    useSessionStore.getState().switchSubject(newSubject.id);
    setShowSubjectSwitch(false);
  };

  // ── Render ──────────────────────────────────────────────────────

  return (
    <View style={styles.container}>

      {/* ── Top bar ────────────────────────────────────────── */}
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.xs }]}>
        <TouchableOpacity style={styles.topBarBtn} onPress={handleClose}>
          <Ionicons name="close" size={24} color={colors.textSecondary} />
        </TouchableOpacity>

        <Text style={styles.topBarTitle}>{subject?.name ?? 'Session'}</Text>

        <TouchableOpacity style={styles.topBarBtn} onPress={() => setShowActionSheet(true)}>
          <Ionicons name="ellipsis-vertical" size={24} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* ── Session context pill ────────────────────────────── */}
      <View style={[styles.pill, { borderLeftColor: subjectColor }]}>
        <View style={[styles.pillDot, { backgroundColor: subjectColor }]} />
        <Text style={styles.pillText}>{pillText}</Text>
      </View>

      {/* ── Circular timer ──────────────────────────────────── */}
      <View style={styles.ringWrap}>
        {/* Outer decorative border */}
        <View style={styles.outerRing} />

        {/* SVG progress ring — gradient tinted by subject color */}
        <Svg width={260} height={260} style={styles.ringsvg}>
          <Defs>
            <LinearGradient id="arcGrad" x1="1" y1="0" x2="0" y2="0">
              <Stop offset="0%" stopColor={subjectColor} stopOpacity="0.65" />
              <Stop offset="100%" stopColor={subjectColor} stopOpacity="1" />
            </LinearGradient>
          </Defs>
          {/* Track */}
          <Circle
            cx={130} cy={130} r={RING_RADIUS}
            fill="transparent"
            stroke={colors.surfaceDeep}
            strokeWidth={5}
          />
          {/* Progress arc */}
          <Circle
            cx={130} cy={130} r={RING_RADIUS}
            fill="transparent"
            stroke="url(#arcGrad)"
            strokeWidth={5}
            strokeLinecap="round"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={ringOffset}
          />
        </Svg>

        {/* Inner text */}
        <View style={styles.ringInner}>
          <Text style={styles.focusingLabel}>{focusingLabel}</Text>
          <Text style={styles.timerText}>{formatTime(remainingSeconds)}</Text>
          <Text style={styles.elapsedLabel}>{isPomo ? 'remaining' : 'elapsed'}</Text>
        </View>
      </View>

      {/* ── Quote row ───────────────────────────────────────── */}
      <View style={styles.quoteRow}>
        <Ionicons name="chevron-back" size={18} color={colors.textSecondary} />
        <Text style={styles.quoteText}>You're in the zone. Keep going.</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
      </View>

      {/* ── Stats row ───────────────────────────────────────── */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { borderLeftColor: subjectColor }]}>
          <Text style={styles.statLabel}>TODAY</Text>
          <Text style={styles.statValue}>{fmtTotal(todayTotal)}</Text>
        </View>
        <View style={[styles.statCard, { borderLeftColor: subjectColor }]}>
          <Text style={styles.statLabel}>SESSIONS</Text>
          <Text style={styles.statValue}>{ordinal(todaySessions.length + 1)}</Text>
        </View>
        <View style={[styles.statCard, { borderLeftColor: subjectColor }]}>
          <Text style={styles.statLabel}>STREAK</Text>
          <Text style={styles.statValue}>🔥 {streak}</Text>
        </View>
      </View>

      {/* ── Controls ────────────────────────────────────────── */}
      <View style={styles.controls}>
        {/* Note */}
        <View style={styles.controlItem}>
          <View>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => setShowNoteSheet(true)}
            >
              <Ionicons
                name={sessionNote ? 'create' : 'create-outline'}
                size={24}
                color={colors.textPrimary}
              />
            </TouchableOpacity>
            {sessionNote ? <View style={styles.noteDot} /> : null}
          </View>
          <Text style={styles.controlLabel}>Note</Text>
        </View>

        {/* Stop */}
        <View style={styles.stopWrap}>
          <View style={[styles.stopRingOuter, { borderColor: subjectColor }]} />
          <TouchableOpacity
            style={[styles.stopBtn, {
              backgroundColor: subjectColor,
              shadowColor: subjectColor,
            }]}
            onPress={handleStop}
          >
            <Ionicons name="stop" size={28} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Pause / Resume */}
        <View style={styles.controlItem}>
          <TouchableOpacity style={styles.secondaryBtn} onPress={handlePause}>
            <Ionicons
              name={isPaused ? 'play' : 'pause'}
              size={24}
              color={colors.textPrimary}
            />
          </TouchableOpacity>
          <Text style={styles.controlLabel}>{isPaused ? 'Resume' : 'Pause'}</Text>
        </View>
      </View>

      {/* ── Phase-complete overlay ──────────────────────────── */}
      {phaseComplete && (
        <View style={styles.overlay}>
          <Text style={styles.overlayEmoji}>{PHASE_INFO[currentPhase]?.emoji}</Text>
          <Text style={styles.overlayTitle}>
            {currentPhase === 'focus' ? 'Break complete!' : 'Focus complete!'}
          </Text>
          <Text style={styles.overlaySub}>
            {`Time for ${Math.round(getCurrentPhaseDuration() / 60)} min ${
              currentPhase === 'focus' ? 'focus' : 'break'
            }`}
          </Text>
          <TouchableOpacity style={styles.overlayPrimaryBtn} onPress={handleStartNextPhase}>
            <Text style={styles.overlayPrimaryText}>
              Start {PHASE_INFO[currentPhase]?.label.charAt(0) + PHASE_INFO[currentPhase]?.label.slice(1).toLowerCase()}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.overlaySecondaryBtn} onPress={handleEndPomo}>
            <Text style={styles.overlaySecondaryText}>End Pomodoro</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowNoteSheet(true)}>
            <Text style={styles.overlayNoteBtn}>Add note</Text>
          </TouchableOpacity>
        </View>
      )}

      <NoteBottomSheet
        visible={showNoteSheet}
        initialNote={sessionNote}
        onSave={(note) => setSessionNote(note.trim())}
        onClose={() => setShowNoteSheet(false)}
      />

      <SessionActionSheet
        visible={showActionSheet}
        onClose={() => setShowActionSheet(false)}
        onSwitchSubject={() => {
          setShowActionSheet(false);
          setTimeout(() => setShowSubjectSwitch(true), 300);
        }}
        onAddNote={() => {
          setShowActionSheet(false);
          setTimeout(() => setShowNoteSheet(true), 300);
        }}
        onPomodoroSettings={() => {
          setShowActionSheet(false);
          navigation.navigate('AppSettingsModal', { scrollToPomo: true });
        }}
        onAbandon={() => {
          setShowActionSheet(false);
          Alert.alert(
            'Abandon Session?',
            'Your progress will be lost and nothing will be saved.',
            [
              { text: 'Keep Going', style: 'cancel' },
              { text: 'Abandon', style: 'destructive', onPress: handleAbandonSession },
            ]
          );
        }}
        isPomo={isPomo}
        hasNote={sessionNote.length > 0}
        currentSubjectName={subject?.name ?? ''}
        currentSubjectColor={subject?.color ?? subject?.colorHex ?? colors.accentPrimary}
      />

      <SubjectSwitchSheet
        visible={showSubjectSwitch}
        currentSubjectId={activeSession?.subjectId}
        onSelect={handleSubjectSwitch}
        onClose={() => setShowSubjectSwitch(false)}
      />

      {/* ── iPhone home indicator ───────────────────────────── */}
      <View style={styles.homeIndicator} />
    </View>
  );
}

function getStyles(colors) { return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
  },

  // ── Top bar ───────────────────────────────────────────────────
  topBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xs,
  },
  topBarBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBarTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 0.5,
  },

  // ── Pill ──────────────────────────────────────────────────────
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderRadius: 20,
    borderLeftWidth: 2,
    borderLeftColor: colors.accentPrimary,
    marginTop: spacing.sm,
    marginBottom: spacing.xxl,
  },
  pillDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accentPrimary,
  },
  pillText: {
    fontSize: 12,
    color: colors.textSecondary,
  },

  // ── Ring ──────────────────────────────────────────────────────
  ringWrap: {
    width: 300,
    height: 300,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  outerRing: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    borderWidth: 1,
    borderColor: colors.surface,
  },
  ringsvg: {
    position: 'absolute',
    transform: [{ rotate: '-90deg' }],
  },
  ringInner: {
    alignItems: 'center',
  },
  focusingLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accentLight,
    letterSpacing: 3,
    marginBottom: spacing.xs,
  },
  timerText: {
    fontSize: 58,
    fontWeight: '700',
    color: colors.textPrimary,
    lineHeight: 64,
    fontFamily: Platform.select({ ios: 'Courier New', android: 'monospace' }),
  },
  elapsedLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },

  // ── Quote ─────────────────────────────────────────────────────
  quoteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginBottom: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  quoteText: {
    fontSize: 13,
    color: colors.textSecondary,
    letterSpacing: 0.3,
    textAlign: 'center',
    flex: 1,
  },

  // ── Stats ─────────────────────────────────────────────────────
  statsRow: {
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: spacing.xl,
    width: '100%',
    marginBottom: spacing.xl * 2,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderLeftWidth: 3,
    borderLeftColor: colors.accentPrimary,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 1,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
  },

  // ── Controls ──────────────────────────────────────────────────
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 32,
    marginBottom: spacing.xl,
  },
  controlItem: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  secondaryBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  controlLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  noteDot: {
    position:        'absolute',
    top:             0,
    right:           0,
    width:           6,
    height:          6,
    borderRadius:    3,
    backgroundColor: colors.accentPrimary,
  },
  stopWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopRingOuter: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    borderColor: colors.accentPrimary,
    opacity: 0.2,
  },
  stopBtn: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.accentPrimary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.accentPrimary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10,
  },

  // ── Phase-complete overlay ────────────────────────────────────
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,15,15,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.xl * 2,
  },
  overlayEmoji: {
    fontSize: 56,
  },
  overlayTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  overlaySub: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  overlayPrimaryBtn: {
    width: '100%',
    backgroundColor: colors.accentPrimary,
    borderRadius: radius.xl,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  overlayPrimaryText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  overlaySecondaryBtn: {
    width: '100%',
    borderRadius: radius.xl,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  overlaySecondaryText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  overlayNoteBtn: {
    fontSize:          13,
    color:             colors.accentLight,
    paddingVertical:   spacing.md,
    paddingHorizontal: spacing.xl,
  },

  // ── Home indicator ────────────────────────────────────────────
  homeIndicator: {
    position: 'absolute',
    bottom: spacing.xs,
    width: 128,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    opacity: 0.5,
  },
}); }
