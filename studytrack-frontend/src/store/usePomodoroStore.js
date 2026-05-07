import { create } from 'zustand';

const DEFAULT_CONFIG = {
  focusMinutes:      25,
  shortBreakMinutes: 5,
  longBreakMinutes:  15,
  longBreakAfter:    4,
  autoStartBreaks:   false,
};

const usePomodoroStore = create((set, get) => ({
  // Config (fetched from backend on app start)
  config: DEFAULT_CONFIG,

  // Runtime state
  isPomoMode:      false,
  currentPhase:    'focus',   // 'focus' | 'short_break' | 'long_break'
  currentRound:    1,
  completedRounds: 0,

  // ── Actions ──────────────────────────────────────────────────

  setConfig: (partial) => set((state) => ({
    config: { ...state.config, ...partial },
  })),

  enablePomoMode: () => set({
    isPomoMode:      true,
    currentPhase:    'focus',
    currentRound:    1,
    completedRounds: 0,
  }),

  disablePomoMode: () => set({
    isPomoMode:      false,
    currentPhase:    'focus',
    currentRound:    1,
    completedRounds: 0,
  }),

  // Called when a phase countdown finishes (from useTimerStore).
  // Mutates currentPhase / currentRound / completedRounds and returns the NEW phase name.
  advancePhase: () => {
    const { currentPhase, currentRound, completedRounds, config } = get();

    if (currentPhase === 'focus') {
      const newCompleted = completedRounds + 1;
      const isLongBreak  = newCompleted % config.longBreakAfter === 0;
      const nextPhase    = isLongBreak ? 'long_break' : 'short_break';
      set({ currentPhase: nextPhase, completedRounds: newCompleted });
      return nextPhase;
    } else {
      // Break finished — back to focus
      const nextRound = currentRound + 1;
      set({ currentPhase: 'focus', currentRound: nextRound });
      return 'focus';
    }
  },

  // Returns duration in seconds for the current phase
  getCurrentPhaseDuration: () => {
    const { currentPhase, config } = get();
    if (currentPhase === 'short_break') return config.shortBreakMinutes * 60;
    if (currentPhase === 'long_break')  return config.longBreakMinutes  * 60;
    return config.focusMinutes * 60;
  },

  resetPomo: () => set({
    isPomoMode:      false,
    currentPhase:    'focus',
    currentRound:    1,
    completedRounds: 0,
  }),
}));

export default usePomodoroStore;
