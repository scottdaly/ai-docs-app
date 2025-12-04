import { create } from 'zustand';

export type Theme = 'light' | 'dark' | 'midnight' | 'sepia' | 'forest' | 'cyberpunk' | 'coffee' | 'system';

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const useTheme = create<ThemeState>((set) => ({
  theme: (localStorage.getItem('vite-ui-theme') as Theme) || 'system',
  setTheme: (theme) => {
    localStorage.setItem('vite-ui-theme', theme);
    set({ theme });
    
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark', 'midnight', 'sepia', 'forest', 'cyberpunk', 'coffee');

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
      root.classList.add(systemTheme);
      return;
    }

    root.classList.add(theme);
  },
}));
