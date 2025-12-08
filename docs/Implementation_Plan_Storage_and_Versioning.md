<!-- @mid:h-m5q3i1 -->
# Implementation Plan: Storage, Versioning & Document Management

<!-- @mid:p-hhttiz -->
A comprehensive implementation plan for Midlight's new storage architecture, Git-like versioning system, and document management—designed for long-term scalability and user-friendly operation.

---

<!-- @mid:h-k7vu97 -->
## Implementation Status

<!-- @mid:p-0i6j5w -->
************| Phase | Description | Status | Completion Date |
|-------|-------------|--------|-----------------|
| Phase 1 | Core Services | ******Complete********** | 2025-12-05 |
| Phase 2 | Frontend Integration | ******Complete********** | 2025-12-05 |
| Phase 3 | File Watching | ******Complete********** | 2025-12-05 |
| Phase 4 | History UI | ******Complete********** | 2025-12-05 |
| Phase 5 | Drafts System | ******Complete********** | 2025-12-06 |
| Phase 6 | Tier Enforcement | Pending | - |
| Phase 7 | Polish & Testing | Pending | - |************

---

<!-- @mid:h-ju4m28 -->
## Executive Summary

<!-- @mid:p-j9qjnt -->
This plan consolidates our research into an actionable implementation roadmap that:

<!-- @mid:list-tiir30 -->
1. **Replaces inline HTML storage** with a clean Markdown + Sidecar approach
2. **Implements content-addressable versioning** (Git-like, but invisible to users)
3. **Separates images** from documents for efficient storage
4. **Adds file watching** for external change detection
5. **Prepares for cloud sync** (paid tier) without requiring it (free tier)

<!-- @mid:p-leqokc -->
**Timeline**************: 8-10 weeks for full implementation
******Risk Level******: Medium (requires migration of existing files)********

---

<!-- @mid:h-itkssl -->
## Table of Contents

<!-- @mid:list-ibbagn -->
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

<!-- @mid:h-2w5l9f -->
## 1. Architecture Overview

<!-- @mid:h-5f6a89 -->
### Directory Structure

<!-- @mid:code-6ml7rx -->
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

<!-- @mid:h-wtksbj -->
### Data Flow Diagram

<!-- @mid:code-yd1cuo -->
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

<!-- @mid:h-gu0hpk -->
## 2. File Format Specification

<!-- @mid:h-ma18dn -->
### 2.1 Markdown File (.md)

<!-- @mid:p-1dlxhn -->
Clean, portable Markdown with invisible block anchors.

<!-- @mid:code-x6a8te -->
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

<!-- @mid:p-45fd7y -->
**Rules:**

<!-- @mid:list-lfx2f5 -->
- Block IDs are HTML comments (invisible in all renderers)
- Format: `<!-- @mid:{type}-{6-char-id} -->`
- IDs generated on first save, preserved thereafter
- If ID missing on load, generate new one
- Image references use `@img:{hash}` syntax

<!-- @mid:h-h7cdwu -->
### 2.2 Sidecar File (.midlight/sidecars/{hash}.json)

<!-- @mid:p-6q9eoi -->
JSON file containing all formatting, metadata, and document settings.

<!-- @mid:code-oe1uv8 -->
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

<!-- @mid:h-gqhxoi -->
### 2.3 Workspace Config (.midlight/config.json)

<!-- @mid:code-97foe1 -->
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

<!-- @mid:h-h670cl -->
## 3. Content-Addressable Object Store

<!-- @mid:h-qqwkhh -->
### **Status: ****IMPLEMENTED**** (Phase 1)**

<!-- @mid:p-ni33fb -->
**``File``****``: ``****``electron/services/objectStore.ts``**

<!-- @mid:h-qdvbs2 -->
### Features Implemented:

<!-- @mid:list-7un16c -->
- SHA-256 content hashing
- Gzip compression for storage efficiency
- Automatic deduplication
- Garbage collection support
- Storage size tracking

<!-- @mid:h-7bkdt1 -->
### API:

<!-- @mid:code-lys8fq -->
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

<!-- @mid:h-6bw4mc -->
### Test Coverage: 24 tests passing

---

<!-- @mid:h-sqhemq -->
## 4. Checkpoint System

<!-- @mid:h-0hpza4 -->
### **Status: ****IMPLEMENTED**** (Phase 1)**

<!-- @mid:p-28ky50 -->
**``File``****``: ``****``electron/services/checkpointManager.ts``**

<!-- @mid:h-3uehiw -->
### Features Implemented:

