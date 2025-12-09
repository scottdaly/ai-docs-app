/**
 * Maps theme names to Windows titlebar overlay colors.
 * These colors match the --background and --foreground CSS variables for each theme.
 */

export interface TitleBarOverlayColors {
  color: string;      // Background color (hex)
  symbolColor: string; // Icon/text color (hex)
}

// Pre-computed hex values matching the --secondary HSL theme definitions in index.css
// These match the TitleBar's bg-secondary background color
const themeColors: Record<string, TitleBarOverlayColors> = {
  light: {
    color: '#f1f5f9',  // --secondary: 210 40% 96.1%
    symbolColor: '#0f172a',
  },
  dark: {
    color: '#0a0a0b',  // --secondary: 240 10% 3.9%
    symbolColor: '#fafafa',
  },
  midnight: {
    color: '#0f172a',  // --secondary: 222 47% 11%
    symbolColor: '#f1f5f9',
  },
  sepia: {
    color: '#f0ebe3',  // --secondary: 40 20% 90%
    symbolColor: '#1f1915',
  },
  forest: {
    color: '#253d2a',  // --secondary: 150 20% 18%
    symbolColor: '#f5faf5',
  },
  cyberpunk: {
    color: '#2d1f47',  // --secondary: 265 40% 20%
    symbolColor: '#f5e6fa',
  },
  coffee: {
    color: '#e8e0d5',  // --secondary: 30 20% 88%
    symbolColor: '#3d3029',
  },
};

/**
 * Get titlebar overlay colors for a given theme.
 * Handles 'system' theme by checking system preference.
 */
export function getTitleBarOverlayColors(theme: string): TitleBarOverlayColors {
  if (theme === 'system') {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return isDark ? themeColors.dark : themeColors.light;
  }

  return themeColors[theme] || themeColors.light;
}
