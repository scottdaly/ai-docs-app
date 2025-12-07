<!-- @mid:h-3r5a3x -->
# File Saving & Version Control: Current Architecture Analysis

<!-- @mid:p-kmxgq2 -->
This document provides a comprehensive analysis of Midlight's current approach to file persistence, saving mechanisms, and version control (or lack thereof). It serves as a foundation for planning future enhancements.

---

<!-- @mid:h-mh8n3v -->
## 1. Executive Summary

<!-- @mid:p-vw7a5a -->
**Current State:** Midlight implements a simple, local-first file persistence model with:

<!-- @mid:list-1emzig -->
- Automatic debounced saving (1-second delay)
- Markdown storage with embedded HTML for rich formatting
- Session persistence via localStorage
- No version control, backup, or undo history persistence

<!-- @mid:p-jbv0mx -->
**Key Gaps Identified:**

<!-- @mid:list-rdb63v -->
- No file versioning or history
- No backup/recovery mechanisms
- No conflict detection for external file changes
- No undo/redo persistence across sessions
- Images embedded as base64 (large file sizes)

---

<!-- @mid:h-nlvk9u -->
## 2. Current File System Architecture

<!-- @mid:h-ujjjdo -->
### 2.1 Storage Model: Local-First Markdown

<!-- @mid:p-5k0wuo -->
Midlight stores documents as **Markdown files with embedded HTML tags** for rich formatting that Markdown doesn't natively support.

<!-- @mid:p-spu0f8 -->
**Example saved file:**

<!-- @mid:code-q1eioy -->
```markdown
# My Document

This is **bold** and *italic* text.

<span style="color: #ff0000">Red colored text</span>

<mark style="background-color: #ffff00">Highlighted text</mark>

<u>Underlined text</u>

![](data:image/png;base64,iVBORw0KGgo...)
```

<!-- @mid:p-pj9yol -->
**File Location:** `/src/utils/markdown.ts`

<!-- @mid:list-465wb8 -->
- `htmlToMarkdown()` - Converts Tiptap HTML to Markdown for storage
- `markdownToHtml()` - Converts Markdown back to HTML for editing

<!-- @mid:p-zfjpda -->
**Why this approach:**

<!-- @mid:list-ppsm4g -->
- Human-readable files
- Compatible with other Markdown editors
- Preserves rich formatting via HTML tags
- No proprietary format lock-in

<!-- @mid:h-t3pq6d -->
### 2.2 File System Store

<!-- @mid:p-da0ukj -->
**File:** `/src/store/useFileSystem.ts`

<!-- @mid:p-c6qbuz -->
The Zustand store manages all file operations:

<!-- @mid:code-3shuc0 -->
```typescript
interface FileSystemState {
  rootDir: string | null;           // Current workspace root
  files: FileNode[];                // File tree structure
  openFiles: FileNode[];            // Open tabs
  activeFilePath: string | null;    // Currently editing file
  fileContent: string;              // Current file's content
  isDirty: boolean;                 // Has unsaved changes
}
```

<!-- @mid:p-vy727m -->
**Key Operations:**

<!-- @mid:p-j0brzz -->
| Method | Purpose | Location |
|--------|---------|----------|
| `loadDir(path)` | Load workspace directory | Line 58-71 |
| `openFile(file)` | Open file in editor | Line 85-108 |
| `saveFile(content)` | Write to disk | Line 143-153 |
| `createFile(name, content)` | Create new file | Line 155-211 |
| `restoreSession()` | Recover on app startup | Line 213-234 |

<!-- @mid:h-18n3c6 -->
### 2.3 IPC Communication Layer

<!-- @mid:p-pzaylr -->
**File:** `/electron/main.ts` (Lines 196-349)

<!-- @mid:p-i43h85 -->
The Electron main process handles all file system operations:

<!-- @mid:p-0e2ufb -->
| IPC Handler | Function | Security |
|-------------|----------|----------|
| `read-file` | Read file as UTF-8 | Direct fs access |
| `write-file` | Write UTF-8 content | Direct fs access |
| `read-dir` | List directory contents | Returns metadata |
| `create-folder` | Create directories | Recursive mkdir |
| `delete-file` | Permanently delete | **No trash** |

