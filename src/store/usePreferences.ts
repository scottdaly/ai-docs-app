import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PreferencesState {
  showUnsupportedFiles: boolean;
  setShowUnsupportedFiles: (show: boolean) => void;
}

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      showUnsupportedFiles: false,
      setShowUnsupportedFiles: (show) => set({ showUnsupportedFiles: show }),
    }),
    {
      name: 'midlight-preferences',
    }
  )
);
