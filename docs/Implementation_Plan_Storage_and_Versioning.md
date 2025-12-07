<!-- @mid:h-60y9nj -->
# Implementation Plan: Storage, Versioning & Document Management

<!-- @mid:p-ctk02e -->
A comprehensive implementation plan for Midlight's new storage architecture, Git-like versioning system, and document management—designed for long-term scalability and user-friendly operation.

---

<!-- @mid:h-r79nyn -->
## Implementation Status

<!-- @mid:p-3vzs4u -->
**| Phase | Description | Status | Completion Date |
|-------|-------------|--------|-----------------|
| Phase 1 | Core Services | ****Complete**** | 2025-12-05 |
| Phase 2 | Frontend Integration | ****Complete**** | 2025-12-05 |
| Phase 3 | File Watching | ****Complete**** | 2025-12-05 |
| Phase 4 | History UI | ****Complete**** | 2025-12-05 |
| Phase 5 | Drafts System | ****Complete**** | 2025-12-06 |
| Phase 6 | Tier Enforcement | Pending | - |
| Phase 7 | Polish & Testing | Pending | - |**

---

<!-- @mid:h-qx72zc -->
## Executive Summary

<!-- @mid:p-lb8nxr -->
This plan consolidates our research into an actionable implementation roadmap that:

<!-- @mid:list-qvkfn1 -->
1. **Replaces inline HTML storage** with a clean Markdown + Sidecar approach
2. **Implements content-addressable versioning** (Git-like, but invisible to users)
3. **Separates images** from documents for efficient storage
4. **Adds file watching** for external change detection
5. **Prepares for cloud sync** (paid tier) without requiring it (free tier)

<!-- @mid:p-ibegss -->
**Timeline****: 8-10 weeks for full implementation
****Risk Level****: Medium (requires migration of existing files)**

---

<!-- @mid:h-5nbrtq -->
## Table of Contents

<!-- @mid:list-rjk09n -->
1. Architecture Overview
2. File Format Specification
3. Content-Addressable Object Store
4. Checkpoint System
5. Draft System (Branching)
6. File Watcher Integration
7. Image Management
8. Crash Recovery
9. Migration Strategy
10. UI Components
11. Free vs Paid Tier Logic
12. Implementation Phases
13. Technical Specifications
14. Testing Strategy

---

<!-- @mid:h-e0k81e -->
## 1. Architecture Overview

<!-- @mid:h-4d80d6 -->
### Directory Structure

<!-- @mid:code-u6a3do -->
```
workspace/                              # User's chosen folder
├── My Essay.md                         # Clean Markdown content
├── Research Notes.md
│
└── .midlight/                          # Hidden system folder
    ├── config.json                     # Workspace configuration
    │
    ├── objects/                        # Content-addressable blob store
    │   ├── a3/
    │   │   └── b4c5d6e7f8901234...    # Gzipped content blob
    │   └── ...
    │
    ├── sidecars/                       # Document metadata & formatting
    │   ├── {hash}.json                 # Sidecar files by content hash
    │   └── ...
    │
    ├── checkpoints/                    # Version history metadata
    │   ├── My Essay.md.json
    │   └── Research Notes.md.json
    │
    ├── drafts/                         # Branch metadata (Phase 5)
    │   └── My Essay.md/
    │       └── shorter-intro.json
    │
    ├── images/                         # Extracted images (by hash)
    │   ├── abc123def456.png
    │   └── 789xyz012abc.jpg
    │
    └── recovery/                       # Crash recovery WAL files
        └── {encoded-path}.wal
```

<!-- @mid:h-rsu3k5 -->
### Data Flow Diagram

<!-- @mid:code-xrevs5 -->
```
┌─────────────────────────────────────────────────────────────────────────┐
│                           USER EDITING                                  │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      TIPTAP EDITOR                               │   │
│  │                    (Full JSON State)                             │   │
│  │                                                                  │   │
│  │  • All formatting preserved                                      │   │
│  │  • Images as base64 (extracted on save)                          │   │
│  │  • Block IDs for anchoring                                       │   │
│  └──────────────────────────┬──────────────────────────────────────┘   │
│                              │                                          │
└──────────────────────────────┼──────────────────────────────────────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         │                     │                     │
         ▼                     ▼                     ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   AUTO-SAVE     │  │  CHECKPOINT     │  │  EXPORT         │
│   (1s debounce) │  │  (on change)    │  │  (DOCX/PDF)     │
└────────┬────────┘  └────────┬────────┘  └────────┬────────┘
         │                    │                    │
         ▼                    ▼                    │
┌─────────────────────────────────────────┐       │
│         WORKSPACE MANAGER               │       │
│                                         │       │
│  • DocumentSerializer (JSON → MD)       │       │
│  • CheckpointManager (versions)         │       │
│  • ImageManager (extraction)            │       │
│  • RecoveryManager (WAL)                │       │
└────────┬───────────────────┬────────────┘       │
         │                   │                    │
         ▼                   ▼                    │
┌─────────────┐    ┌─────────────────┐           │
│  essay.md   │    │  .midlight/     │           │
│  (content)  │    │  (versioning)   │           │
└─────────────┘    └─────────────────┘           │
                                                 │
                                                 ▼
                                        ┌─────────────────┐
                                        │ DOCX/PDF Export │
                                        │                 │
                                        │ Uses editor     │
                                        │ JSON directly   │
                                        └─────────────────┘
```

