import { useTheme } from '../store/useTheme';
import { useEffect } from 'react';
import { getTitleBarOverlayColors } from '../utils/titleBarColors';
import { WindowsMenu } from './WindowsMenu';
import { TabBar } from './TabBar';
import { cn } from '../lib/utils';

// Platform detection (safe for SSR/non-Electron environments)
const platform = typeof window !== 'undefined' && window.electronAPI?.platform || 'darwin';
const isMac = platform === 'darwin';
const isWindows = platform === 'win32';

export function TitleBar() {
  const { theme } = useTheme();

  // Initialize theme on mount
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark', 'midnight', 'sepia', 'forest', 'cyberpunk', 'coffee');

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  }, []);

  // Update Windows titlebar overlay colors when theme changes
  useEffect(() => {
    if (isWindows && window.electronAPI?.updateTitleBarOverlay) {
      const colors = getTitleBarOverlayColors(theme);
      window.electronAPI.updateTitleBarOverlay(colors);
    }
  }, [theme]);

  // Listen for system theme changes when using 'system' theme
  useEffect(() => {
    if (theme !== 'system' || !isWindows) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (window.electronAPI?.updateTitleBarOverlay) {
        const colors = getTitleBarOverlayColors('system');
        window.electronAPI.updateTitleBarOverlay(colors);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  return (
    <div
      className={cn(
        "h-10 bg-secondary flex items-center select-none draggable app-region-drag",
        // macOS: leave space for traffic lights on the left
        isMac && "pl-20",
        // Windows: leave space for overlay controls on the right
        isWindows && "pr-36",
      )}
    >
      {/* Menu button for Windows/Linux */}
      {!isMac && (
        <div className="app-region-no-drag">
          <WindowsMenu />
        </div>
      )}

      {/* Tab bar in title bar */}
      <div className="flex-1 min-w-0 h-full app-region-no-drag">
        <TabBar inTitleBar />
      </div>
    </div>
  );
}