<!-- @mid:list-7kekt3 -->
- Automatic checkpoint creation on save
- Bookmark support (named checkpoints)
- Checkpoint restoration
- Checkpoint comparison
- Retention limits (max checkpoints, age)
- Parent-child relationship tracking

<!-- @mid:h-td9amf -->
### Checkpoint Metadata Structure:

<!-- @mid:code-8yqkbq -->
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

<!-- @mid:h-a90cx8 -->
### API:

<!-- @mid:code-expali -->
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

<!-- @mid:h-xb1vul -->
### Test Coverage: 26 tests passing

---

<!-- @mid:h-8jzhjb -->
## 5. Draft System (Branching)

<!-- @mid:h-mt4gqz -->
### **Status: ****IMPLEMENTED**** (Phase 5)**

<!-- @mid:p-5ly9qr -->
**`File`****`: `****`electron/services/draftManager.ts`**

<!-- @mid:h-xhmcz3 -->
### Features Implemented:

<!-- @mid:list-0du56o -->
- Create drafts from current document or any checkpoint
- Independent checkpoint history per draft (max 20 checkpoints)
- Draft statuses: active, merged, archived
- Apply (merge) draft content to main document
- Discard/archive drafts without deleting
- Permanent draft deletion
- GC integration for draft content hashes

<!-- @mid:h-j38v91 -->
### API:

<!-- @mid:code-vd3mwq -->
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

<!-- @mid:h-fm8lhf -->
### Test Coverage: 37 tests passing

---

<!-- @mid:h-x3uyna -->
## 6. File Watcher Integration

<!-- @mid:h-euwh2f -->
### **Status: ****IMPLEMENTED**** (Phase 3)**

<!-- @mid:p-h90hy4 -->
**`File`****`: `****`electron/services/fileWatcher.ts`**

<!-- @mid:h-w6ye2k -->
### Features Implemented:

<!-- @mid:list-l31dpt -->
- chokidar-based file watching with debouncing
- "Saving" marks to ignore self-triggered changes
- mtime tracking for external change detection
- Support for add/change/unlink events
- Ignored patterns (.midlight, .git, node_modules)
- IPC events for renderer notification

<!-- @mid:h-c64h1s -->
### API:

<!-- @mid:code-qm03fs -->
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

<!-- @mid:h-a4d8qo -->
### UI Component: `src/components/ExternalChangeDialog.tsx`

<!-- @mid:list-vm1bpy -->
- Modal dialog for external change notifications
- Handles modified files (Reload/Keep Mine options)
- Handles deleted files (Keep Editing/Close File options)
- Time-ago display for change timestamp

<!-- @mid:h-cg8esn -->
### Test Coverage: 17 tests (12 passing, 5 skipped for flaky FS events)

---

<!-- @mid:h-uy28c1 -->
## 7. Image Management

<!-- @mid:h-1tgh6r -->
### **Status: ****IMPLEMENTED**** (Phase 1)**

<!-- @mid:p-7ac8g3 -->
**``File``****``: ``****``electron/services/imageManager.ts``**

<!-- @mid:h-nrdz2a -->
### Features Implemented:

<!-- @mid:list-tkedx4 -->
- Base64 image storage
- Buffer image storage
- Content-based deduplication (SHA-256)
- Multiple format support (PNG, JPEG, GIF, WebP)
- Image reference system (`@img:{hash}`)
- Garbage collection for unreferenced images

<!-- @mid:h-r7e85m -->
### API:

<!-- @mid:code-ny3934 -->
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

<!-- @mid:h-erb516 -->
### Test Coverage: 29 tests passing

---

<!-- @mid:h-mrjr19 -->
## 8. Crash Recovery

<!-- @mid:h-rxz7h8 -->
### **Status: ****IMPLEMENTED**** (Phase 1 + Phase 2)**

<!-- @mid:p-w9puf1 -->
**``File``****``: ``****``electron/services/recoveryManager.ts``**

<!-- @mid:h-uzoltq -->
### Features Implemented:

<!-- @mid:list-zjmb7l -->
- Write-Ahead Log (WAL) for crash recovery
- Configurable WAL interval (default 500ms)
- Recovery detection on startup
- Apply/discard recovery options
- Per-file recovery tracking
- Recovery prompt UI in editor

<!-- @mid:h-xwg0x8 -->
### API:

<!-- @mid:code-axck0p -->
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

<!-- @mid:h-rc7o5g -->
### `UI Component: ``src/components/RecoveryPrompt.tsx`

