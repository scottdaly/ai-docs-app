import { create } from 'zustand';

interface SettingsState {
  isOpen: boolean;
  activeTab: 'general' | 'appearance' | 'ai';
  setIsOpen: (isOpen: boolean) => void;
  setActiveTab: (tab: 'general' | 'appearance' | 'ai') => void;
  openSettings: (tab?: 'general' | 'appearance' | 'ai') => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  isOpen: false,
  activeTab: 'general',
  setIsOpen: (isOpen) => set({ isOpen }),
  setActiveTab: (activeTab) => set({ activeTab }),
  openSettings: (tab = 'general') => set({ isOpen: true, activeTab: tab }),
}));
