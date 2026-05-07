import { create } from 'zustand';
import { getGroupSocket } from '../api/socket';
import useSubjectStore from './useSubjectStore';
import useUserStore from './useUserStore';

const useSessionStore = create((set) => ({
  // State
  activeSession: null,

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
}));

export default useSessionStore;