<!-- @mid:list-s9obmc -->
- Yellow warning banner
- "Restore changes" / "Discard" buttons
- Time-ago display

<!-- @mid:h-ojjbmb -->
### Test Coverage: 29 tests passing

---

<!-- @mid:h-n2zj12 -->
## 9. Migration Strategy

<!-- @mid:h-xdf2q8 -->
### **Status: ****IMPLEMENTED**** (Phase 2)**

<!-- @mid:p-dz3smw -->
Existing markdown files without sidecars are automatically handled:

<!-- @mid:list-24drju -->
1. `workspaceLoadDocument()` detects missing sidecar
2. Backend reads raw markdown
3. Backend parses markdown to Tiptap JSON (basic conversion)
4. On first save, full sidecar is created
5. Future loads use the sidecar

<!-- @mid:p-gm9j4d -->
**No explicit migration UI needed**** - handled transparently by DocumentDeserializer.**

---

<!-- @mid:h-w94wl6 -->
## 10. UI Components

<!-- @mid:h-05sozk -->
### Implemented (Phase 2)

<!-- @mid:list-5h44oh -->
- **RecoveryPrompt** (`src/components/RecoveryPrompt.tsx`)
- Crash recovery notification
- Restore/discard options

<!-- @mid:h-xw8079 -->
### Implemented (Phase 3)

<!-- @mid:list-8i1bxd -->
- **ExternalChangeDialog** (`src/components/ExternalChangeDialog.tsx`)
- External file change notification
- Reload/Keep Mine options for modified files
- Keep Editing/Close File options for deleted files

<!-- @mid:h-9ld2a9 -->
### Implemented (Phase 4)

<!-- @mid:list-ibbxlb -->
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

<!-- @mid:h-9n0eqk -->
### Implemented (Phase 5)

<!-- @mid:list-yovh5h -->
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

<!-- @mid:h-8wp2oj -->
## 11. Free vs Paid Tier Logic

<!-- @mid:h-i98656 -->
### **Status: ****DEFINED**** (Implementation in Phase 6)**

<!-- @mid:code-hh8aik -->
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

<!-- @mid:h-9oed0c -->
## 12. Implementation Phases

<!-- @mid:h-4nm0tm -->
### **Phase 1: Core Services - ****COMPLETE**

<!-- @mid:p-dhpkf6 -->
**Completed****: 2025-12-05**

<!-- @mid:p-fs8379 -->
**Files Created****:**

<!-- @mid:list-10yzh2 -->
- `electron/services/objectStore.ts` - Content-addressable storage
- `electron/services/checkpointManager.ts` - Version history
- `electron/services/imageManager.ts` - Image extraction/deduplication
- `electron/services/recoveryManager.ts` - Crash recovery WAL
- `electron/services/documentSerializer.ts` - Tiptap JSON → Markdown + Sidecar
- `electron/services/documentDeserializer.ts` - Markdown + Sidecar → Tiptap JSON
- `electron/services/workspaceManager.ts` - Central coordinator
- `electron/services/types.ts` - Shared type definitions
- `electron/services/index.ts` - Barrel exports

<!-- @mid:p-8sb17l -->
**Test Files Created****:**

<!-- @mid:list-xplfbb -->
- `electron/services/objectStore.test.ts` (24 tests)
- `electron/services/checkpointManager.test.ts` (26 tests)
- `electron/services/imageManager.test.ts` (29 tests)
- `electron/services/recoveryManager.test.ts` (29 tests)
- `electron/services/documentSerializer.test.ts` (31 tests)
- `electron/services/workspaceManager.test.ts` (26 tests)

<!-- @mid:p-jvn2ce -->
**Total****: 165 tests passing, ~83% coverage**

---

<!-- @mid:h-m4qtmh -->
### **Phase 2: Frontend Integration - ****COMPLETE**

<!-- @mid:p-p402xk -->
**Completed****: 2025-12-05**

<!-- @mid:p-hwvxpn -->
**Files Modified****:**

<!-- @mid:list-ka6tm1 -->
- `src/store/useFileSystem.ts` - Complete rewrite to use workspace APIs
- `src/components/Editor.tsx` - Changed from markdown to JSON content
- `src/App.tsx` - Updated DOCX import to use Tiptap JSON
- `electron/main.ts` - Added 16 IPC handlers for workspace APIs
- `electron/preload.ts` - Exposed workspace APIs to renderer
- `src/vite-env.d.ts` - Added type definitions for new APIs

<!-- @mid:p-axuomr -->
**Files Created****:**

