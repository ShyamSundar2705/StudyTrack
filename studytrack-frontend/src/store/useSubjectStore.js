import { create } from 'zustand';

// Colors pulled directly from theme.js
const useSubjectStore = create((set) => ({
  // State — subjects shown across HomeTimerScreen, InsightsScreen, ProfileScreen
  subjects: [],

  // Actions
  addSubject: (subject) =>
    set((state) => ({ subjects: [...state.subjects, subject] })),

  removeSubject: (id) =>
    set((state) => ({
      subjects: state.subjects.filter((s) => s.id !== id),
    })),

  updateSubject: (id, updates) =>
    set((state) => ({
      subjects: state.subjects.map((s) =>
        s.id === id ? { ...s, ...updates } : s
      ),
    })),

  setSubjects: (subjects) => set({ subjects }),
}));

export default useSubjectStore;
