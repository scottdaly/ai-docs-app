import { create } from 'zustand';

type SettingsTab = 'general' | 'editor' | 'versioning' | 'appearance' | 'ai' | 'account';

interface SettingsState {
  isOpen: boolean;
  activeTab: SettingsTab;
  setIsOpen: (isOpen: boolean) => void;
  setActiveTab: (tab: SettingsTab) => void;
  openSettings: (tab?: SettingsTab) => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  isOpen: false,
  activeTab: 'general',
  setIsOpen: (isOpen) => set({ isOpen }),
  setActiveTab: (activeTab) => set({ activeTab }),
  openSettings: (tab = 'general') => set({ isOpen: true, activeTab: tab }),
}));
