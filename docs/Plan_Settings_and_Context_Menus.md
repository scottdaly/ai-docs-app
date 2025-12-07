# Plan: Settings Menu & Browser Context Menus

## Overview

This document outlines the implementation plan for two related features:
1. **Settings Menu** - Expanding the existing SettingsModal with document default preferences
2. **Browser Context Menus** - Right-click menus for files and folders in the sidebar

---

## Current State

### Settings
- `SettingsModal.tsx` exists with 3 tabs: Appearance, General (empty), AI Models (placeholder)
- Theme selection is fully functional (8 themes)
- `WorkspaceConfig.defaults` already has structure for `font`, `fontSize`, `theme`
- `DocumentSettings` type exists with comprehensive styling options
- APIs exist: `workspaceGetConfig()`, `workspaceUpdateConfig()`

### File Browser
- `Sidebar.tsx` with `FileTreeItem` component
- Actions: open file, expand folder, create new document
- No context menus currently implemented
- Radix UI `DropdownMenu` primitives available

---

## Part 1: Settings Menu Enhancement

### 1.1 General Tab - Document Defaults

**Location**: `src/components/SettingsModal.tsx` (General tab)

**Settings to Add**:

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| Default Font | Select | Merriweather | Font family for new documents |
| Default Font Size | Select | 16px | Base font size for new documents |
| Default Line Height | Select | 1.6 | Line spacing |
| Spellcheck | Toggle | true | Enable browser spellcheck |
| Auto-save Interval | Select | 1s | Debounce time for auto-save |

**Font Options**:
- Serif: Merriweather, Georgia, Times New Roman, Lora
- Sans-serif: Inter, Open Sans, Roboto, System UI
- Monospace: JetBrains Mono, Fira Code, Monaco

**Font Size Options**: 12px, 14px, 16px, 18px, 20px, 24px

**Line Height Options**: 1.4, 1.5, 1.6, 1.8, 2.0

### 1.2 Editor Tab (New)

**Settings to Add**:

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| Show Word Count | Toggle | true | Display word count in status bar |
| Show Character Count | Toggle | false | Display character count |
| Focus Mode | Toggle | false | Dim non-active paragraphs |
| Typewriter Mode | Toggle | false | Keep cursor centered vertically |

### 1.3 Versioning Tab (New)

**Settings to Add**:

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| Auto Checkpoints | Toggle | true | Create automatic version checkpoints |
| Checkpoint Interval | Select | 5 min | Time between auto-checkpoints |
| Min Change Threshold | Select | 50 chars | Minimum changes to trigger checkpoint |
| Max Checkpoints | Select | 50 | Maximum checkpoints per file |
| Retention Period | Select | 7 days | How long to keep auto-checkpoints |

### 1.4 Storage Implementation

**Workspace-level settings** (stored in `.midlight/config.json`):
```typescript
interface WorkspaceConfig {
  // ... existing fields ...
  defaults: {
    font: string;
    fontSize: string;
    lineHeight: string;
    theme: string;
  };
  editor: {
    showWordCount: boolean;
    showCharCount: boolean;
    focusMode: boolean;
    typewriterMode: boolean;
    spellcheck: boolean;
    autoSaveIntervalMs: number;
  };
  versioning: {
    enabled: boolean;
    checkpointIntervalMs: number;
    minChangeChars: number;
    maxCheckpointsPerFile: number;
    retentionDays: number;
  };
}
```

**App-level settings** (stored in localStorage via Zustand):
- Window size/position preferences
- Recently opened workspaces
- UI preferences (sidebar width, panel visibility)

### 1.5 UI Design

