# Versioning Implementation Plan

This document outlines how to simplify the current versioning system to match the new UX strategy: **Auto-save** (automatic) + **Versions** (intentional).

---

## Current State Analysis

### What We Have Now

The current implementation is feature-rich but complex:

| Feature | Status | Complexity |
|---------|--------|------------|
| Auto-save (1s debounce) | ✅ Working | Low |
| Automatic checkpoints | ✅ Working | Medium |
| Bookmarks (named checkpoints) | ✅ Working | Medium |
| Drafts (branches) | ✅ Working | High |
| Compare/Diff view | ✅ Working | Medium |
| Restore checkpoint | ✅ Working | Low |
| Crash recovery (WAL) | ✅ Working | Medium |

**Key files:**
- `src/store/useHistoryStore.ts` - Checkpoint management
- `src/store/useDraftStore.ts` - Draft/branch management
- `src/components/RightSidebar.tsx` - History & Drafts UI
- `src/components/CheckpointItem.tsx` - Individual checkpoint UI
- `src/components/CompareModal.tsx` - Diff view
- `electron/main.ts` - IPC handlers for all operations

### What Needs to Change

**Simplification:**
1. Remove "Drafts" feature entirely
2. Remove automatic checkpoints from UI (keep backend for crash recovery)
3. Rename "Bookmarks" → "Versions"
4. Simplify UI to show only intentional versions
5. Update terminology throughout

**The new model:**

| Old Concept | New Concept | Change |
|-------------|-------------|--------|
| Auto-save | Auto-save | Keep as-is |
| Automatic checkpoints | (Hidden) | Keep backend, hide from UI |
| Bookmarks | **Versions** | Rename, make primary |
| Drafts | (Removed) | Delete feature |
| "Create Bookmark" | "Save Version" | Rename |
| "Version History" panel | "Versions" panel | Simplify |

---

## Implementation Plan

### Phase 1: Remove Drafts Feature

**Goal:** Eliminate the drafts/branching system entirely.

#### 1.1 Remove Draft Store

**File:** `src/store/useDraftStore.ts`
- Delete the entire file

**File:** `src/components/RightSidebar.tsx`
- Remove `useDraftStore` import
- Remove `DraftPanelContent` component
- Remove `'drafts'` from `RightSidebarMode` type
- Remove draft-related props from `RightSidebar`

**File:** `src/components/DraftItem.tsx`
- Delete the entire file

**File:** `src/components/CreateDraftModal.tsx`
- Delete the entire file

**File:** `src/components/DraftPanel.tsx` (if exists)
- Delete the entire file

#### 1.2 Remove Draft UI from App

**File:** `src/App.tsx`
- Remove draft mode from right sidebar toggle
- Remove `onSwitchToDraft`, `onSwitchToMain` handlers
- Remove draft indicator from editor area
- Simplify `RightSidebarMode` to just `'ai' | 'history' | null`

#### 1.3 Remove Draft IPC Handlers

**File:** `electron/main.ts`
- Remove handlers:
  - `workspace:createDraft`
  - `workspace:createDraftFromCheckpoint`
  - `workspace:getDrafts`
  - `workspace:getDraft`
  - `workspace:getDraftContent`
  - `workspace:saveDraftContent`
  - `workspace:renameDraft`
  - `workspace:applyDraft`
  - `workspace:discardDraft`
  - `workspace:deleteDraft`

**File:** `electron/preload.ts`
- Remove draft-related API methods from `electronAPI`

#### 1.4 Clean Up Draft Storage

**File:** `.midlight/drafts/` directory
- Can be deleted or left to be cleaned up manually
- No migration needed since drafts are being removed

---

### Phase 2: Simplify History to Versions

**Goal:** Transform the checkpoint/bookmark system into a simple "Versions" system.

#### 2.1 Rename useHistoryStore

**File:** `src/store/useHistoryStore.ts` → `src/store/useVersionStore.ts`

Rename and simplify:

```typescript
// Old interface
interface Checkpoint {
  id: string;
  contentHash: string;
  sidecarHash: string;
  timestamp: string;
  parentId: string | null;
  type: 'auto' | 'bookmark';  // REMOVE 'auto' from UI
  label?: string;
  stats: { ... };
  trigger: string;
}

// New interface (rename)
interface Version {
  id: string;
  contentHash: string;
  sidecarHash: string;
  timestamp: string;
  parentId: string | null;
  name: string;  // Required (was optional 'label')
  stats: {
    wordCount: number;
    charCount: number;
  };
}
```

**Key changes:**
- Rename `Checkpoint` → `Version`
- Rename `createBookmark` → `saveVersion`
- Remove `type` field from UI (always treat as user-created version)
- Make `name` required (was optional `label`)
- Filter out `type: 'auto'` from the list shown to users

#### 2.2 Update History Store Actions