---

<!-- @mid:h-1ln53u -->
## 2. File Format Specification

<!-- @mid:h-k38anp -->
### 2.1 Markdown File (.md)

<!-- @mid:p-s6gzjj -->
Clean, portable Markdown with invisible block anchors.

<!-- @mid:code-1c79bi -->
```markdown
# The Art of Writing

Writing is both a craft and an art form. It requires practice, patience, and persistence.

## Key Principles

The most important aspects are:

- Clarity of thought
- Economy of words
- Authentic voice

![A vintage typewriter](@img:abc123def456)
```

<!-- @mid:p-txqsl3 -->
**Rules:**

<!-- @mid:list-e7pobv -->
- Block IDs are HTML comments (invisible in all renderers)
- Format: `<!-- @mid:{type}-{6-char-id} -->`
- IDs generated on first save, preserved thereafter
- If ID missing on load, generate new one
- Image references use `@img:{hash}` syntax

<!-- @mid:h-kv5clr -->
### 2.2 Sidecar File (.midlight/sidecars/{hash}.json)

<!-- @mid:p-ry0w6f -->
JSON file containing all formatting, metadata, and document settings.

<!-- @mid:code-uyrhsk -->
```json
{
  "version": 1,
  "meta": {
    "created": "2024-01-15T10:30:00.000Z",
    "modified": "2024-01-15T14:22:00.000Z",
    "title": "The Art of Writing",
    "author": "Jane Doe",
    "tags": ["writing", "craft"],
    "wordCount": 1247,
    "readingTime": 5
  },

  "document": {
    "defaultFont": "Merriweather",
    "defaultFontSize": "16px",
    "defaultColor": "#1a1a1a"
  },

  "blocks": {
    "h-a1b2c3": {
      "align": "center"
    },
    "p-d4e5f6": {
      "align": "justify"
    }
  },

  "spans": {
    "p-d4e5f6": [
      {
        "start": 0,
        "end": 7,
        "marks": [{ "type": "bold" }]
      }
    ]
  },

  "images": {
    "abc123def456": {
      "file": "abc123def456.png",
      "originalName": "typewriter.png",
      "width": 800,
      "height": 600,
      "size": 245678
    }
  }
}
```

<!-- @mid:h-wt2gsi -->
### 2.3 Workspace Config (.midlight/config.json)

<!-- @mid:code-9hsgwc -->
```json
{
  "version": 1,
  "workspace": {
    "name": "My Writing Projects",
    "created": "2024-01-10T08:00:00.000Z"
  },

  "defaults": {
    "font": "Merriweather",
    "fontSize": "16px",
    "theme": "sepia"
  },

  "versioning": {
    "enabled": true,
    "checkpointIntervalMs": 300000,
    "minChangeChars": 50,
    "maxCheckpointsPerFile": 50,
    "retentionDays": 7
  },

  "recovery": {
    "enabled": true,
    "walIntervalMs": 500
  },

  "sync": {
    "enabled": false,
    "lastSync": null
  }
}
```

---

<!-- @mid:h-t7bkmi -->
## 3. Content-Addressable Object Store

<!-- @mid:h-efzgnr -->
### **Status: ****IMPLEMENTED**** (Phase 1)**

<!-- @mid:p-0986cv -->
**`File`****`: `****`electron/services/objectStore.ts`**

<!-- @mid:h-dgapxh -->
### Features Implemented:

<!-- @mid:list-dzog38 -->
- SHA-256 content hashing
- Gzip compression for storage efficiency
- Automatic deduplication
- Garbage collection support
- Storage size tracking

<!-- @mid:h-bsywod -->
### API:

<!-- @mid:code-63uddg -->
```typescript
class ObjectStore {
  async init(): Promise<void>
  async write(content: string): Promise<string>  // Returns hash
  async read(hash: string): Promise<string>
  async exists(hash: string): Promise<boolean>
  hash(content: string): string
  async getStorageSize(): Promise<number>
  async getObjectCount(): Promise<number>
  async gc(referencedHashes: Set<string>): Promise<number>
}
```

<!-- @mid:h-31ghhd -->
### Test Coverage: 24 tests passing

---

