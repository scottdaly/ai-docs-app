import { create } from 'zustand';

interface ExportState {
  isExporting: boolean;
  setIsExporting: (isExporting: boolean) => void;
}

export const useExportStore = create<ExportState>((set) => ({
  isExporting: false,
  setIsExporting: (isExporting) => set({ isExporting }),
}));