```typescript
interface VersionState {
  // Simplified state
  versions: Version[];
  isLoading: boolean;
  error: string | null;
  selectedVersionId: string | null;

  // Compare mode
  isCompareMode: boolean;
  compareVersionId: string | null;
  compareContent: { contentA: any; contentB: any } | null;

  // Actions
  loadVersions: (workspaceRoot: string, filePath: string) => Promise<void>;
  saveVersion: (workspaceRoot: string, filePath: string, json: any, name: string) => Promise<boolean>;
  restoreVersion: (workspaceRoot: string, filePath: string, versionId: string) => Promise<any | null>;
  deleteVersion: (workspaceRoot: string, filePath: string, versionId: string) => Promise<boolean>;
  renameVersion: (workspaceRoot: string, filePath: string, versionId: string, name: string) => Promise<boolean>;

  // Compare
  startCompare: (versionId: string) => void;
  cancelCompare: () => void;
  loadCompare: (workspaceRoot: string, filePath: string, idA: string, idB: string) => Promise<void>;
}
```

**Filter auto-checkpoints:**
```typescript
loadVersions: async (workspaceRoot, filePath) => {
  const result = await window.electronAPI.workspaceGetCheckpoints(workspaceRoot, filePath);
  if (result.success && result.checkpoints) {
    // Only show user-created versions (bookmarks), not auto-checkpoints
    const versions = result.checkpoints
      .filter(cp => cp.type === 'bookmark')
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    set({ versions, isLoading: false });
  }
}
```

#### 2.3 Simplify RightSidebar History Panel

**File:** `src/components/RightSidebar.tsx`

Rename `HistoryPanelContent` → `VersionsPanel`

**Changes:**
- Remove "Bookmarks" section header (all items are versions now)
- Remove "Auto-saves" section entirely
- Rename header from "Version History" to "Versions"
- Add "Save Version" button at top
- Update empty state messaging

**New UI structure:**
```
┌─────────────────────────────────────────┐
│  Versions                          [X]  │
├─────────────────────────────────────────┤
│  [+ Save Version]                       │
├─────────────────────────────────────────┤
│                                         │
│  📌 Before client revisions             │
│     Today at 2:30 PM · 1,240 words      │
│     [Compare] [Restore] [···]           │
│                                         │
│  📌 First draft complete                │
│     Yesterday at 4:15 PM · 980 words    │
│     [Compare] [Restore] [···]           │
│                                         │
│  ─────────────────────────────────────  │
│  2 versions saved                       │
└─────────────────────────────────────────┘
```

#### 2.4 Create SaveVersionModal

**New file:** `src/components/SaveVersionModal.tsx`

```tsx
interface SaveVersionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
}

export function SaveVersionModal({ isOpen, onClose, onSave }: SaveVersionModalProps) {
  const [name, setName] = useState('');

  // Modal with:
  // - Text input for version name
  // - Helper text explaining versions
  // - Cancel and Save buttons
}
```

#### 2.5 Update CheckpointItem → VersionItem

**File:** `src/components/CheckpointItem.tsx` → `src/components/VersionItem.tsx`

**Changes:**
- Rename component and props
- Remove bookmark star icon (all are versions now)
- Remove "type" indicator
- Add overflow menu with: Rename, Delete
- Simplify display

---

### Phase 3: Update Toolbar and Entry Points

**Goal:** Add "Save Version" to the main UI and simplify the right sidebar toggle.

#### 3.1 Add Save Version Button to Toolbar

**File:** `src/components/EditorToolbar.tsx`

Add a "Save Version" button:
- Icon: `Save` or `Bookmark` from lucide
- Tooltip: "Save Version (⌘S)"
- Opens `SaveVersionModal`

Or add to the existing toolbar menu if space is limited.

#### 3.2 Update Keyboard Shortcut

**File:** `src/App.tsx` or keyboard handler

Map `⌘S` to open "Save Version" modal instead of (or in addition to) current behavior.

**Note:** Since auto-save is always active, `⌘S` is free to use for "Save Version".

#### 3.3 Simplify Right Sidebar Mode

**File:** `src/App.tsx`

```typescript
// Old
type RightSidebarMode = 'ai' | 'history' | 'drafts' | null;

// New
type RightSidebarMode = 'ai' | 'versions' | null;
```

Update toolbar buttons:
- Remove drafts icon/button
- Rename "History" to "Versions"

---

### Phase 4: Backend Adjustments

**Goal:** Keep auto-checkpoints working in backend for crash recovery, but don't expose them in UI.

#### 4.1 Keep Auto-Checkpoint Backend

**No changes needed** to:
- `workspace:saveDocument` - Still creates auto checkpoints
- Checkpoint storage in `.midlight/checkpoints/`
- WAL/recovery system

The backend continues creating auto-checkpoints. The frontend just filters them out.

#### 4.2 Add Delete Version IPC

**File:** `electron/main.ts`

Add handler:
```typescript
ipcMain.handle('workspace:deleteVersion', async (_, workspaceRoot, filePath, versionId) => {
  // Delete a specific version (bookmark) from the checkpoint list
  // Don't allow deleting auto-checkpoints via this API
});
```