<!-- @mid:list-stq5vy -->
- `src/components/RecoveryPrompt.tsx` - Recovery notification UI
- `src/utils/htmlToTiptap.ts` - HTML to Tiptap JSON converter (for DOCX import)

<!-- @mid:p-t2szt2 -->
**Files Deleted****:**

<!-- @mid:list-xj7led -->
- `src/utils/markdown.ts` - Replaced by backend serializers

<!-- @mid:p-bm2zeu -->
**Key Changes****:**

<!-- @mid:list-s5eh7k -->
- Editor now stores/loads Tiptap JSON directly (not markdown strings)
- Workspace initialization on directory load
- Recovery detection and UI prompt
- All saves go through workspace API (enables versioning)

---

<!-- @mid:h-ia8r6w -->
### **Phase 3: File Watching - ****COMPLETE**

<!-- @mid:p-wfbpui -->
**Completed****: 2025-12-05**

<!-- @mid:p-2yvlbb -->
**Files Created****:**

<!-- @mid:list-8sk0a1 -->
- `electron/services/fileWatcher.ts` - Core file watching class
- `electron/services/fileWatcher.test.ts` - Tests (17 total, 12 passing)
- `src/components/ExternalChangeDialog.tsx` - External change notification UI

<!-- @mid:p-wcuvnz -->
**Files Modified****:**

<!-- @mid:list-xxptg8 -->
- `electron/main.ts` - FileWatcher integration and IPC handlers
- `electron/preload.ts` - Exposed new APIs (stopWatcher, hasExternalChange, onFileChangedExternally)
- `src/vite-env.d.ts` - Type definitions for new APIs
- `src/store/useFileSystem.ts` - External change state and actions
- `src/components/Editor.tsx` - External change listener and dialog integration

<!-- @mid:p-d41ogm -->
**Key Features****:**

<!-- @mid:list-yxjm1y -->
- [x] chokidar-based file watching with debouncing (500ms default)
- [x] "Saving" marks to ignore self-triggered changes
- [x] mtime tracking for external change detection
- [x] IPC events for renderer notification
- [x] ExternalChangeDialog with Reload/Keep options
- [x] Proper cleanup when switching workspaces

---

<!-- @mid:h-2uq8p7 -->
### **Phase 4: History UI - ****COMPLETE**

<!-- @mid:p-fi362o -->
**Completed****: 2025-12-05**

<!-- @mid:p-x0f72a -->
**Files Created****:**

<!-- @mid:list-yj73pe -->
- `src/store/useHistoryStore.ts` - State management for history panel
- `src/components/HistoryPanel.tsx` - Sidebar panel for version history
- `src/components/CheckpointItem.tsx` - Individual checkpoint display
- `src/components/CompareModal.tsx` - Diff view modal for comparing versions

<!-- @mid:p-jsh2k4 -->
**Files Modified****:**

<!-- @mid:list-39xd9h -->
- `src/components/EditorToolbar.tsx` - Added history toggle and bookmark button
- `src/components/Editor.tsx` - Integrated HistoryPanel with restore flow

<!-- @mid:p-c3gwar -->
**Dependencies Added****:**

<!-- @mid:list-bzctca -->
- `diff` - Word-level diff algorithm for compare view

<!-- @mid:p-pe0fs4 -->
**Key Features****:**

<!-- @mid:list-219d9u -->
- [x] History panel with bookmark and auto-save sections
- [x] Checkpoint selection and restore flow
- [x] Create bookmarks from toolbar
- [x] Label existing checkpoints
- [x] Compare versions with word-level diff highlighting
- [x] Restore from compare modal
- [x] Word/character stats per checkpoint

---

<!-- @mid:h-9svoew -->
### **Phase 5: Drafts - ****COMPLETE**

<!-- @mid:p-2953h8 -->
**Completed****: 2025-12-06**

<!-- @mid:p-61sk94 -->
**Files Created****:**

<!-- @mid:list-bihj5f -->
- `electron/services/draftManager.ts` - Draft management with checkpoints
- `electron/services/draftManager.test.ts` - 37 tests
- `src/store/useDraftStore.ts` - Zustand store for draft state
- `src/components/DraftPanel.tsx` - Sidebar panel for draft management
- `src/components/DraftItem.tsx` - Individual draft display
- `src/components/CreateDraftModal.tsx` - New draft dialog

<!-- @mid:p-3fn4lw -->
**Files Modified****:**