```
┌─────────────────────────────────────────────────────────┐
│  Settings                                          [X]  │
├─────────────────────────────────────────────────────────┤
│  [Appearance] [General] [Editor] [Versioning] [AI]      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Document Defaults                                      │
│  ─────────────────                                      │
│                                                         │
│  Default Font                                           │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Merriweather                                  ▼ │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  Font Size                    Line Height               │
│  ┌───────────────────┐       ┌───────────────────┐     │
│  │ 16px           ▼ │       │ 1.6            ▼ │     │
│  └───────────────────┘       └───────────────────┘     │
│                                                         │
│  ☑ Enable spellcheck                                   │
│                                                         │
│  Auto-save                                              │
│  ┌─────────────────────────────────────────────────┐   │
│  │ After 1 second of inactivity                  ▼ │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ─────────────────────────────────────────────────────  │
│  These settings apply to new documents in this         │
│  workspace.                                            │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Part 2: Browser Context Menus

### 2.1 File Context Menu

**Right-click on a file** shows:

| Action | Shortcut | Description |
|--------|----------|-------------|
| Open | Enter | Open file in editor |
| Open in New Tab | - | Open without closing current |
| --- | --- | --- |
| Rename | F2 | Inline rename |
| Duplicate | - | Create copy with "(copy)" suffix |
| Move to... | - | Open folder picker dialog |
| --- | --- | --- |
| Copy Path | - | Copy absolute path to clipboard |
| Reveal in Finder | - | Open containing folder in OS |
| --- | --- | --- |
| Delete | ⌫ | Move to trash with confirmation |

### 2.2 Folder Context Menu

**Right-click on a folder** shows:

| Action | Shortcut | Description |
|--------|----------|-------------|
| New Document | - | Create new .md file in this folder |
| New Folder | - | Create new subfolder |
| --- | --- | --- |
| Rename | F2 | Inline rename |
| --- | --- | --- |
| Copy Path | - | Copy absolute path to clipboard |
| Reveal in Finder | - | Open folder in OS |
| --- | --- | --- |
| Delete | ⌫ | Delete folder (with confirmation if not empty) |

### 2.3 Empty Area Context Menu

**Right-click on empty sidebar area** (below file tree):

| Action | Description |
|--------|-------------|
| New Document | Create in root |
| New Folder | Create in root |
| --- | --- |
| Refresh | Reload file tree |

### 2.4 Implementation Approach

**Option A: React Context Menu (Recommended)**
- Use Radix UI `ContextMenu` component (similar to existing `DropdownMenu`)
- Pros: Consistent styling, works everywhere, easier state management
- Cons: Slightly less native feel

**Option B: Electron Context Menu**
- Use `Menu.buildFromTemplate()` in main process
- Pros: Native OS look and feel
- Cons: More complex IPC, harder to customize styling

**Recommendation**: Use Radix UI `ContextMenu` for consistency with existing UI patterns.

### 2.5 Required IPC Handlers

New handlers needed in `electron/main.ts`:

```typescript
// File operations
ipcMain.handle('file:duplicate', (_, path) => {...})
ipcMain.handle('file:moveTo', (_, sourcePath, destFolder) => {...})
ipcMain.handle('file:copyPath', (_, path) => {...})
ipcMain.handle('file:revealInFinder', (_, path) => {...})
ipcMain.handle('file:trash', (_, path) => {...})

// Folder operations
ipcMain.handle('folder:create', (_, parentPath, name) => {...})
ipcMain.handle('folder:delete', (_, path) => {...})
```

### 2.6 UI Components to Create

```
src/components/
├── context-menus/
│   ├── FileContextMenu.tsx      # Context menu for files
│   ├── FolderContextMenu.tsx    # Context menu for folders
│   └── SidebarContextMenu.tsx   # Context menu for empty area
└── ui/
    └── context-menu.tsx         # Radix UI context menu primitives
