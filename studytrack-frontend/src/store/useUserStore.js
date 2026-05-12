import { create } from 'zustand';

const useUserStore = create((set) => ({
  id: 'user_001',
  name: 'Shyam',
  handle: '@shyam_studies',
  avatar: 'S',
  streak: 14,
  totalHours: 1248,
  dailyGoalSeconds: 21600,

  preferences: null,
  group: null,

  setUser: (userData) => set(userData),

  updateStreak: (streak) => set({ streak }),

  setPreferences: (partial) =>
    set((state) => ({
      preferences: state.preferences ? { ...state.preferences, ...partial } : partial,
    })),

  setGroup: (group) => set({ group }),

  reset: () =>
    set({
      id: null,
      name: '',
      handle: '',
      avatar: '',
      streak: 0,
      totalHours: 0,
      dailyGoalSeconds: 21600,
      preferences: null,
      group: null,
    }),
}));

export default useUserStore;