<!-- @mid:h-gil56m -->
## 4. Checkpoint System

<!-- @mid:h-jftbq0 -->
### **Status: ****IMPLEMENTED**** (Phase 1)**

<!-- @mid:p-f62pxh -->
**`File`****`: `****`electron/services/checkpointManager.ts`**

<!-- @mid:h-e1mcky -->
### Features Implemented:

<!-- @mid:list-yfapba -->
- Automatic checkpoint creation on save
- Bookmark support (named checkpoints)
- Checkpoint restoration
- Checkpoint comparison
- Retention limits (max checkpoints, age)
- Parent-child relationship tracking

<!-- @mid:h-307e2h -->
### Checkpoint Metadata Structure:

<!-- @mid:code-gl3k41 -->
```typescript
interface Checkpoint {
  id: string;                    // Unique ID (e.g., "cp-a1b2c3")
  contentHash: string;           // Hash of markdown content
  sidecarHash: string;           // Hash of sidecar JSON
  timestamp: string;             // ISO 8601
  parentId: string | null;       // Previous checkpoint
  type: 'auto' | 'bookmark';     // How it was created
  label?: string;                // User-provided name
  stats: {
    wordCount: number;
    charCount: number;
    changeSize: number;
  };
  trigger: string;               // What caused this checkpoint
}
```

<!-- @mid:h-lbpfdc -->
### API:

<!-- @mid:code-w6bbqv -->
```typescript
class CheckpointManager {
  async init(): Promise<void>
  async maybeCreateCheckpoint(fileKey, markdown, sidecar, trigger, label?): Promise<Checkpoint | null>
  async getCheckpoints(fileKey: string): Promise<Checkpoint[]>
  async getCheckpointContent(fileKey, checkpointId): Promise<{markdown, sidecar} | null>
  async restoreCheckpoint(fileKey, checkpointId): Promise<{markdown, sidecar} | null>
  async labelCheckpoint(fileKey, checkpointId, label): Promise<boolean>
  async unlabelCheckpoint(fileKey, checkpointId): Promise<boolean>
  async deleteCheckpoint(fileKey, checkpointId): Promise<boolean>
  async compareCheckpoints(fileKey, idA, idB): Promise<{contentA, contentB} | null>
  async getAllReferencedHashes(): Promise<Set<string>>
  async getHeadId(fileKey: string): Promise<string | null>
  clearTracking(): void
}
```

<!-- @mid:h-28u2uu -->
### Test Coverage: 26 tests passing

---

<!-- @mid:h-9hjikm -->
## 5. Draft System (Branching)

<!-- @mid:h-tzg8l1 -->
### **Status: ****IMPLEMENTED**** (Phase 5)**

<!-- @mid:p-d6xms8 -->
**`File`****`: `****`electron/services/draftManager.ts`**

<!-- @mid:h-dr1234 -->
### Features Implemented:

<!-- @mid:list-dr5678 -->
- Create drafts from current document or any checkpoint
- Independent checkpoint history per draft (max 20 checkpoints)
- Draft statuses: active, merged, archived
- Apply (merge) draft content to main document
- Discard/archive drafts without deleting
- Permanent draft deletion
- GC integration for draft content hashes

<!-- @mid:h-dr9012 -->
### API:

<!-- @mid:code-dr3456 -->
```typescript
class DraftManager {
  async init(): Promise<void>
  async createDraft(fileKey, name, sourceCheckpointId, content): Promise<Draft>
  async getDrafts(fileKey: string): Promise<DraftListItem[]>
  async getDraft(fileKey, draftId): Promise<Draft | null>
  async getDraftContent(fileKey, draftId): Promise<CheckpointContent | null>
  async saveDraftContent(fileKey, draftId, content): Promise<DraftCheckpoint | null>
  async renameDraft(fileKey, draftId, newName): Promise<boolean>
  async applyDraft(fileKey, draftId): Promise<CheckpointContent | null>
  async discardDraft(fileKey, draftId): Promise<boolean>
  async deleteDraft(fileKey, draftId): Promise<boolean>
  async getAllReferencedHashes(): Promise<Set<string>>
  async countActiveDrafts(): Promise<number>
}
```

<!-- @mid:h-dr7890 -->
### Test Coverage: 37 tests passing

---

<!-- @mid:h-uia7us -->
## 6. File Watcher Integration

<!-- @mid:h-ql84uj -->
### **Status: ****IMPLEMENTED**** (Phase 3)**

<!-- @mid:p-lcjcdr -->
**`File`****`: `****`electron/services/fileWatcher.ts`**

<!-- @mid:h-fw1234 -->
### Features Implemented:

<!-- @mid:list-fw5678 -->
- chokidar-based file watching with debouncing
- "Saving" marks to ignore self-triggered changes
- mtime tracking for external change detection
- Support for add/change/unlink events
- Ignored patterns (.midlight, .git, node_modules)
- IPC events for renderer notification