**File:** `electron/preload.ts`

Expose:
```typescript
workspaceDeleteVersion: (workspaceRoot: string, filePath: string, versionId: string) =>
  ipcRenderer.invoke('workspace:deleteVersion', workspaceRoot, filePath, versionId),
```

#### 4.3 Ensure Restore Creates Pre-Restore Version

When restoring, automatically create a "Before restore" version:

**File:** `electron/main.ts` - `workspace:restoreCheckpoint` handler

```typescript
// Before restoring, create a version of current state
await createBookmark(workspaceRoot, filePath, currentContent, 'Before restore');
// Then restore to selected version
```

---

### Phase 5: Update Terminology Throughout

#### 5.1 UI Text Updates

| Location | Old Text | New Text |
|----------|----------|----------|
| Sidebar button | "History" | "Versions" |
| Panel header | "Version History" | "Versions" |
| Empty state | "No version history yet" | "No versions saved yet" |
| Empty state detail | "Versions are created automatically..." | "Save a version to create a milestone..." |
| Create action | "Create Bookmark" | "Save Version" |
| Restore confirm | "Restore this version?" | "Restore this version?" |

#### 5.2 Code Renames

| Old Name | New Name |
|----------|----------|
| `useHistoryStore` | `useVersionStore` |
| `CheckpointItem` | `VersionItem` |
| `HistoryPanelContent` | `VersionsPanel` |
| `createBookmark` | `saveVersion` |
| `labelCheckpoint` | `renameVersion` |
| `checkpoint` (variable) | `version` |
| `checkpoints` (array) | `versions` |

---

### Phase 6: Clean Up

#### 6.1 Remove Unused Files

- `src/store/useDraftStore.ts`
- `src/components/DraftItem.tsx`
- `src/components/CreateDraftModal.tsx`
- `src/components/DraftPanel.tsx` (if exists)

#### 6.2 Update Imports

Search and update all imports referencing renamed/removed files.

#### 6.3 Update Types

**File:** `src/types/` or inline types

Remove draft-related types, update checkpoint → version types.

#### 6.4 Update Documentation

- Update `docs/File_Storage_and_Versioning.md` to reflect simplified model
- Archive old exploration docs if desired

---

## Migration Path

### For Existing Users

1. **Drafts**: Any existing drafts will be orphaned (not shown in UI). Users should be notified to apply or export drafts before updating.

2. **Auto-checkpoints**: Still exist in `.midlight/checkpoints/`, just hidden from UI. No data loss.

3. **Bookmarks**: Automatically become "Versions" - seamless transition.

### Rollout Strategy

1. **Phase 1 (Breaking)**: Remove drafts - requires user notification
2. **Phases 2-5**: Can be done incrementally without breaking changes
3. **Phase 6**: Cleanup after all changes are stable

---

## Testing Checklist

### Auto-Save
- [ ] Changes save within 1 second of typing pause
- [ ] No "unsaved" indicator visible
- [ ] Closing app saves immediately
- [ ] Undo/redo works within session

### Versions
- [ ] "Save Version" button opens modal
- [ ] Can create version with custom name
- [ ] Versions appear in Versions panel
- [ ] Can restore a version
- [ ] Restoring creates "Before restore" version automatically
- [ ] Can compare version to current
- [ ] Can rename a version
- [ ] Can delete a version
- [ ] Empty state shows helpful message

### Compare
- [ ] Compare view shows diff correctly
- [ ] Can restore either version from compare view
- [ ] Compare modal closes properly

### Edge Cases
- [ ] Works with new files (no versions yet)
- [ ] Works after restoring a version
- [ ] Works with large documents
- [ ] Keyboard shortcut (⌘S) works

---

## File Summary

### Files to Delete
- `src/store/useDraftStore.ts`
- `src/components/DraftItem.tsx`
- `src/components/CreateDraftModal.tsx`

### Files to Rename
- `src/store/useHistoryStore.ts` → `src/store/useVersionStore.ts`
- `src/components/CheckpointItem.tsx` → `src/components/VersionItem.tsx`

### Files to Create
- `src/components/SaveVersionModal.tsx`

### Files to Modify
- `src/components/RightSidebar.tsx` - Major changes
- `src/components/EditorToolbar.tsx` - Add Save Version button
- `src/App.tsx` - Remove draft handling, update types
- `electron/main.ts` - Remove draft handlers, add delete version
- `electron/preload.ts` - Update API

---

## Estimated Effort

| Phase | Effort | Risk |
|-------|--------|------|
| Phase 1: Remove Drafts | 2-3 hours | Low (just deletion) |
| Phase 2: Simplify History | 3-4 hours | Medium (rename + filter) |
| Phase 3: Update Toolbar | 1-2 hours | Low |
| Phase 4: Backend Adjustments | 1-2 hours | Low |
| Phase 5: Terminology | 1 hour | Low |
| Phase 6: Clean Up | 1 hour | Low |

**Total: ~10-13 hours**

---

*Document created: 2025-12-13*