<!-- @mid:list-wi4fc6 -->
- `electron/services/workspaceManager.ts` - Added DraftManager integration
- `electron/main.ts` - Added 12 draft IPC handlers
- `electron/preload.ts` - Exposed draft APIs
- `src/vite-env.d.ts` - Added draft type definitions
- `src/components/EditorToolbar.tsx` - Added draft toggle button
- `src/components/Editor.tsx` - Integrated DraftPanel and draft mode

<!-- @mid:p-p2hm95 -->
**Key Features****:**

<!-- @mid:list-ioemn0 -->
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

<!-- @mid:h-kpb4kh -->
### **Phase 6: Tier Enforcement - ****PENDING**

<!-- @mid:p-7w1i89 -->
**Goal****: Free/paid limits work correctly**

<!-- @mid:p-uspnbn -->
**Tasks****:**

<!-- @mid:list-90id9u -->
- [ ] Create tier configuration system
- [ ] Add license/subscription check
- [ ] Implement limit checking
- [ ] Create upgrade prompt components
- [ ] Add retention enforcement
- [ ] Add garbage collection scheduling

---

<!-- @mid:h-0c8m7k -->
### **Phase 7: Polish & Testing - ****PENDING**

<!-- @mid:p-ax6sci -->
**Goal****: Production-ready quality**

<!-- @mid:p-arb0ql -->
**Tasks****:**

<!-- @mid:list-c501n8 -->
- [ ] Comprehensive error handling
- [ ] Loading states for all async operations
- [ ] Keyboard shortcuts for history/drafts
- [ ] Performance optimization
- [ ] Edge case testing
- [ ] Documentation
- [ ] Onboarding tooltips

---

<!-- @mid:h-rqvzh7 -->
## 13. Technical Specifications

<!-- @mid:h-8ntwci -->
### **13.1 IPC API - ****IMPLEMENTED**

<!-- @mid:p-hp3w6l -->
`All workspace IPC handlers are implemented in ``electron/main.ts``:`

<!-- @mid:code-t538so -->
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

<!-- @mid:h-4xu428 -->
### **13.2 Preload API - ****IMPLEMENTED**

<!-- @mid:p-lggfz4 -->
`All workspace methods exposed in ``electron/preload.ts``:`

<!-- @mid:code-gyahzj -->
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

<!-- @mid:h-oy2yey -->
### 13.3 Dependencies

<!-- @mid:p-y823kw -->
**Added for Storage & Versioning****:**

<!-- @mid:list-w3m4bo -->
- `chokidar` - File watching (Phase 3)
- `diff` - Word-level diffing for compare view (Phase 4)
- `vitest` - Testing framework (dev dependency)

---

<!-- @mid:h-r7xudg -->
## 14. Testing Strategy

<!-- @mid:h-nq8fyw -->
### **Unit Tests - ****IMPLEMENTED**

<!-- @mid:p-l3upp5 -->
************| Service | Tests | Status |
|---------|-------|--------|
| ObjectStore | 24 | Passing |
| CheckpointManager | 26 | Passing |
| ImageManager | 29 | Passing |
| RecoveryManager | 29 | Passing |
| DocumentSerializer | 31 | Passing |
| WorkspaceManager | 26 | Passing |
| FileWatcher | 17 | 12 Passing, 5 Skipped |
| DraftManager | 37 | Passing |
| ******Total****** | ******221****** | ******216 Passing, 5 Skipped****** |********

<!-- @mid:h-65rxlc -->
### Coverage Report

<!-- @mid:code-9yo62q -->
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

<!-- @mid:h-qwcy1j -->
### **Integration Tests - ****IMPLEMENTED**

<!-- @mid:p-f0q5pk -->
WorkspaceManager tests cover:

<!-- @mid:list-agywco -->
- Full save/load cycle with versioning
- Checkpoint creation and restoration
- Recovery flow
- Error handling

<!-- @mid:h-9kmgtp -->
### **Manual Test Cases - ****PENDING**

<!-- @mid:p-iqxl2s -->
See Phase 7 for manual testing checklist.

---

<!-- @mid:h-64rja5 -->
## Summary

<!-- @mid:h-irkgqc -->
### Completed

<!-- @mid:list-u85vhq -->
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

<!-- @mid:h-9qnk6g -->
### In Progress

<!-- @mid:list-xrxs8z -->
- None

<!-- @mid:h-iw70as -->
### Remaining

<!-- @mid:list-64wudx -->
- Tier enforcement for free/paid (Phase 6)
- Polish and final testing (Phase 7)

---

<!-- @mid:p-054xue -->
*Document created: 2025-12-05*****
****Last updated: 2025-12-06****
***Status: Phases 1-5 Complete, Phases 6-7 Pending*