<!-- @mid:h-fw9012 -->
### API:

<!-- @mid:code-fw3456 -->
```typescript
class FileWatcher extends EventEmitter {
  async start(): Promise<void>
  async stop(): Promise<void>
  markSaving(fileKey: string): void
  clearSaving(fileKey: string): void
  async updateMtime(fileKey: string): Promise<void>
  async hasExternalChange(fileKey: string): Promise<boolean>
  getWatchedFiles(): string[]
}
```

<!-- @mid:h-fw7890 -->
### UI Component: `src/components/ExternalChangeDialog.tsx`

<!-- @mid:list-fwabc -->
- Modal dialog for external change notifications
- Handles modified files (Reload/Keep Mine options)
- Handles deleted files (Keep Editing/Close File options)
- Time-ago display for change timestamp

<!-- @mid:h-fwdef -->
### Test Coverage: 17 tests (12 passing, 5 skipped for flaky FS events)

---

<!-- @mid:h-v6nj7h -->
## 7. Image Management

<!-- @mid:h-2moyoo -->
### **Status: ****IMPLEMENTED**** (Phase 1)**

<!-- @mid:p-uamqmj -->
**`File`****`: `****`electron/services/imageManager.ts`**

<!-- @mid:h-87l0gn -->
### Features Implemented:

<!-- @mid:list-nuo877 -->
- Base64 image storage
- Buffer image storage
- Content-based deduplication (SHA-256)
- Multiple format support (PNG, JPEG, GIF, WebP)
- Image reference system (`@img:{hash}`)
- Garbage collection for unreferenced images

<!-- @mid:h-7yab08 -->
### API:

<!-- @mid:code-cbguzh -->
```typescript
class ImageManager {
  async init(): Promise<void>
  async storeImage(base64DataUrl, originalName?): Promise<{ref, info}>
  async storeImageBuffer(buffer, mimeType, originalName?): Promise<{ref, info}>
  async getImageDataUrl(ref: string): Promise<string | null>
  async getImageBuffer(ref: string): Promise<{buffer, mimeType} | null>
  async exists(ref: string): Promise<boolean>
  async getImageInfo(ref: string): Promise<ImageInfo | null>
  async getAllRefs(): Promise<string[]>
  async gc(referencedRefs: Set<string>): Promise<number>
  async getStorageSize(): Promise<number>
  async getImageCount(): Promise<number>
  async copyImageTo(ref, destPath): Promise<boolean>
}
```

<!-- @mid:h-zq4uhq -->
### Test Coverage: 29 tests passing

---

<!-- @mid:h-lggnkh -->
## 8. Crash Recovery

<!-- @mid:h-2vifso -->
### **Status: ****IMPLEMENTED**** (Phase 1 + Phase 2)**

<!-- @mid:p-wlakx5 -->
**`File`****`: `****`electron/services/recoveryManager.ts`**

<!-- @mid:h-4gl043 -->
### Features Implemented:

<!-- @mid:list-6fayvd -->
- Write-Ahead Log (WAL) for crash recovery
- Configurable WAL interval (default 500ms)
- Recovery detection on startup
- Apply/discard recovery options
- Per-file recovery tracking
- Recovery prompt UI in editor

<!-- @mid:h-68m158 -->
### API:

<!-- @mid:code-plhwit -->
```typescript
class RecoveryManager {
  async init(): Promise<void>
  startWAL(fileKey: string, getContent: () => string): void
  stopWAL(fileKey: string): void
  stopAllWAL(): void
  async updateWALNow(fileKey: string, content: string): Promise<void>
  async clearWAL(fileKey: string): Promise<void>
  async hasRecovery(fileKey: string): Promise<boolean>
  async getRecoveryContent(fileKey: string): Promise<string | null>
  async checkForRecovery(): Promise<RecoveryFile[]>
  async applyRecovery(fileKey: string): Promise<string | null>
  async discardRecovery(fileKey: string): Promise<void>
  async discardAllRecovery(): Promise<void>
  async hasUniqueRecovery(fileKey, currentContent): Promise<boolean>
}
```

<!-- @mid:h-qiask2 -->
### `UI Component: ``src/components/RecoveryPrompt.tsx`

<!-- @mid:list-vn7xtc -->
- Yellow warning banner
- "Restore changes" / "Discard" buttons
- Time-ago display

<!-- @mid:h-vd5nf7 -->
### Test Coverage: 29 tests passing

---

<!-- @mid:h-u0xkm3 -->
## 9. Migration Strategy

<!-- @mid:h-7fqy0v -->
### **Status: ****IMPLEMENTED**** (Phase 2)**

<!-- @mid:p-kejil7 -->
Existing markdown files without sidecars are automatically handled:

<!-- @mid:list-5iw5mo -->
1. `workspaceLoadDocument()` detects missing sidecar
2. Backend reads raw markdown
3. Backend parses markdown to Tiptap JSON (basic conversion)
4. On first save, full sidecar is created
5. Future loads use the sidecar

<!-- @mid:p-t6sgny -->
**No explicit migration UI needed**** - handled transparently by DocumentDeserializer.**

---

<!-- @mid:h-tl2yi8 -->
## 10. UI Components

<!-- @mid:h-68kyx0 -->
### Implemented (Phase 2)

<!-- @mid:list-ecyak9 -->
- **RecoveryPrompt** (`src/components/RecoveryPrompt.tsx`)
  - Crash recovery notification
  - Restore/discard options

<!-- @mid:h-etmau1 -->
### Implemented (Phase 3)

<!-- @mid:list-ph3ui1 -->
- **ExternalChangeDialog** (`src/components/ExternalChangeDialog.tsx`)
  - External file change notification
  - Reload/Keep Mine options for modified files
  - Keep Editing/Close File options for deleted files

<!-- @mid:h-z9pui2 -->
### Implemented (Phase 4)

<!-- @mid:list-yk5aef -->
- **HistoryPanel** (`src/components/HistoryPanel.tsx`)
  - Browse checkpoints by file
  - Bookmark and auto-save sections
  - Restore and compare actions
- **CheckpointItem** (`src/components/CheckpointItem.tsx`)
  - Individual checkpoint display
  - Time-ago formatting
  - Word/char stats
  - Label editing
- **CompareModal** (`src/components/CompareModal.tsx`)
  - Side-by-side diff view
  - Word-level diff highlighting
  - Restore from comparison

<!-- @mid:h-z9pw2b -->
### Implemented (Phase 5)

<!-- @mid:list-tzqy9p -->
- **DraftPanel** (`src/components/DraftPanel.tsx`)
  - Draft list with status badges
  - Create new draft button
  - Switch between drafts and main document
- **DraftItem** (`src/components/DraftItem.tsx`)
  - Individual draft display
  - Rename, apply, discard, delete actions
- **CreateDraftModal** (`src/components/CreateDraftModal.tsx`)
  - New draft dialog with name input
  - Option to create from current or checkpoint
- **DraftIndicator** - Visual indicator in toolbar when editing a draft

---

<!-- @mid:h-cg2416 -->
## 11. Free vs Paid Tier Logic

<!-- @mid:h-tm6yrc -->
### **Status: ****DEFINED**** (Implementation in Phase 6)**

<!-- @mid:code-25xh7s -->
```typescript
const FREE_TIER: TierConfig = {
  versioning: {
    maxCheckpointsPerFile: 50,
    retentionDays: 7,
    maxBookmarks: 3,
  },
  drafts: {
    maxActiveDrafts: 1,
  },
  sync: {
    enabled: false,
  },
  ai: {
    enabled: false,
  },
};

const PRO_TIER: TierConfig = {
  versioning: {
    maxCheckpointsPerFile: Infinity,
    retentionDays: 365,
    maxBookmarks: Infinity,
  },
  drafts: {
    maxActiveDrafts: Infinity,
  },
  sync: {
    enabled: true,
  },
  ai: {
    enabled: true,
  },
};
```

---

<!-- @mid:h-uv9iyz -->
## 12. Implementation Phases

<!-- @mid:h-pgdd5u -->
### **Phase 1: Core Services - ****COMPLETE**

<!-- @mid:p-35l84q -->
**Completed****: 2025-12-05**

<!-- @mid:p-vqxwit -->
**Files Created****:**

<!-- @mid:list-m781xi -->
- `electron/services/objectStore.ts` - Content-addressable storage
- `electron/services/checkpointManager.ts` - Version history
- `electron/services/imageManager.ts` - Image extraction/deduplication
- `electron/services/recoveryManager.ts` - Crash recovery WAL
- `electron/services/documentSerializer.ts` - Tiptap JSON → Markdown + Sidecar
- `electron/services/documentDeserializer.ts` - Markdown + Sidecar → Tiptap JSON
- `electron/services/workspaceManager.ts` - Central coordinator
- `electron/services/types.ts` - Shared type definitions
- `electron/services/index.ts` - Barrel exports

<!-- @mid:p-09morw -->
**Test Files Created****:**

<!-- @mid:list-qel54q -->
- `electron/services/objectStore.test.ts` (24 tests)
- `electron/services/checkpointManager.test.ts` (26 tests)
- `electron/services/imageManager.test.ts` (29 tests)
- `electron/services/recoveryManager.test.ts` (29 tests)
- `electron/services/documentSerializer.test.ts` (31 tests)
- `electron/services/workspaceManager.test.ts` (26 tests)

