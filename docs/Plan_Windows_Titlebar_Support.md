# Windows Titlebar & Menu Support Plan

## Problem Statement

The app uses `titleBarStyle: 'hidden'` which works well on macOS (shows traffic lights with `trafficLightPosition`) but on Windows:
1. **No window controls** - minimize, maximize, close buttons are completely hidden
2. **No menu bar** - the application menu (File, Edit, View, etc.) is not visible

## Root Cause

- macOS with `titleBarStyle: 'hidden'` still shows the native traffic light buttons
- Windows with `titleBarStyle: 'hidden'` completely removes all window chrome including controls
- `Menu.setApplicationMenu()` integrates with macOS's top menu bar, but Windows expects a menu bar within the window frame

## Solution: Platform-Specific Window Configuration

### Approach: `titleBarOverlay` on Windows + Custom Menu Button

Use Electron's `titleBarOverlay` option on Windows which:
- Shows native Windows window controls (minimize, maximize, close) in the top-right
- Allows custom titlebar content
- Maintains native look and feel for Windows users

---

## Implementation Plan

### Phase 1: Main Process - Platform-Specific BrowserWindow Config

**File: `electron/main.ts`**

1. Detect platform at window creation
2. Configure BrowserWindow options per platform:

```typescript
const isMac = process.platform === 'darwin';
const isWindows = process.platform === 'win32';

win = new BrowserWindow({
  icon: path.join(process.env.VITE_PUBLIC || '', 'electron-vite.svg'),
  width: 1200,
  height: 800,
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
  },
  // macOS: hidden titlebar with traffic lights
  ...(isMac && {
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 15, y: 15 },
  }),
  // Windows: frameless with native overlay controls
  ...(isWindows && {
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#ffffff',      // Will be updated dynamically for themes
      symbolColor: '#000000',
      height: 40,            // Match TitleBar height (h-10 = 40px)
    },
  }),
  // Linux: Use default frame for now (most compatible)
});
```

3. Add IPC handler to update titlebar overlay colors when theme changes:

```typescript
ipcMain.handle('update-titlebar-overlay', (_event, colors: { color: string; symbolColor: string }) => {
  if (process.platform === 'win32' && win) {
    win.setTitleBarOverlay({
      color: colors.color,
      symbolColor: colors.symbolColor,
      height: 40,
    });
  }
});
```

### Phase 2: Add Platform Info to Preload

**File: `electron/preload.ts`**

Expose platform information to renderer:

```typescript
contextBridge.exposeInMainWorld('electronAPI', {
  // ... existing APIs

  // Platform info
  platform: process.platform, // 'darwin' | 'win32' | 'linux'

  // Update titlebar overlay colors (Windows only)
  updateTitleBarOverlay: (colors: { color: string; symbolColor: string }) =>
    ipcRenderer.invoke('update-titlebar-overlay', colors),
});
```

### Phase 3: Update TitleBar Component

**File: `src/components/TitleBar.tsx`**

Make the TitleBar platform-aware:

1. Add left padding on macOS for traffic lights (already exists via layout)
2. Add right padding on Windows for overlay controls
3. Add a menu button for Windows (hamburger icon that opens dropdown)

```tsx
export function TitleBar() {
  const { theme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const platform = window.electronAPI?.platform || 'darwin';
  const isWindows = platform === 'win32';
  const isMac = platform === 'darwin';

  // Update Windows titlebar overlay colors when theme changes
  useEffect(() => {
    if (isWindows && window.electronAPI?.updateTitleBarOverlay) {
      const colors = getThemeColors(theme); // Map theme to colors
      window.electronAPI.updateTitleBarOverlay(colors);
    }
  }, [theme, isWindows]);

  return (
    <div className={cn(
      "h-10 bg-background border-b flex items-center select-none app-region-drag",
      isMac && "pl-20",           // Space for traffic lights
      isWindows && "pr-36",       // Space for overlay controls (~140px)
    )}>
      {/* Menu button for Windows */}
      {isWindows && (
        <MenuButton open={menuOpen} onOpenChange={setMenuOpen} />
      )}

      {/* Centered title */}
      <div className="flex-1 flex justify-center">
        <span className="text-xs text-muted-foreground font-medium">
          Midlight
        </span>
      </div>
    </div>
  );
}
```

### Phase 4: Create Windows Menu Dropdown Component

**File: `src/components/WindowsMenu.tsx`**

Create a dropdown menu that mirrors the native menu structure:

```tsx
export function WindowsMenu({ open, onOpenChange }: Props) {
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <button className="app-region-no-drag p-2 hover:bg-accent rounded">
          <Menu className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {/* File Menu */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>File</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onClick={() => triggerMenuAction('open-workspace')}>
              Open Workspace... <span className="ml-auto text-xs">Ctrl+O</span>
            </DropdownMenuItem>
            {/* ... more items */}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        {/* Edit, View, Window, Help menus */}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

### Phase 5: Theme Color Mapping

Create a utility to map theme names to titlebar overlay colors:

```typescript
// src/utils/themeColors.ts
export function getTitleBarOverlayColors(theme: string): { color: string; symbolColor: string } {
  const colors: Record<string, { color: string; symbolColor: string }> = {
    light: { color: '#ffffff', symbolColor: '#000000' },
    dark: { color: '#1a1a1a', symbolColor: '#ffffff' },
    midnight: { color: '#0f172a', symbolColor: '#e2e8f0' },
    sepia: { color: '#faf6f1', symbolColor: '#5c4033' },
    forest: { color: '#1a2f1a', symbolColor: '#90c090' },
    cyberpunk: { color: '#0d0d0d', symbolColor: '#ff00ff' },
    coffee: { color: '#2c1810', symbolColor: '#d4a574' },
  };

  if (theme === 'system') {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return isDark ? colors.dark : colors.light;
  }

  return colors[theme] || colors.light;
}
```

---

## File Changes Summary

| File | Change |
|------|--------|
| `electron/main.ts` | Platform-specific BrowserWindow config, IPC for overlay updates |
| `electron/preload.ts` | Expose `platform` and `updateTitleBarOverlay` |
| `src/components/TitleBar.tsx` | Platform-aware padding, menu button for Windows |
| `src/components/WindowsMenu.tsx` | New - dropdown menu for Windows |
| `src/utils/themeColors.ts` | New - theme to titlebar color mapping |
| `src/types/electron.d.ts` | Update type definitions |

---

## Alternative Considerations

### Why not just show native frame on Windows?
- Would lose the custom titlebar aesthetic
- Inconsistent experience between platforms
- Less control over spacing and layout

### Why not fully custom window controls?
- Native overlay controls look and feel right on Windows
- Proper DPI handling, animations, and accessibility
- Less maintenance burden

### Why menu button instead of `autoHideMenuBar`?
- More discoverable for users (visible hamburger icon)
- `autoHideMenuBar` requires pressing Alt, which isn't intuitive
- Menu button can be styled to match the app theme

---

## Testing Checklist

- [ ] Window controls (min/max/close) work on Windows
- [ ] Menu button opens dropdown with all menu items
- [ ] Keyboard shortcuts still work (Ctrl+S, Ctrl+O, etc.)
- [ ] Theme changes update titlebar overlay colors
- [ ] Drag region works for moving window
- [ ] macOS traffic lights still work correctly
- [ ] Linux uses default frame (fallback)
