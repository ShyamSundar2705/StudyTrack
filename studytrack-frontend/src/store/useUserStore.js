import { create } from 'zustand';

const useUserStore = create((set) => ({
  // State — matches ProfileScreen placeholder data
  id: 'user_001',
  name: 'Shyam',
  handle: '@shyam_studies',
  avatar: 'S',          // initial used in avatar circle
  streak: 14,           // "14 Day Streak"
  totalHours: 1248,     // lifetime stat shown on ProfileScreen
  dailyGoalSeconds: 21600, // 6 hours — "4h 12m / 6h" on ProfileScreen

  preferences: null,    // full UserPreferences object from backend

  // Actions
  setUser: (userData) => set(userData),

  updateStreak: (streak) => set({ streak }),

  setPreferences: (partial) =>
    set((state) => ({
      preferences: state.preferences ? { ...state.preferences, ...partial } : partial,
    })),

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
    }),
}));

export default useUserStore;