<!-- @mid:p-4uda76 -->
**Total****: 165 tests passing, ~83% coverage**

---

<!-- @mid:h-1376tm -->
### **Phase 2: Frontend Integration - ****COMPLETE**

<!-- @mid:p-j9gxay -->
**Completed****: 2025-12-05**

<!-- @mid:p-m8ar90 -->
**Files Modified****:**

<!-- @mid:list-t7y5fk -->
- `src/store/useFileSystem.ts` - Complete rewrite to use workspace APIs
- `src/components/Editor.tsx` - Changed from markdown to JSON content
- `src/App.tsx` - Updated DOCX import to use Tiptap JSON
- `electron/main.ts` - Added 16 IPC handlers for workspace APIs
- `electron/preload.ts` - Exposed workspace APIs to renderer
- `src/vite-env.d.ts` - Added type definitions for new APIs

<!-- @mid:p-f8ngml -->
**Files Created****:**

<!-- @mid:list-4pgd75 -->
- `src/components/RecoveryPrompt.tsx` - Recovery notification UI
- `src/utils/htmlToTiptap.ts` - HTML to Tiptap JSON converter (for DOCX import)

<!-- @mid:p-p82dce -->
**Files Deleted****:**

<!-- @mid:list-lain1m -->
- `src/utils/markdown.ts` - Replaced by backend serializers

<!-- @mid:p-06bsh7 -->
**Key Changes****:**

<!-- @mid:list-xryb2m -->
- Editor now stores/loads Tiptap JSON directly (not markdown strings)
- Workspace initialization on directory load
- Recovery detection and UI prompt
- All saves go through workspace API (enables versioning)

---

<!-- @mid:h-bddzjh -->
### **Phase 3: File Watching - ****COMPLETE**

<!-- @mid:p-8ndqa0 -->
**Completed****: 2025-12-05**

<!-- @mid:p-nd6vya -->
**Files Created****:**

<!-- @mid:list-qvuod5 -->
- `electron/services/fileWatcher.ts` - Core file watching class
- `electron/services/fileWatcher.test.ts` - Tests (17 total, 12 passing)
- `src/components/ExternalChangeDialog.tsx` - External change notification UI

<!-- @mid:p-nd7abc -->
**Files Modified****:**

<!-- @mid:list-qv7def -->
- `electron/main.ts` - FileWatcher integration and IPC handlers
- `electron/preload.ts` - Exposed new APIs (stopWatcher, hasExternalChange, onFileChangedExternally)
- `src/vite-env.d.ts` - Type definitions for new APIs
- `src/store/useFileSystem.ts` - External change state and actions
- `src/components/Editor.tsx` - External change listener and dialog integration

<!-- @mid:p-nd8ghi -->
**Key Features****:**

<!-- @mid:list-qv9jkl -->
- [x] chokidar-based file watching with debouncing (500ms default)
- [x] "Saving" marks to ignore self-triggered changes
- [x] mtime tracking for external change detection
- [x] IPC events for renderer notification
- [x] ExternalChangeDialog with Reload/Keep options
- [x] Proper cleanup when switching workspaces

---

<!-- @mid:h-z7n5q7 -->
### **Phase 4: History UI - ****COMPLETE**

<!-- @mid:p-ab1n6d -->
**Completed****: 2025-12-05**

<!-- @mid:p-0kmdhi -->
**Files Created****:**

<!-- @mid:list-cwgbx8 -->
- `src/store/useHistoryStore.ts` - State management for history panel
- `src/components/HistoryPanel.tsx` - Sidebar panel for version history
- `src/components/CheckpointItem.tsx` - Individual checkpoint display
- `src/components/CompareModal.tsx` - Diff view modal for comparing versions

<!-- @mid:p-h4abc1 -->
**Files Modified****:**

<!-- @mid:list-h4def2 -->
- `src/components/EditorToolbar.tsx` - Added history toggle and bookmark button
- `src/components/Editor.tsx` - Integrated HistoryPanel with restore flow

<!-- @mid:p-h4ghi3 -->
**Dependencies Added****:**

<!-- @mid:list-h4jkl4 -->
- `diff` - Word-level diff algorithm for compare view

<!-- @mid:p-h4mno5 -->
**Key Features****:**

<!-- @mid:list-h4pqr6 -->
- [x] History panel with bookmark and auto-save sections
- [x] Checkpoint selection and restore flow
- [x] Create bookmarks from toolbar
- [x] Label existing checkpoints
- [x] Compare versions with word-level diff highlighting
- [x] Restore from compare modal
- [x] Word/character stats per checkpoint

---

<!-- @mid:h-8w92lh -->
### **Phase 5: Drafts - ****COMPLETE**

<!-- @mid:p-s2941k -->
**Completed****: 2025-12-06**

<!-- @mid:p-ph5abc -->
**Files Created****:**

