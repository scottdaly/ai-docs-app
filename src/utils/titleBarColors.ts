/**
 * Maps theme names to Windows titlebar overlay colors.
 * These colors match the --background and --foreground CSS variables for each theme.
 */

export interface TitleBarOverlayColors {
  color: string;      // Background color (hex)
  symbolColor: string; // Icon/text color (hex)
}

// Pre-computed hex values matching the HSL theme definitions in index.css
const themeColors: Record<string, TitleBarOverlayColors> = {
  light: {
    color: '#ffffff',
    symbolColor: '#0a0f1a',
  },
  dark: {
    color: '#0a0a0b',
    symbolColor: '#fafafa',
  },
  midnight: {
    color: '#0f172a',
    symbolColor: '#f1f5f9',
  },
  sepia: {
    color: '#f5f1eb',
    symbolColor: '#1f1915',
  },
  forest: {
    color: '#162117',
    symbolColor: '#f5faf5',
  },
  cyberpunk: {
    color: '#1a0d26',
    symbolColor: '#f5e6fa',
  },
  coffee: {
    color: '#f2ede7',
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