```

### 2.7 Context Menu Visual Design

```
┌──────────────────────────┐
│ Open                     │
│ Open in New Tab          │
├──────────────────────────┤
│ Rename              F2   │
│ Duplicate                │
│ Move to...               │
├──────────────────────────┤
│ Copy Path                │
│ Reveal in Finder         │
├──────────────────────────┤
│ Delete              ⌫    │
└──────────────────────────┘
```

---

## Implementation Phases

### Phase A: Settings Menu (Priority: High)

**A1: Expand WorkspaceConfig Types**
- Update `electron/services/types.ts` with new config fields
- Update `src/vite-env.d.ts` with matching types
- Add default values in WorkspaceManager

**A2: Create Settings UI Components**
- Create reusable form components (Select, Toggle, etc.)
- Implement General tab content
- Implement Editor tab (new)
- Implement Versioning tab (new)

**A3: Wire Up Settings Persistence**
- Create `useWorkspaceConfig` hook for reading/writing config
- Connect settings UI to workspace config
- Apply settings to editor on change

**A4: Apply Settings to Editor**
- Create font loading system for custom fonts
- Apply default styles to new documents
- Respect versioning settings in CheckpointManager

### Phase B: Context Menus (Priority: Medium)

**B1: Add Radix Context Menu Primitives**
- Install/configure Radix ContextMenu
- Create `src/components/ui/context-menu.tsx`

**B2: Implement File Operations Backend**
- Add IPC handlers for duplicate, move, trash, reveal
- Handle cross-platform differences (Finder vs Explorer)

**B3: Create Context Menu Components**
- FileContextMenu with all actions
- FolderContextMenu with folder-specific actions
- SidebarContextMenu for empty area

**B4: Integrate with Sidebar**
- Add `onContextMenu` handlers to FileTreeItem
- Handle keyboard shortcuts (F2 for rename, Delete for trash)
- Add inline rename UI (already partially exists)

---

## Files to Modify/Create

### Settings Menu

| File | Action | Description |
|------|--------|-------------|
| `electron/services/types.ts` | Modify | Add EditorSettings, expand WorkspaceConfig |
| `src/vite-env.d.ts` | Modify | Mirror type changes |
| `src/components/SettingsModal.tsx` | Modify | Implement General, Editor, Versioning tabs |
| `src/hooks/useWorkspaceConfig.ts` | Create | Hook for config read/write |
| `src/components/settings/GeneralSettings.tsx` | Create | General tab content |
| `src/components/settings/EditorSettings.tsx` | Create | Editor tab content |
| `src/components/settings/VersioningSettings.tsx` | Create | Versioning tab content |

### Context Menus

| File | Action | Description |
|------|--------|-------------|
| `src/components/ui/context-menu.tsx` | Create | Radix context menu primitives |
| `src/components/FileContextMenu.tsx` | Create | File right-click menu |
| `src/components/FolderContextMenu.tsx` | Create | Folder right-click menu |
| `src/components/Sidebar.tsx` | Modify | Add context menu handlers |
| `electron/main.ts` | Modify | Add file operation IPC handlers |
| `electron/preload.ts` | Modify | Expose new APIs |

---

## Dependencies

**Already Available**:
- Radix UI primitives (for context menus)
- Zustand (for local state)
- Lucide icons

**May Need**:
- `@radix-ui/react-context-menu` (check if already included)

---

## Open Questions

1. **Settings Scope**: Should some settings (like theme) be app-global or per-workspace?
   - Recommendation: Theme = app-global, document defaults = per-workspace

2. **Font Loading**: Should we bundle fonts or use system/Google fonts?
   - Recommendation: Use web-safe fonts + Google Fonts with fallbacks

3. **Confirmation Dialogs**: Use native Electron dialogs or custom React modals?
   - Recommendation: Custom React modals for consistency

4. **Keyboard Shortcuts**: Should context menu shortcuts work globally in sidebar?
   - Recommendation: Yes, when sidebar has focus

---

## Success Criteria

### Settings Menu
- [ ] User can set default font for new documents
- [ ] User can set default font size
- [ ] User can toggle spellcheck
- [ ] User can configure versioning behavior
- [ ] Settings persist across sessions
- [ ] New documents respect workspace defaults

### Context Menus
- [ ] Right-click on file shows appropriate menu
- [ ] Right-click on folder shows appropriate menu
- [ ] Rename works inline (F2 shortcut)
- [ ] Delete moves to trash with confirmation
- [ ] Duplicate creates copy with "(copy)" suffix
- [ ] Reveal in Finder/Explorer works
- [ ] Copy path copies to clipboard

---

*Document created: 2025-12-06*
*Status: Planning*
