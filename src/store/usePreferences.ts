import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PreferencesState {
  showUnsupportedFiles: boolean;
  setShowUnsupportedFiles: (show: boolean) => void;

  // Error reporting (opt-in, disabled by default)
  errorReportingEnabled: boolean;
  setErrorReportingEnabled: (enabled: boolean) => void;
}

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      showUnsupportedFiles: false,
      setShowUnsupportedFiles: (show) => set({ showUnsupportedFiles: show }),

      // Error reporting enabled by default (opt-out)
      errorReportingEnabled: true,
      setErrorReportingEnabled: (enabled) => {
        set({ errorReportingEnabled: enabled });
        // Sync with main process
        window.electronAPI?.setErrorReportingEnabled?.(enabled);
      },
    }),
    {
      name: 'midlight-preferences',
      // When hydrating from storage, sync the setting to main process
      onRehydrateStorage: () => (state) => {
        if (state?.errorReportingEnabled) {
          window.electronAPI?.setErrorReportingEnabled?.(state.errorReportingEnabled);
        }
      },
    }
  )
);