<!-- @mid:p-dpq62l -->
**Preload Bridge:** `/electron/preload.ts`

<!-- @mid:list-tyksqa -->
- Exposes `window.electronAPI` to renderer
- All operations are promise-based

---

<!-- @mid:h-yratbb -->
## 3. Auto-Save Implementation

<!-- @mid:h-cpcptj -->
### 3.1 Debounced Saving

<!-- @mid:p-c85ozk -->
**File:** `/src/components/Editor.tsx` (Lines 122-145)

<!-- @mid:code-ztoh5f -->
```typescript
onUpdate: ({ editor }) => {
  setIsDirty(true);

  if (saveTimeoutRef.current) {
    clearTimeout(saveTimeoutRef.current);
  }

  saveTimeoutRef.current = setTimeout(() => {
    const html = editor.getHTML();
    const markdown = htmlToMarkdown(html);
    saveFile(markdown);
  }, 1000);  // 1 second debounce
}
```

<!-- @mid:p-lhhs9y -->
**How it works:**

<!-- @mid:list-6u001w -->
1. User types → `onUpdate` fires
2. `isDirty` flag set to `true` immediately
3. Previous save timer cancelled (if any)
4. New 1-second timer started
5. After 1 second of inactivity:
 - Editor HTML extracted
 - Converted to Markdown
 - Written to disk
 - `isDirty` cleared

<!-- @mid:p-9umtrj -->
**Characteristics:**

<!-- @mid:list-slptwy -->
- Save frequency: Maximum once per second
- User feedback: None (silent save)
- Error handling: Console log only
- Network: None (local only)

<!-- @mid:h-uaglmm -->
### 3.2 Save Flow Diagram

<!-- @mid:code-0hynhb -->
```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────┐
│  User Types │ ──► │  onUpdate()  │ ──► │  Debounce   │ ──► │  Save    │
│  in Editor  │     │  setIsDirty  │     │  (1000ms)   │     │  File    │
└─────────────┘     └──────────────┘     └─────────────┘     └──────────┘
                                                                   │
                    ┌──────────────┐     ┌─────────────┐           │
                    │ writeFile()  │ ◄── │ htmlToMd()  │ ◄─────────┘
                    │  IPC Call    │     │  Convert    │
                    └──────────────┘     └─────────────┘
```

---

<!-- @mid:h-lpl1xc -->
## 4. Session Persistence

<!-- @mid:h-pz1pm0 -->
### 4.1 What's Persisted

<!-- @mid:p-phb5z6 -->
**Storage:** localStorage via Zustand persist middleware

<!-- @mid:p-o617hd -->
**File:** `/src/store/useFileSystem.ts` (Lines 236-243)

<!-- @mid:code-9e6a6v -->
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

<!-- @mid:p-fmhrpu -->
**Persisted State:**
| Field | Purpose |
|-------|---------|
| `rootDir` | Last opened workspace path |
| `openFiles` | Array of open file tabs |
| `activeFilePath` | Currently focused file |

<!-- @mid:p-g195nw -->
**NOT Persisted:**

<!-- @mid:list-n6cbiy -->
- `files` (file tree - reloaded on startup)
- `fileContent` (reloaded from disk)
- `isDirty` (reset to false)
- Editor undo/redo history

<!-- @mid:h-krydk7 -->
### 4.2 Session Restoration

<!-- @mid:p-p2b215 -->
**On App Launch:** `/src/store/useFileSystem.ts` (Lines 213-234)

<!-- @mid:code-x83wyc -->
```typescript
restoreSession: async () => {
  const { rootDir, activeFilePath } = get();

  if (rootDir) {
    try {
      await get().loadDir(rootDir);  // Reload file tree
    } catch (e) {
      set({ rootDir: null, files: [] });  // Reset if invalid
    }
  }

  if (activeFilePath) {
    try {
      const content = await window.electronAPI.readFile(activeFilePath);
      set({ fileContent: content });
    } catch (e) {
      set({ activeFilePath: null, fileContent: '' });
    }
  }
}
```

<!-- @mid:p-mimgmo -->
**Recovery Behavior:**

