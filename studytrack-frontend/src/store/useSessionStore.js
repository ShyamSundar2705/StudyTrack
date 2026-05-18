import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getGroupSocket } from '../api/socket';
import useSubjectStore from './useSubjectStore';
import useUserStore from './useUserStore';

const INTERRUPTED_SESSION_KEY = 'studytrack:interrupted_session';

const useSessionStore = create((set, get) => ({
  // State
  activeSession: null,
  backgroundThreshold: 900,

  todaySessions: [],

  // Actions
  startSession: (subjectId, backendSessionId = null) => {
    set({
      activeSession: {
        subjectId,
        backendSessionId,
        startedAt: new Date().toISOString(),
        elapsedSeconds: 0,
        isPaused: false,
        pausedAt: null,
      },
    });
    const subjects = useSubjectStore.getState().subjects;
    const subj = subjects.find((s) => s.id === subjectId);
    const userId = useUserStore.getState().id;
    const socket = getGroupSocket();
    if (socket.connected) {
      socket.emit('session_started', {
        userId,
        subjectName: subj?.name ?? '',
        subjectColor: subj?.color ?? '',
        elapsedSeconds: 0,
      });
    }
  },

  pauseSession: () => {
    set((state) => ({
      activeSession: state.activeSession
        ? { ...state.activeSession, isPaused: true, pausedAt: new Date().toISOString() }
        : null,
    }));
    const userId = useUserStore.getState().id;
    const socket = getGroupSocket();
    if (socket.connected) {
      socket.emit('session_paused', { userId });
    }
  },

  resumeSession: () =>
    set((state) => ({
      activeSession: state.activeSession
        ? { ...state.activeSession, isPaused: false, pausedAt: null }
        : null,
    })),

  stopSession: () => set({ activeSession: null }),

  logSession: (session) => {
    set((state) => ({
      todaySessions: [...state.todaySessions, session],
      activeSession: null,
    }));
    const userId = useUserStore.getState().id;
    const subjects = useSubjectStore.getState().subjects;
    const subj = subjects.find((s) => s.id === session.subjectId);
    const socket = getGroupSocket();
    if (socket.connected) {
      socket.emit('session_completed', {
        userId,
        subjectName: subj?.name ?? session.subjectName ?? '',
        durationSeconds: session.elapsedSeconds ?? 0,
      });
    }
  },

  addSession: (session) =>
    set((state) => ({
      todaySessions: [...state.todaySessions, session].sort(
        (a, b) => new Date(a.startedAt) - new Date(b.startedAt)
      ),
    })),

  setTodaySessions: (sessions) => set({ todaySessions: sessions }),

  abandonSession: () => set({ activeSession: null }),

  switchSubject: (subjectId) =>
    set((state) => ({
      activeSession: state.activeSession
        ? { ...state.activeSession, subjectId }
        : null,
    })),

  handleForeground: (backgroundedAt, navigation) => {
    const { activeSession, backgroundThreshold, logSession } = get();
    const useTimerStore = require('./useTimerStore').default;

    if (!activeSession || !useTimerStore.getState().isRunning) return;

    const elapsed = Math.floor((Date.now() - backgroundedAt) / 1000);

    if (elapsed < backgroundThreshold) {
      useTimerStore.getState().addElapsedSeconds(elapsed);
    } else {
      const timerElapsed    = useTimerStore.getState().elapsedSeconds;
      const durationSeconds = timerElapsed + elapsed;
      const endedAt         = new Date(backgroundedAt + elapsed * 1000).toISOString();

      const capturedSubjectId        = activeSession.subjectId;
      const capturedStartedAt        = activeSession.startedAt;
      const capturedBackendSessionId = activeSession.backendSessionId;

      const subjects = useSubjectStore.getState().subjects;
      const subj     = subjects.find((s) => s.id === capturedSubjectId);

      logSession({
        id:             Date.now().toString(),
        subjectId:      capturedSubjectId,
        subjectName:    subj?.name,
        startedAt:      capturedStartedAt,
        elapsedSeconds: durationSeconds,
      });

      useTimerStore.getState().resetTimer();
      AsyncStorage.removeItem(INTERRUPTED_SESSION_KEY).catch(() => {});

      navigation.replace('SessionComplete', {
        durationSeconds,
        subjectId:        capturedSubjectId,
        subjectName:      subj?.name,
        subjectColor:     subj?.color ?? subj?.colorHex,
        startedAt:        capturedStartedAt,
        endedAt,
        backendSessionId: capturedBackendSessionId,
      });
    }
  },
}));

export default useSessionStore;