<!-- @mid:list-ph5def -->
- `electron/services/draftManager.ts` - Draft management with checkpoints
- `electron/services/draftManager.test.ts` - 37 tests
- `src/store/useDraftStore.ts` - Zustand store for draft state
- `src/components/DraftPanel.tsx` - Sidebar panel for draft management
- `src/components/DraftItem.tsx` - Individual draft display
- `src/components/CreateDraftModal.tsx` - New draft dialog

<!-- @mid:p-ph5ghi -->
**Files Modified****:**

<!-- @mid:list-ph5jkl -->
- `electron/services/workspaceManager.ts` - Added DraftManager integration
- `electron/main.ts` - Added 12 draft IPC handlers
- `electron/preload.ts` - Exposed draft APIs
- `src/vite-env.d.ts` - Added draft type definitions
- `src/components/EditorToolbar.tsx` - Added draft toggle button
- `src/components/Editor.tsx` - Integrated DraftPanel and draft mode

<!-- @mid:p-ph5mno -->
**Key Features****:**

<!-- @mid:list-ph5pqr -->
- [x] Create drafts from current document or checkpoint
- [x] Independent checkpoint history per draft (max 20)
- [x] Switch between main document and drafts
- [x] Rename drafts
- [x] Apply (merge) draft to main document
- [x] Discard/archive drafts
- [x] Delete drafts permanently
- [x] Visual indicator when editing a draft
- [x] GC integration for draft content

---

<!-- @mid:h-fy8fsa -->
### **Phase 6: Tier Enforcement - ****PENDING**

<!-- @mid:p-vlaogr -->
**Goal****: Free/paid limits work correctly**

<!-- @mid:p-9s9l30 -->
**Tasks****:**

<!-- @mid:list-xxol8g -->
- [ ] Create tier configuration system
- [ ] Add license/subscription check
- [ ] Implement limit checking
- [ ] Create upgrade prompt components
- [ ] Add retention enforcement
- [ ] Add garbage collection scheduling

---

<!-- @mid:h-jl1lu0 -->
### **Phase 7: Polish & Testing - ****PENDING**

<!-- @mid:p-3jpyrr -->
**Goal****: Production-ready quality**

<!-- @mid:p-uay2py -->
**Tasks****:**

<!-- @mid:list-0fk8ph -->
- [ ] Comprehensive error handling
- [ ] Loading states for all async operations
- [ ] Keyboard shortcuts for history/drafts
- [ ] Performance optimization
- [ ] Edge case testing
- [ ] Documentation
- [ ] Onboarding tooltips

---

<!-- @mid:h-bivtya -->
## 13. Technical Specifications

<!-- @mid:h-9i3s2t -->
### **13.1 IPC API - ****IMPLEMENTED**

<!-- @mid:p-akzl66 -->
`All workspace IPC handlers are implemented in ``electron/main.ts``:`

<!-- @mid:code-1hmlzo -->
```typescript
// Workspace management
ipcMain.handle('workspace:init', ...)
ipcMain.handle('workspace:loadDocument', ...)
ipcMain.handle('workspace:saveDocument', ...)
ipcMain.handle('workspace:loadFromRecovery', ...)
ipcMain.handle('workspace:discardRecovery', ...)

// Checkpoints
ipcMain.handle('workspace:getCheckpoints', ...)
ipcMain.handle('workspace:getCheckpointContent', ...)
ipcMain.handle('workspace:restoreCheckpoint', ...)
ipcMain.handle('workspace:createBookmark', ...)
ipcMain.handle('workspace:labelCheckpoint', ...)
ipcMain.handle('workspace:compareCheckpoints', ...)

// Images
ipcMain.handle('workspace:getImageDataUrl', ...)

// Recovery
ipcMain.handle('workspace:checkForRecovery', ...)

// Storage management
ipcMain.handle('workspace:getStorageStats', ...)
ipcMain.handle('workspace:runGC', ...)
ipcMain.handle('workspace:getConfig', ...)
ipcMain.handle('workspace:updateConfig', ...)
```

<!-- @mid:h-f0bp1i -->
### **13.2 Preload API - ****IMPLEMENTED**

<!-- @mid:p-eub682 -->
`All workspace methods exposed in ``electron/preload.ts``:`