<!-- @mid:list-u9jhqg -->
- Workspace directory: Reloads if still exists
- Open files: Paths remembered, content reloaded
- Active file: Restored to last position
- **No crash recovery** for unsaved changes

---

<!-- @mid:h-1z5ep3 -->
## 5. What's Missing: Version Control & History

<!-- @mid:h-vrfe83 -->
### 5.1 No Version History

<!-- @mid:p-v40bzl -->
**Current State:** Every save **overwrites** the previous content. There is no way to:

<!-- @mid:list-7fxhui -->
- View previous versions of a document
- Revert to an earlier state
- Compare changes over time
- Recover accidentally deleted content

<!-- @mid:p-vkpjd8 -->
**Risk:** User loses content with no recovery option.

<!-- @mid:h-m1i1jg -->
### 5.2 No Undo/Redo Persistence

<!-- @mid:p-wzzcfa -->
**Current State:** Tiptap maintains undo/redo history in memory, but:

<!-- @mid:list-r40mex -->
- History lost on file switch
- History lost on app restart
- History lost on tab close

<!-- @mid:p-usz57l -->
**Impact:** Users cannot undo changes after reopening a file.

<!-- @mid:h-wfk31t -->
### 5.3 No External Change Detection

<!-- @mid:p-nmtedo -->
**Current State:** If a file is modified outside of Midlight (e.g., by another editor, git, or sync service):

<!-- @mid:list-erfh1a -->
- App does **not** detect the change
- App does **not** reload the file
- Next save **overwrites** external changes

<!-- @mid:p-tgguxh -->
**Risk:** Data loss when files are edited externally or synced.

<!-- @mid:h-dva6sc -->
### 5.4 No Backup System

<!-- @mid:p-a05ug8 -->
**Current State:** No automatic backups are created. If a file is corrupted or the app crashes mid-save, there's no recovery mechanism.

<!-- @mid:h-6yp0go -->
### 5.5 Large File Sizes (Base64 Images)

<!-- @mid:p-s3sjay -->
**Current State:** Images are embedded as base64 data URLs directly in the Markdown content.

<!-- @mid:p-72fm2d -->
**Problems:**

<!-- @mid:list-0oxb0t -->
- A 1MB image becomes ~1.37MB in base64
- Files with many images become very large
- Slow to save, load, and parse
- Duplicated if same image used multiple times

---

<!-- @mid:h-n2txrj -->
## 6. Identified Gaps for Implementation

<!-- @mid:h-byhlne -->
### Priority 1: Critical Safety

<!-- @mid:list-xsazb3 -->
1. **Auto-backup on save** - Keep last N versions
2. **Crash recovery** - Recover unsaved changes
3. **External change detection** - Watch for file modifications

<!-- @mid:h-cbw21c -->
### Priority 2: User Experience

<!-- @mid:list-unsjjk -->
1. **Version history UI** - Browse and restore previous versions
2. **Diff view** - Compare versions
3. **Persistent undo/redo** - Maintain history across sessions

<!-- @mid:h-xvufs3 -->
### Priority 3: Performance

<!-- @mid:list-ehwfxs -->
1. **Image optimization** - Store images separately, reference by path
2. **Lazy loading** - Load large files in chunks
3. **Background saving** - Non-blocking save operations

<!-- @mid:h-4xc45q -->
### Priority 4: Collaboration Readiness

<!-- @mid:list-vqo67d -->
1. **Conflict resolution** - Handle concurrent edits
2. **Change tracking** - Who changed what, when
3. **Merge capabilities** - Combine divergent versions

---

<!-- @mid:h-zz7lal -->
## 7. Comparison with Similar Apps

<!-- @mid:p-fithbu -->
| Feature | Midlight (Current) | Obsidian | Notion | VS Code |
|---------|-------------------|----------|--------|---------|
| Auto-save | Yes (1s debounce) | Yes | Yes | Configurable |
| Version history | No | Sync only | Yes | Git integration |
| Local backup | No | Plugin | N/A | No |
| External change detection | No | Yes | N/A | Yes |
| Undo persistence | No | No | Yes | No |
| File format | Markdown+HTML | Markdown | Proprietary | Any |

---

<!-- @mid:h-1jfyri -->
## 8. Technical Considerations for Implementation

