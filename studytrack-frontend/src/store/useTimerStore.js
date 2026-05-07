import { create } from 'zustand';
import { getGroupSocket } from '../api/socket';
import useSessionStore from './useSessionStore';
import useUserStore from './useUserStore';
import useSubjectStore from './useSubjectStore';

const useTimerStore = create((set, get) => ({
  // State
  isRunning:      false,
  elapsedSeconds: 0,
  intervalId:     null,
  tickIntervalId: null,

  // Pomodoro countdown fields
  isCountdown:  false,
  totalSeconds: 0,

  // Actions
  startTimer: (isCountdown = false, totalSeconds = 0) => {
    if (get().isRunning) return;

    set({ isCountdown, totalSeconds });

    const id = setInterval(() => {
      const state = get();
      const newElapsed = state.elapsedSeconds + 1;

      if (state.isCountdown && newElapsed >= state.totalSeconds) {
        // Phase complete — stop interval
        clearInterval(state.intervalId);
        if (state.tickIntervalId) clearInterval(state.tickIntervalId);

        // Advance Pomodoro phase (lazy import to avoid circular dep at module load)
        const usePomodoroStore = require('./usePomodoroStore').default;
        const nextPhase        = usePomodoroStore.getState().advancePhase();
        const nextDuration     = usePomodoroStore.getState().getCurrentPhaseDuration();

        // Auto-start next phase if configured — schedule notification after a short delay
        // so the current phase notification fires before we reschedule
        const { autoStartBreaks } = usePomodoroStore.getState().config;
        if (autoStartBreaks) {
          setTimeout(() => {
            import('../utils/notifications').then(({ schedulePomoPhaseEndAlert }) => {
              schedulePomoPhaseEndAlert(nextPhase, nextDuration).catch(() => {});
            });
            get().startTimer(true, nextDuration);
          }, 1500);
        }

        set({
          elapsedSeconds: state.totalSeconds,
          intervalId:     null,
          tickIntervalId: null,
          isRunning:      false,
        });
        return;
      }

      set({ elapsedSeconds: newElapsed });

      // Milestone check — only in normal (non-countdown) mode
      const { activeSession: as } = useSessionStore.getState();
      if (as && !state.isCountdown) {
        const subjects = useSubjectStore.getState().subjects;
        const subj = subjects.find((s) => s.id === as.subjectId);
        import('../utils/notifications').then(({ checkAndFireMilestone }) => {
          checkAndFireMilestone(
            newElapsed,
            useUserStore.getState().dailyGoalSeconds,
            subj?.name ?? ''
          ).catch(() => {});
        });
      }
    }, 1000);

    // Every 30 s, broadcast elapsed time to group members
    const tickId = setInterval(() => {
      const activeSession = useSessionStore.getState().activeSession;
      if (!activeSession) return;
      const socket = getGroupSocket();
      if (socket.connected) {
        socket.emit('session_tick', {
          userId:         useUserStore.getState().id,
          elapsedSeconds: get().elapsedSeconds,
        });
      }
    }, 30000);

    set({ isRunning: true, intervalId: id, tickIntervalId: tickId });
  },

  pauseTimer: () => {
    const { intervalId, tickIntervalId } = get();
    if (intervalId)     clearInterval(intervalId);
    if (tickIntervalId) clearInterval(tickIntervalId);
    set({ isRunning: false, intervalId: null, tickIntervalId: null });
  },

  resetTimer: () => {
    const { intervalId, tickIntervalId } = get();
    if (intervalId)     clearInterval(intervalId);
    if (tickIntervalId) clearInterval(tickIntervalId);
    set({
      isRunning:      false,
      elapsedSeconds: 0,
      intervalId:     null,
      tickIntervalId: null,
      isCountdown:    false,
      totalSeconds:   0,
    });
  },

  // Used when resuming an interrupted session from AsyncStorage
  setElapsedSeconds: (seconds) => set({ elapsedSeconds: seconds }),
}));

export default useTimerStore;
