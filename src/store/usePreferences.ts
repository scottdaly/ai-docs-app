import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type PageMode = 'continuous' | 'paginated';

interface PreferencesState {
  showUnsupportedFiles: boolean;
  setShowUnsupportedFiles: (show: boolean) => void;

  // Error reporting (opt-in, disabled by default)
  errorReportingEnabled: boolean;
  setErrorReportingEnabled: (enabled: boolean) => void;

  // Page mode: continuous (infinite scroll) or paginated (page breaks like Word/Docs)
  pageMode: PageMode;
  setPageMode: (mode: PageMode) => void;

  // Show page numbers in paginated mode
  showPageNumbers: boolean;
  setShowPageNumbers: (show: boolean) => void;
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

      // Page mode: paginated by default (like Word/Docs)
      pageMode: 'paginated',
      setPageMode: (mode) => set({ pageMode: mode }),

      // Show page numbers: disabled by default
      showPageNumbers: false,
      setShowPageNumbers: (show) => set({ showPageNumbers: show }),
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