<!-- @mid:h-hev74s -->
### 8.1 Version Storage Options

<!-- @mid:p-9tcmy0 -->
**Option A: Shadow Directory**

<!-- @mid:code-14kdql -->
```
workspace/
├── .midlight/
│   └── versions/
│       └── document.md/
│           ├── 2024-01-15T10-30-00.md
│           ├── 2024-01-15T11-45-00.md
│           └── latest.md
└── document.md
```

<!-- @mid:p-u3u26z -->
**Option B: Git-like Object Store**

<!-- @mid:code-4lfgm1 -->
```
workspace/
├── .midlight/
│   ├── objects/
│   │   ├── ab/
│   │   │   └── cdef123...  (content blob)
│   │   └── 12/
│   │       └── 3456789...  (content blob)
│   └── refs/
│       └── document.md.json  (version pointers)
└── document.md
```

<!-- @mid:p-cmewke -->
**Option C: SQLite Database**

<!-- @mid:code-nfain0 -->
```
workspace/
├── .midlight/
│   └── history.db  (contains all versions)
└── document.md
```

<!-- @mid:h-srd72c -->
### 8.2 File Watching

<!-- @mid:p-befwee -->
**Recommended:** Use `chokidar` (already in Electron ecosystem)

<!-- @mid:code-88q3gm -->
```typescript
import chokidar from 'chokidar';

const watcher = chokidar.watch(rootDir, {
  ignored: /(^|[\/\\])\.midlight/,  // Ignore version directory
  persistent: true,
  ignoreInitial: true
});

watcher.on('change', (path) => {
  // File modified externally
  notifyRenderer('file-changed', path);
});
```

<!-- @mid:h-ncr7x1 -->
### 8.3 Diff Algorithm

<!-- @mid:p-imj55k -->
**Recommended:** Use `diff` or `jsdiff` library for text comparison

<!-- @mid:code-tthwjy -->
```typescript
import { diffLines } from 'diff';

const changes = diffLines(oldContent, newContent);
// Returns array of { added, removed, value } objects
```

---

<!-- @mid:h-p807fo -->
## 9. Next Steps

<!-- @mid:list-p2on1n -->
1. **Decide on version storage approach** (Shadow dir vs. SQLite vs. Git-like)
2. **Implement file watching** for external change detection
3. **Design version history UI** (sidebar panel or modal)
4. **Build backup rotation logic** (keep last N versions)
5. **Add crash recovery** (temp file on each change, clean on successful save)

---

<!-- @mid:h-lo3i0e -->
## Appendix A: Current File Operation Flow

<!-- @mid:code-ac2xyi -->
```
┌─────────────────────────────────────────────────────────────────────┐
│                         RENDERER PROCESS                            │
│                                                                     │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────────┐ │
│  │   Editor    │───►│  Zustand    │───►│  window.electronAPI     │ │
│  │  (Tiptap)   │    │   Store     │    │  (Preload Bridge)       │ │
│  └─────────────┘    └─────────────┘    └───────────┬─────────────┘ │
│                                                     │               │
└─────────────────────────────────────────────────────┼───────────────┘
                                                      │ IPC
┌─────────────────────────────────────────────────────┼───────────────┐
│                          MAIN PROCESS               │               │
│                                                     ▼               │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                     IPC Handlers                             │   │
│  │  read-file | write-file | read-dir | delete-file | etc.     │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                     Node.js fs module                        │   │
│  │                   (Direct file system access)                │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

<!-- @mid:h-6iz79r -->
## Appendix B: Key File References

<!-- @mid:p-osvox0 -->
| Component | File Path | Key Lines |
|-----------|-----------|-----------|
| Auto-save logic | `src/components/Editor.tsx` | 122-145 |
| File store | `src/store/useFileSystem.ts` | 43-245 |
| IPC handlers | `electron/main.ts` | 196-349 |
| Preload bridge | `electron/preload.ts` | All |
| Markdown conversion | `src/utils/markdown.ts` | 67-79 |
| Session persistence | `src/store/useFileSystem.ts` | 236-243 |

---

<!-- @mid:p-exf1y7 -->
*Document created: 2025-12-05*
*Status: Analysis complete, ready for implementation planning*