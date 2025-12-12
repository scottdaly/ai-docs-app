# File Storage & Versioning: Comprehensive Guide

This document consolidates Midlight's approach to file storage, saving, and version control. It covers the current implementation, strategic decisions, and future roadmap.

---

## Table of Contents

1. [Current Implementation](#1-current-implementation)
2. [Storage Strategy](#2-storage-strategy)
3. [Version Control Approach](#3-version-control-approach)
4. [Alternative Approaches Considered](#4-alternative-approaches-considered)
5. [Image Handling](#5-image-handling)
6. [Crash Recovery](#6-crash-recovery)
7. [External Change Detection](#7-external-change-detection)
8. [Implementation Roadmap](#8-implementation-roadmap)
9. [Appendix: Technical Details](#9-appendix-technical-details)

---

## 1. Current Implementation

### 1.1 Auto-Save Mechanism

**Location:** `src/components/Editor.tsx`

Midlight uses debounced auto-saving:

```typescript
onUpdate: ({ editor }) => {
  // Only update isDirty if not already true (performance optimization)
  const currentIsDirty = useFileSystem.getState().isDirty;
  if (!currentIsDirty) {
    setIsDirty(true);
  }

  if (saveTimeoutRef.current) {
    clearTimeout(saveTimeoutRef.current);
  }

  saveTimeoutRef.current = setTimeout(() => {
    const json = editor.getJSON();
    saveFile(JSON.stringify(json));
  }, 1000);  // 1 second debounce
}
```

**Characteristics:**
- Save frequency: Maximum once per second after typing stops
- User feedback: None (silent save)
- Format: Tiptap JSON
- Error handling: Console log only

### 1.2 Storage Format: Tiptap JSON

**Decision:** Store documents as Tiptap JSON rather than Markdown.

**Why JSON over Markdown:**

| Factor | Markdown + HTML | Tiptap JSON |
|--------|-----------------|-------------|
| Fidelity | Lossy conversions | Perfect preservation |
| Performance | Conversion overhead | Direct read/write |
| Rich formatting | Inline HTML soup | Native structure |
| File readability | Degraded with HTML | Structured but not human-readable |
| Editor compatibility | Other MD editors | Midlight only |

The original plan was to use Markdown with a sidecar `.midlight` file for formatting, but this approach was abandoned in favor of Tiptap JSON for simplicity and fidelity.

### 1.3 Session Persistence

**Storage:** localStorage via Zustand persist middleware

**File:** `src/store/useFileSystem.ts`

```typescript
persist(
  (set, get) => ({ /* state */ }),
  {
    name: 'midlight-storage',
    partialize: (state) => ({
      rootDir: state.rootDir,
      openFiles: state.openFiles,
      activeFilePath: state.activeFilePath,
    }),
  }
)
```

**What's Persisted:**
- Last opened workspace path
- Array of open file tabs
- Currently focused file

**What's NOT Persisted:**
- File tree (reloaded on startup)
- File content (reloaded from disk)
- isDirty flag (reset to false)
- Undo/redo history (lost on restart)

---

## 2. Storage Strategy

### 2.1 Dual-File Architecture (Recommended Future)

The long-term strategy is a dual-file system:

```
workspace/
├── document.md           # Clean Markdown (content)
├── document.md.midlight  # Rich metadata (JSON)
└── .midlight/
    └── images/           # Extracted images
```

**Benefits:**
1. **Portability**: The `.md` file works in any text editor
2. **Rich Features**: The `.midlight` file enables features beyond Markdown
3. **Graceful Degradation**: If `.midlight` is lost, content survives
4. **No Lock-in**: Users can leave with their content intact

**Current Status:** Not yet implemented. Currently using single Tiptap JSON files.

### 2.2 File Categories

Midlight categorizes files in the workspace:

| Category | Detection | Behavior |
|----------|-----------|----------|
| Native | `.md` with `.midlight` sibling | Full editing |
| Compatible | `.md` without `.midlight` | Basic editing, import prompt |
| Importable | `.docx`, `.rtf`, `.html` | Must convert first |
| Viewable | Images, PDFs | Preview only |
| Unsupported | Other files | Dimmed, no actions |

---

## 3. Version Control Approach

### 3.1 Terminology (User-Facing)

| Git Concept | Midlight Term | User Mental Model |
|-------------|---------------|-------------------|
| Commit | **Checkpoint** | "Save a moment in time" |
| Branch | **Draft** | "Try something without messing up the original" |
| Main/Master | **Published** | "The real version" |
| Merge | **Apply Changes** | "Use what I tried in the draft" |
| Revert | **Restore** | "Go back to how it was" |
| Diff | **Compare** | "What changed?" |

### 3.2 Checkpoint System

**Automatic Checkpoints:**
- Created on interval (5 minutes default)
- Created on significant change (100+ characters)
- Created on file close
- No user action required

**Named Checkpoints (Bookmarks):**
- User-initiated markers for important moments
- Exempt from auto-cleanup
- Labeled with user-provided name

### 3.3 Drafts (Branches)

Drafts allow experimental editing without affecting the main document:

```typescript
interface Draft {
  id: string;
  name: string;              // User-friendly name
  sourceCheckpoint: string;  // Where the draft started
  currentHead: string;       // Latest checkpoint in draft
  checkpoints: Checkpoint[]; // Draft's own history
  status: 'active' | 'merged' | 'archived';
}
```

**Workflow:**
1. User creates draft from any checkpoint
2. Edits are saved to draft's checkpoint history
3. When ready, user can:
   - **Replace**: Draft content replaces main
   - **Compare**: Side-by-side view, pick sections
   - **Discard**: Delete draft, keep main unchanged

### 3.4 Free vs. Paid Tiers (Planned)

| Feature | Free | Pro (~$8/mo) |
|---------|------|--------------|
| Auto checkpoints | ✓ | ✓ |
| Checkpoint retention | 7 days | 1 year |
| Max checkpoints/file | 50 | Unlimited |
| Named bookmarks | 3 per file | Unlimited |
| Drafts | 1 active | Unlimited |
| Cloud sync of history | ❌ | ✓ |
| AI "What changed?" | ❌ | ✓ |

---

## 4. Alternative Approaches Considered

### 4.1 Shadow Directory (Timestamped Files)

```
.midlight/history/document.md/
├── 2024-01-15T10-30-00.md
├── 2024-01-15T11-45-00.md
└── 2024-01-15T14-20-00.md
```

**Pros:**
- Simple to implement
- Human-readable versions
- No dependencies

**Cons:**
- No deduplication (disk space)
- Inefficient for large files
- Limited metadata

**Status:** Recommended for MVP due to simplicity.

### 4.2 SQLite Database

```
.midlight/history.db
```

**Pros:**
- Efficient queries
- Rich metadata
- Compression
- ACID guarantees

**Cons:**
- Native module complexity
- Not human-readable
- Build complexity

**Status:** Consider if version queries become slow.

### 4.3 Git-Like Content-Addressable Store

```
.midlight/
├── objects/
│   ├── ab/cdef123...  (gzipped content blob)
│   └── 12/3456789...
└── refs/
    └── document.md.json  (version pointers)
```

**Pros:**
- Deduplication
- Efficient diffs
- Branching ready
- Integrity via hash

**Cons:**
- Most complex to implement
- Overkill for simple use cases

**Status:** Future consideration for collaboration features.

### 4.4 CRDT-Based (Automerge/Yjs)

**Pros:**
- Infinite undo
- Collaboration-ready
- Time travel
- Automatic merge

**Cons:**
- File format change (not plain Markdown)
- Storage overhead
- Library dependency
- Complex concepts

**Status:** Future exploration for real-time collaboration.

### 4.5 Comparison Matrix

| Factor | Shadow Dir | SQLite | Git-Like | CRDT |
|--------|------------|--------|----------|------|
| Implementation effort | Low | Medium | High | High |
| Human-readable | Yes | No | No | No |
| Disk efficiency | Poor | Good | Excellent | Moderate |
| Query capability | None | Excellent | Good | Limited |
| Branching | No | Manual | Yes | Yes |
| Collaboration-ready | No | No | Partial | Yes |

---

## 5. Image Handling

### 5.1 Current State

Images are embedded as base64 data URLs directly in content.

**Problems:**
- 1MB image → 1.37MB in base64 (33% overhead)
- Documents become huge
- Every version stores full image
- Slow to save, load, parse

### 5.2 Recommended Strategy: Hybrid

```typescript
function processImage(base64: string): string {
  const sizeKB = (base64.length * 3/4) / 1024;

  if (sizeKB < 50) {
    return base64;  // Keep inline (small images)
  }

  // Extract large images to .midlight/images/
  const hash = crypto.createHash('sha256')
    .update(base64)
    .digest('hex')
    .slice(0, 16);

  const filename = `${hash}.${ext}`;
  // Save to .midlight/images/{filename}
  return `/.midlight/images/${filename}`;
}
```

**Benefits:**
- Small images remain portable
- Large images efficiently stored
- Deduplication by hash
- Version history doesn't bloat

---

## 6. Crash Recovery

### 6.1 Write-Ahead Log (WAL)

```
.midlight/recovery/
└── document.md.wal  (saved every 100ms)
```

**Implementation:**
1. On every keystroke (throttled to 100ms): Write to WAL file
2. On successful save: Delete WAL file
3. On app startup: Check for WAL files, prompt recovery

**Recovery UI:**
```
┌─────────────────────────────────────────────────────┐
│  Recover Unsaved Changes?                           │
│                                                     │
│  Midlight found unsaved changes to "document.md"    │
│  from your last session.                            │
│                                                     │
│  [Recover Changes]  [Discard]  [Compare]            │
└─────────────────────────────────────────────────────┘
```

**Status:** Not yet implemented.

---

## 7. External Change Detection

### 7.1 The Problem

Files modified outside Midlight (by git, sync services, other editors) are silently overwritten on next save.

### 7.2 Solution: File Watching

```typescript
import chokidar from 'chokidar';

const watcher = chokidar.watch(rootDir, {
  ignored: /(^|[\/\\])\.midlight/,
  persistent: true,
  ignoreInitial: true,
  awaitWriteFinish: { stabilityThreshold: 300 }
});

watcher.on('change', (path) => {
  // Notify renderer of external change
  mainWindow.webContents.send('file-changed-externally', path);
});
```

**Conflict Resolution:**
- If `isDirty === false`: Auto-reload
- If `isDirty === true`: Prompt user

**Status:** Not yet implemented. Requires adding `chokidar` dependency.

---

## 8. Implementation Roadmap

### Phase 1: Foundation
- [x] Auto-save with debouncing
- [x] Session persistence
- [ ] Shadow directory versioning
- [ ] Crash recovery (WAL)
- [ ] File watching for external changes

### Phase 2: User Interface
- [ ] Version history panel/modal
- [ ] Diff view (side-by-side)
- [ ] Restore version functionality

### Phase 3: Polish
- [ ] Image optimization (hybrid storage)
- [ ] Named checkpoints (bookmarks)
- [ ] Version cleanup settings

### Phase 4: Advanced (Future)
- [ ] Drafts/branching
- [ ] Cloud sync
- [ ] AI-powered version features

---

## 9. Appendix: Technical Details

### A. File Structure Specification

```
workspace/
├── .midlight/
│   ├── config.json                 # Workspace settings
│   ├── history/
│   │   └── {filename}/
│   │       └── {timestamp}.md      # Version snapshots
│   ├── recovery/
│   │   └── {filename}.wal          # Crash recovery
│   └── images/
│       └── {hash}.{ext}            # Extracted images
├── document.md
└── ...
```

### B. Version File Naming

Format: `YYYY-MM-DDTHH-mm-ss-SSS.md`

Example: `2024-01-15T14-30-45-123.md`

- Sortable alphabetically
- No special characters (cross-platform)
- Milliseconds prevent collisions

### C. Config Schema

```json
{
  "version": 1,
  "history": {
    "enabled": true,
    "maxVersionsPerFile": 50,
    "maxAgeDays": 30,
    "minIntervalMs": 300000
  },
  "recovery": {
    "enabled": true,
    "intervalMs": 100
  },
  "fileWatching": {
    "enabled": true,
    "usePolling": false
  },
  "images": {
    "extractThresholdKB": 50
  }
}
```

### D. Checkpoint Structure

```typescript
interface Checkpoint {
  hash: string;              // Content hash (pointer to object)
  timestamp: string;         // ISO 8601
  parent: string | null;     // Previous checkpoint hash
  type: 'auto' | 'manual';   // How it was created
  label?: string;            // User-provided name
  wordCount: number;
  charCount: number;
  trigger?: string;          // What caused the checkpoint
}
```

### E. Dependencies to Add

```json
{
  "dependencies": {
    "chokidar": "^4.0.0",
    "diff": "^5.1.0"
  }
}
```

---

## Summary

**Current State:**
- Tiptap JSON storage with 1-second debounced auto-save
- Session persistence via localStorage
- No version history, crash recovery, or external change detection

**Strategic Direction:**
- Shadow directory versioning for MVP (simple, human-readable)
- "Checkpoints" and "Drafts" terminology for users
- Hybrid image storage (small inline, large extracted)
- WAL for crash recovery

**Key Trade-offs:**
- Chose Tiptap JSON over Markdown for fidelity
- Shadow directory over SQLite/Git-like for simplicity
- Will add complexity (SQLite, CRDTs) only when needed

---

*Document created: 2025-12-12*
*Consolidates: File_Saving_and_Version_Control.md, Git_Like_Versioning_Design.md, Markdown_Storage_Strategy.md, Strategy_File_Handling.md, Version_Control_Planning.md*
