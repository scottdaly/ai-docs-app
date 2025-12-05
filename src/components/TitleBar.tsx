import { useTheme } from '../store/useTheme';
import { useEffect } from 'react';

export function TitleBar() {
  const { theme } = useTheme();

  // Initialize theme on mount
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark', 'midnight', 'sepia');
    
    if (theme === 'system') {
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        root.classList.add(systemTheme);
    } else {
        root.classList.add(theme);
    }
  }, []);

  return (
    <div className="h-10 bg-background border-b flex items-center px-4 select-none draggable app-region-drag justify-center">
      <div className="text-xs text-muted-foreground font-medium">
        Midlight
      </div>
    </div>
  );
}