<!-- @mid:code-e22jev -->
```typescript
contextBridge.exposeInMainWorld('electronAPI', {
  // ... existing methods ...

  // Workspace APIs
  workspaceInit: (workspaceRoot) => ...,
  workspaceLoadDocument: (workspaceRoot, filePath) => ...,
  workspaceSaveDocument: (workspaceRoot, filePath, json, trigger) => ...,
  workspaceLoadFromRecovery: (workspaceRoot, filePath) => ...,
  workspaceDiscardRecovery: (workspaceRoot, filePath) => ...,
  workspaceGetCheckpoints: (workspaceRoot, filePath) => ...,
  workspaceGetCheckpointContent: (workspaceRoot, filePath, checkpointId) => ...,
  workspaceRestoreCheckpoint: (workspaceRoot, filePath, checkpointId) => ...,
  workspaceCreateBookmark: (workspaceRoot, filePath, json, label) => ...,
  workspaceLabelCheckpoint: (workspaceRoot, filePath, checkpointId, label) => ...,
  workspaceCompareCheckpoints: (workspaceRoot, filePath, idA, idB) => ...,
  workspaceGetImageDataUrl: (workspaceRoot, imageRef) => ...,
  workspaceCheckForRecovery: (workspaceRoot) => ...,
  workspaceGetStorageStats: (workspaceRoot) => ...,
  workspaceRunGC: (workspaceRoot) => ...,
  workspaceGetConfig: (workspaceRoot) => ...,
  workspaceUpdateConfig: (workspaceRoot, updates) => ...,
});
```

<!-- @mid:h-4htkyf -->
### 13.3 Dependencies

<!-- @mid:p-1jmdlh -->
**Added for Storage & Versioning****:**

<!-- @mid:list-cssnma -->
- `chokidar` - File watching (Phase 3)
- `diff` - Word-level diffing for compare view (Phase 4)
- `vitest` - Testing framework (dev dependency)

---

<!-- @mid:h-hzoh9m -->
## 14. Testing Strategy

<!-- @mid:h-6weqz9 -->
### **Unit Tests - ****IMPLEMENTED**

<!-- @mid:p-zl2mx6 -->
**| Service | Tests | Status |
|---------|-------|--------|
| ObjectStore | 24 | Passing |
| CheckpointManager | 26 | Passing |
| ImageManager | 29 | Passing |
| RecoveryManager | 29 | Passing |
| DocumentSerializer | 31 | Passing |
| WorkspaceManager | 26 | Passing |
| FileWatcher | 17 | 12 Passing, 5 Skipped |
| DraftManager | 37 | Passing |
| ****Total**** | ****221**** | ****216 Passing, 5 Skipped**** |**

<!-- @mid:h-v7b8e2 -->
### Coverage Report

<!-- @mid:code-q819fy -->
```
File                      | % Stmts | % Branch | % Funcs | % Lines
--------------------------|---------|----------|---------|--------
checkpointManager.ts      |   93.98 |    82.05 |   95.00 |   95.65
documentDeserializer.ts   |   74.77 |    62.23 |   94.11 |   74.77
documentSerializer.ts     |   70.68 |    50.35 |   91.66 |   69.89
imageManager.ts           |   87.68 |    80.00 |  100.00 |   86.82
objectStore.ts            |   95.34 |    66.66 |  100.00 |  100.00
recoveryManager.ts        |   95.83 |    81.81 |  100.00 |   97.14
types.ts                  |  100.00 |   100.00 |  100.00 |  100.00
workspaceManager.ts       |   77.16 |    58.62 |   72.22 |   79.48
--------------------------|---------|----------|---------|--------
Overall                   |   82.62 |    64.28 |   91.01 |   83.21
```

<!-- @mid:h-qzznr6 -->
### **Integration Tests - ****IMPLEMENTED**

<!-- @mid:p-yoe1zw -->
WorkspaceManager tests cover:

<!-- @mid:list-wulz6i -->
- Full save/load cycle with versioning
- Checkpoint creation and restoration
- Recovery flow
- Error handling

<!-- @mid:h-4d3hfk -->
### **Manual Test Cases - ****PENDING**

<!-- @mid:p-p6l51e -->
See Phase 7 for manual testing checklist.

---

<!-- @mid:h-dorzv8 -->
## Summary

<!-- @mid:h-padw7o -->
### Completed

<!-- @mid:list-a85zoh -->
- Clean Markdown + Sidecar storage format
- Git-like content-addressable object store
- Automatic checkpoint versioning
- Crash recovery via WAL
- Image extraction and deduplication
- Frontend integration with Tiptap JSON
- File watching for external changes
- External change notification UI
- History panel with version browsing
- Compare versions with diff view
- Bookmark creation and labeling
- Draft system for experimental changes
- Comprehensive test suite (221 tests, 5 skipped)

<!-- @mid:h-6qmgte -->
### In Progress

<!-- @mid:list-u2o63z -->
- None

<!-- @mid:h-b5yc37 -->
### Remaining

<!-- @mid:list-2tb879 -->
- Tier enforcement for free/paid (Phase 6)
- Polish and final testing (Phase 7)

---

<!-- @mid:p-yhhyvc -->
*Document created: 2025-12-05**
**Last updated: 2025-12-06**
**Status: Phases 1-5 Complete, Phases 6-7 Pending*