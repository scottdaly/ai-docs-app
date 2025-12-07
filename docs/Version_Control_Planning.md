<!-- @mid:h-ywi7x9 -->
# Version Control & File Saving: Implementation Planning

<!-- @mid:p-muily3 -->
This document explores different approaches to implementing version control and enhanced file saving in Midlight. It weighs the pros and cons of each approach, considers implementation complexity, and provides recommendations.

---

<!-- @mid:h-sx3kq1 -->
## Table of Contents

<!-- @mid:list-9ko81v -->
1. Problem Statement
2. Design Goals & Constraints
3. Storage Architecture Options
4. External Change Detection
5. Undo/Redo Persistence
6. Version History UI Patterns
7. Image Storage Strategy
8. Crash Recovery
9. Recommended Implementation Path
10. Technical Appendix

---

<!-- @mid:h-f7dzpn -->
## 1. Problem Statement

<!-- @mid:h-ti9z5l -->
### Current Pain Points

<!-- @mid:list-xz46x9 -->
1. **Data Loss Risk**: Every save overwrites previous content with no recovery option
2. **No History**: Users cannot view, compare, or restore previous versions
3. **External Changes Lost**: Files modified outside the app (by git, sync services, other editors) are silently overwritten
4. **Session Amnesia**: Undo/redo history lost when switching files or restarting
5. **Large File Sizes**: Base64-embedded images bloat documents
6. **No Crash Recovery**: Unsaved work lost if app crashes

<!-- @mid:h-epr9f1 -->
### User Stories

<!-- @mid:bq-zjhfc5 -->
> "I accidentally deleted three paragraphs and saved. I need to get them back."

<!-- @mid:bq-lkr3lv -->
> "I want to see what this document looked like last week."

<!-- @mid:bq-njf4ds -->
> "I edited this file in VS Code, but Midlight overwrote my changes."

<!-- @mid:bq-b2ptmf -->
> "The app crashed and I lost 30 minutes of work."

---

<!-- @mid:h-7q2lyj -->
## 2. Design Goals & Constraints

<!-- @mid:h-08dzb1 -->
### Must Have

<!-- @mid:list-zx8t4n -->
- **Local-first**: All data stays on user's machine (no cloud dependency)
- **Non-destructive**: Previous versions recoverable
- **Transparent**: Users don't need to "commit" or manually save versions
- **Performant**: No noticeable lag on save operations
- **Portable**: Workspace folders remain usable by other tools

<!-- @mid:h-y40nmz -->
### Nice to Have

<!-- @mid:list-nubmyp -->
- **Diff view**: Visual comparison between versions
- **Branching**: Experimental edits without affecting main document
- **Collaboration-ready**: Architecture that could support sync later

<!-- @mid:h-43erq8 -->
### Constraints

<!-- @mid:list-t6wtfy -->
- **File format**: Must remain human-readable Markdown
- **No server**: Cannot rely on external services
- **Disk space**: Version history should have reasonable limits
- **Complexity**: MVP should be achievable in reasonable time

---

<!-- @mid:h-5hxh40 -->
## 3. Storage Architecture Options

<!-- @mid:h-mk75o5 -->
### Option A: Shadow Directory (Timestamped Files)

<!-- @mid:p-b3g7n8 -->
Store previous versions as separate files in a hidden directory.

<!-- @mid:code-x6a145 -->
```
workspace/
├── .midlight/
│   └── history/
│       └── document.md/
│           ├── 2024-01-15T10-30-00.md      (full snapshot)
│           ├── 2024-01-15T11-45-00.md      (full snapshot)
│           └── 2024-01-15T14-20-00.md      (full snapshot)
├── document.md                              (current version)
└── notes.md
```

<!-- @mid:p-ktf3op -->
**How it works:**

<!-- @mid:list-q78vbo -->
- On each save (or on interval), copy current file to history folder
- Filename is ISO timestamp for easy sorting
- Cleanup job removes versions older than N days or keeps last N versions

<!-- @mid:p-bs71r9 -->
**Pros:**
| Advantage | Details |
|-----------|---------|
| Simple to implement | Just copy files on save |
| Human-readable | Users can manually browse/recover |
| No dependencies | Uses only Node.js fs module |
| Git-friendly | Can .gitignore the .midlight folder |
| Portable | Workspace works without Midlight |

<!-- @mid:p-0n9jlb -->
**Cons:**
| Disadvantage | Details |
|--------------|---------|
| Disk space | Full copy each version (no deduplication) |
| No efficient diff | Must load two full files to compare |
| Metadata limited | Only timestamp, no commit messages |
| Large files slow | Copying multi-MB files repeatedly |

<!-- @mid:p-g0046u -->
**Disk Space Estimate:**

<!-- @mid:list-9hbhyi -->
- 10KB document, 50 versions = 500KB
- 1MB document (with images), 50 versions = 50MB

<!-- @mid:p-cx7iag -->
**Best for:** Simple implementation, small documents, quick MVP

---

<!-- @mid:h-1b6mdt -->
### Option B: SQLite Database

<!-- @mid:p-vzk507 -->
Store versions in a SQLite database with metadata.

<!-- @mid:code-p00tns -->
```
workspace/
├── .midlight/
│   └── history.db
├── document.md
└── notes.md
```

<!-- @mid:p-qofp30 -->
**Schema:**

<!-- @mid:code-zhneyr -->
```sql
CREATE TABLE versions (
    id INTEGER PRIMARY KEY,
    file_path TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    byte_size INTEGER,
    word_count INTEGER,
    is_auto_save BOOLEAN DEFAULT TRUE,
    label TEXT  -- Optional user-provided name
);

CREATE INDEX idx_file_path ON versions(file_path);
CREATE INDEX idx_created_at ON versions(created_at);
```

<!-- @mid:p-1pxckw -->
**Pros:**
| Advantage | Details |
|-----------|---------|
| Efficient queries | Fast lookup by file/date |
| Metadata rich | Store word count, labels, etc. |
| Single file | One .db file vs many version files |
| Compression | SQLite can compress text |
| Transactional | ACID guarantees on writes |

<!-- @mid:p-anduy9 -->
**Cons:**
| Disadvantage | Details |
|--------------|---------|
| Native module | Requires electron-rebuild for better-sqlite3 |
| Not human-readable | Can't manually browse versions |
| Binary format | Corruption harder to recover |
| Build complexity | Native modules complicate packaging |
| Migration needed | Schema changes require migrations |

<!-- @mid:p-4wfgrr -->
**Implementation Notes:**

<!-- @mid:list-rbo0l5 -->
- Use `better-sqlite3` (synchronous, faster) over `sqlite3` (async)
- Store in `app.getPath('userData')` for production
- Run in main process only (security best practice)
- Use IPC for renderer communication

<!-- @mid:p-7wephw -->
**Best for:** Rich metadata, efficient storage, complex queries

---

<!-- @mid:h-69yngo -->
### Option C: Git-Like Content-Addressable Store

<!-- @mid:p-2y75mt -->
Store content by hash, with references tracking versions.

<!-- @mid:code-dl1hij -->
```
workspace/
├── .midlight/
│   ├── objects/
│   │   ├── ab/
│   │   │   └── cdef1234567890...  (content blob, gzipped)
│   │   └── 12/
│   │       └── 34567890abcdef...  (content blob, gzipped)
│   └── refs/
│       ├── document.md.json       (version history)
│       └── notes.md.json          (version history)
├── document.md
└── notes.md
```

<!-- @mid:p-787wmj -->
**refs/document.md.json:**

<!-- @mid:code-kxlvq4 -->
```json
{
  "versions": [
    {
      "hash": "abcdef1234567890...",
      "timestamp": "2024-01-15T10:30:00Z",
      "parent": null,
      "size": 10234
    },
    {
      "hash": "1234567890abcdef...",
      "timestamp": "2024-01-15T11:45:00Z",
      "parent": "abcdef1234567890...",
      "size": 10456
    }
  ]
}
```

<!-- @mid:p-61g6k9 -->
**Pros:**
| Advantage | Details |
|-----------|---------|
| Deduplication | Identical content stored once |
| Efficient diffs | Can compute delta between hashes |
| Branching ready | Parent pointers enable branches |
| Compressed | gzip blobs reduce size |
| Integrity | Hash verifies content not corrupted |

<!-- @mid:p-ws5dq5 -->
**Cons:**
| Disadvantage | Details |
|--------------|---------|
| Complex | Most implementation effort |
| Not human-readable | Hashed blobs need tooling |
| Garbage collection | Need to clean orphaned objects |
| Overkill? | Full git exists if users want it |

<!-- @mid:p-9e9952 -->
**Best for:** Future collaboration, branching workflows, large workspaces

---

<!-- @mid:h-v6tzrp -->
### Option D: CRDT-Based (Automerge/Yjs)

<!-- @mid:p-rjm7y4 -->
Use Conflict-free Replicated Data Types for automatic versioning.

<!-- @mid:p-mxgh99 -->
**How it works:**

<!-- @mid:list-uujm9r -->
- Document stored as a CRDT, not plain text
- Every keystroke is an "operation" in the CRDT
- Full history embedded in the data structure
- Can "time travel" to any point

<!-- @mid:p-9d2cjk -->
**Pros:**
| Advantage | Details |
|-----------|---------|
| Infinite undo | Every operation preserved |
| Collaboration-ready | CRDTs merge automatically |
| Time travel | Scrub through entire history |
| No conflicts | Concurrent edits merge cleanly |

<!-- @mid:p-nxqn2j -->
**Cons:**
| Disadvantage | Details |
|--------------|---------|
| File format change | Not plain Markdown anymore |
| Storage overhead | CRDT metadata significant |
| Learning curve | Complex concepts (operations, etc.) |
| Library dependency | Tied to Automerge/Yjs ecosystem |
| Migration required | Existing files need conversion |

<!-- @mid:p-7w8emv -->
**Automerge vs Yjs:**
| Factor | Automerge | Yjs |
|--------|-----------|-----|
| Performance | Good (Rust core) | Excellent |
| Bundle size | ~200KB (WASM) | ~30KB |
| Rich text | Limited | Y.XmlFragment |
| Documentation | Moderate | Good |
| Tiptap integration | Community | Official (y-prosemirror) |

<!-- @mid:p-2w7wug -->
**Best for:** Real-time collaboration, infinite history, future-proofing

---

<!-- @mid:h-kbn5t6 -->
### Comparison Matrix

<!-- @mid:p-5rx0uq -->
| Factor | Shadow Dir | SQLite | Git-Like | CRDT |
|--------|------------|--------|----------|------|
| Implementation effort | Low | Medium | High | High |
| Human-readable | Yes | No | No | No |
| Disk efficiency | Poor | Good | Excellent | Moderate |
| Query capability | None | Excellent | Good | Limited |
| Diff support | Load both | Load both | Native | Native |
| Branching | No | Manual | Yes | Yes |
| Collaboration-ready | No | No | Partial | Yes |
| Native modules | No | Yes | No | Partial |
| File format change | No | No | No | Yes |

---

<!-- @mid:h-v772vx -->
## 4. External Change Detection

<!-- @mid:h-tjykng -->
### The Problem

<!-- @mid:p-va0iho -->
When a file is modified outside Midlight (by git, sync services, other editors), the app doesn't notice. The next auto-save overwrites those changes.

<!-- @mid:h-u1f8pt -->
### Solution: File Watching with Chokidar

<!-- @mid:p-w5u88f -->
**Implementation location:** Electron main process

<!-- @mid:code-5famhj -->
```typescript
import chokidar from 'chokidar';

class FileWatcher {
  private watcher: chokidar.FSWatcher | null = null;
  private ignoreNextChange: Set<string> = new Set();

  watch(rootDir: string) {
    this.watcher = chokidar.watch(rootDir, {
      ignored: /(^|[\/\\])\.midlight/,  // Ignore version history
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {               // Wait for large files
        stabilityThreshold: 300,
        pollInterval: 100
      },
      atomic: true                       // Handle atomic writes
    });

    this.watcher.on('change', (path) => {
      if (this.ignoreNextChange.has(path)) {
        this.ignoreNextChange.delete(path);
        return;
      }
      // Notify renderer of external change
      mainWindow.webContents.send('file-changed-externally', path);
    });
  }

  // Call before our own writes to prevent false positives
  ignoreNext(path: string) {
    this.ignoreNextChange.add(path);
  }
}
```

<!-- @mid:h-1rnded -->
### Conflict Resolution Strategies

<!-- @mid:p-74u4uf -->
**Option 1: Prompt User (Recommended for MVP)**

<!-- @mid:code-h1cute -->
```
┌─────────────────────────────────────────────────────┐
│  File Changed Externally                            │
│                                                     │
│  "document.md" was modified outside of Midlight.    │
│                                                     │
│  What would you like to do?                         │
│                                                     │
│  [Reload from Disk]  [Keep My Version]  [Compare]   │
└─────────────────────────────────────────────────────┘
```

<!-- @mid:p-c3mp72 -->
**Option 2: Auto-reload if no local changes**

<!-- @mid:list-lvv1dq -->
- If `isDirty === false`, silently reload
- If `isDirty === true`, prompt user

<!-- @mid:p-c1r9yd -->
**Option 3: Create conflict file**

<!-- @mid:list-45690l -->
- Save user's version as `document (Midlight).md`
- Reload external version
- User merges manually

<!-- @mid:h-xz3tzs -->
### Important Considerations

<!-- @mid:list-5nahid -->
1. **Ignore our own writes**: Mark paths before writing to avoid false change events
2. **Debounce**: External editors may trigger multiple events
3. **ASAR packaging**: On macOS, ensure `fsevents` is unpacked for native watching
4. **Network drives**: May need polling mode (`usePolling: true`)

---

<!-- @mid:h-i7sz9z -->
## 5. Undo/Redo Persistence

<!-- @mid:h-homvcq -->
### Current State

<!-- @mid:p-o0w73w -->
Tiptap uses ProseMirror's built-in history plugin:

<!-- @mid:list-qld93f -->
- Undo/redo stored in memory
- Lost on file switch, tab close, or app restart

<!-- @mid:h-t3qfvf -->
### Approaches to Persistence

<!-- @mid:h-ihwicu -->
#### Approach A: Persist Operation Log

<!-- @mid:p-2kq7tf -->
Store the undo/redo stack alongside the document.

<!-- @mid:code-83hhek -->
```typescript
interface PersistedHistory {
  filePath: string;
  undoStack: Operation[];
  redoStack: Operation[];
  lastSavedAt: string;
}
```

<!-- @mid:p-apldbb -->
**Pros:**

<!-- @mid:list-cihv4z -->
- True persistence of exact undo/redo state
- Can undo across sessions

<!-- @mid:p-x5dnsn -->
**Cons:**

<!-- @mid:list-25zzk7 -->
- Complex: Must serialize ProseMirror transactions
- Fragile: Document structure changes break history
- Storage: Operation logs can be large

<!-- @mid:h-b5bm5p -->
#### Approach B: Version-Based "Undo" (Recommended)

<!-- @mid:p-xflhv8 -->
Don't persist true undo—instead, use version history as a form of "macro undo."

<!-- @mid:p-16amk2 -->
**User Flow:**

<!-- @mid:list-jo3vch -->
1. User makes changes throughout the day
2. Versions saved automatically every 5 minutes (or on significant changes)
3. User realizes mistake from earlier
4. Opens version history, picks previous version
5. Restores or cherry-picks content

<!-- @mid:p-o78gcg -->
**Pros:**

<!-- @mid:list-pl7t2z -->
- Simpler implementation
- Uses existing version history infrastructure
- More intuitive for large-scale reverts

<!-- @mid:p-8ddcy6 -->
**Cons:**

<!-- @mid:list-2gct9y -->
- Loses granular undo (individual keystrokes)
- User must explicitly restore

<!-- @mid:h-eryj8d -->
#### Approach C: Hybrid

<!-- @mid:list-937n51 -->
- **Session undo**: Keep Tiptap's in-memory history for current session
- **Cross-session undo**: Version history for restoring older states

<!-- @mid:p-5ylxpb -->
**Implementation:**

<!-- @mid:code-hzpx7g -->
```typescript
// On file open, clear in-memory history
editor.commands.clearHistory();

// On file close, don't persist operation log
// But version history already has snapshots

// On app restart, user can restore from version history
```

<!-- @mid:h-6troq5 -->
### Recommendation

<!-- @mid:p-ckub5d -->
**Start with Approach C (Hybrid)**:

<!-- @mid:list-ga1luw -->
- Don't try to persist the operation log (complex, fragile)
- Rely on version history for "undo across sessions"
- Keep Tiptap's in-memory history for "undo within session"

---

<!-- @mid:h-g2ffkp -->
## 6. Version History UI Patterns

<!-- @mid:h-0dk70w -->
### Pattern A: Right Sidebar Panel

<!-- @mid:p-wxvdxy -->
Like Figma's version history. Opens alongside the editor.

<!-- @mid:code-aog3on -->
```
┌───────────────────────────────────────────────────────────────┐
│  [Sidebar]  │        Editor                    │  History     │
│             │                                  │              │
│  Files      │  # My Document                   │  ▼ Today     │
│  ├── doc.md │                                  │    2:30 PM   │
│  └── ...    │  Lorem ipsum dolor sit amet...   │    1:15 PM   │
│             │                                  │    11:00 AM  │
│             │                                  │              │
│             │                                  │  ▼ Yesterday │
│             │                                  │    4:45 PM   │
│             │                                  │    ...       │
└───────────────────────────────────────────────────────────────┘
```

<!-- @mid:p-rdp13h -->
**Pros:**

<!-- @mid:list-uu7kw1 -->
- Always accessible
- Can browse while viewing document
- Familiar pattern (Figma, Google Docs)

<!-- @mid:p-vsg4o3 -->
**Cons:**

<!-- @mid:list-aqymq3 -->
- Takes horizontal space
- Might feel cramped on small screens

<!-- @mid:h-14lvac -->
### Pattern B: Modal Dialog

<!-- @mid:p-ewuuz4 -->
Full-screen or large modal with timeline and preview.

<!-- @mid:code-dr41it -->
```
┌─────────────────────────────────────────────────────────────────┐
│  Version History - document.md                           [X]    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐  ┌───────────────────────────────────────────┐│
│  │ Jan 15      │  │                                           ││
│  │             │  │  Preview of selected version              ││
│  │ • 2:30 PM ◄─┼──│                                           ││
│  │   1:15 PM   │  │  # My Document                            ││
│  │   11:00 AM  │  │                                           ││
│  │             │  │  Lorem ipsum dolor sit amet...            ││
│  │ Jan 14      │  │                                           ││
│  │   4:45 PM   │  │                                           ││
│  │   ...       │  │                                           ││
│  └─────────────┘  └───────────────────────────────────────────┘│
│                                                                 │
│                            [Restore This Version]  [Compare]    │
└─────────────────────────────────────────────────────────────────┘
```

<!-- @mid:p-je6o24 -->
**Pros:**

<!-- @mid:list-ggwh6n -->
- More space for preview
- Clear separation from editing
- Can show full diff view

<!-- @mid:p-qspke9 -->
**Cons:**

<!-- @mid:list-9k75jw -->
- Interrupts workflow (modal)
- Can't edit while browsing history

<!-- @mid:h-2lvnz1 -->
### Pattern C: Timeline Scrubber

<!-- @mid:p-3bam8c -->
Slider at bottom of editor to "time travel."

<!-- @mid:code-ujebsk -->
```
┌───────────────────────────────────────────────────────────────┐
│  [Sidebar]  │        Editor                                   │
│             │                                                 │
│  Files      │  # My Document                                  │
│             │                                                 │
│             │  Lorem ipsum dolor sit amet...                  │
│             │                                                 │
│             │                                                 │
│             ├─────────────────────────────────────────────────│
│             │  ◄──────────────●────────────────────────────►  │
│             │  Jan 14        Jan 15 2:30 PM              Now  │
└───────────────────────────────────────────────────────────────┘
```

<!-- @mid:p-4kzcqt -->
**Pros:**

<!-- @mid:list-yjuqzi -->
- Very intuitive "time travel" metaphor
- Non-intrusive (small UI)
- Fun to use

<!-- @mid:p-1oo59a -->
**Cons:**

<!-- @mid:list-7w3emg -->
- Limited metadata display
- Hard to select specific versions
- Complex to implement well

<!-- @mid:h-m1hrep -->
### Pattern D: Menu Access Only

<!-- @mid:p-3vid9w -->
No dedicated UI—access via File menu or right-click.

<!-- @mid:p-tgtkwf -->
**Pros:**

<!-- @mid:list-1iud47 -->
- Zero UI footprint
- Simple to implement

<!-- @mid:p-mg97i5 -->
**Cons:**

<!-- @mid:list-z9ydez -->
- Discoverable only by power users
- No browse/preview capability

<!-- @mid:h-bewans -->
### Recommendation

<!-- @mid:p-rp6vwq -->
**MVP: Pattern B (Modal Dialog)**

<!-- @mid:list-3gt7r1 -->
- Simpler to implement than sidebar
- Full preview space
- Can add diff view easily

<!-- @mid:p-pivaf4 -->
**Future: Pattern A (Sidebar)**

<!-- @mid:list-dbaolb -->
- Better UX for frequent use
- Add after validating feature usage

---

<!-- @mid:h-qbez4l -->
## 7. Image Storage Strategy

<!-- @mid:h-pxulb3 -->
### Current Problem

<!-- @mid:p-z2nzvc -->
Images embedded as base64:

<!-- @mid:code-odbole -->
```markdown
![](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA... [100KB+])
```

<!-- @mid:p-puuh0t -->
Issues:

<!-- @mid:list-45b7ux -->
- 1MB image → 1.37MB in base64 (33% overhead)
- Document becomes huge and slow to parse
- Duplicated if same image used multiple times
- Version history stores full image repeatedly

<!-- @mid:h-bxzq4p -->
### Strategy A: Keep Base64 (Current)

<!-- @mid:p-zpehne -->
**Pros:**

<!-- @mid:list-ijr8wu -->
- Single file, fully portable
- No broken image links
- Works with any Markdown viewer

<!-- @mid:p-4rqnwv -->
**Cons:**

<!-- @mid:list-ro9dqq -->
- Bloated file sizes
- Slow saving/loading
- Version history explosion

<!-- @mid:p-nxt771 -->
**Verdict:** Acceptable for MVP, but problematic at scale.

<!-- @mid:h-rg6uln -->
### Strategy B: Separate Image Directory

<!-- @mid:p-pupxfm -->
Store images as separate files, reference by relative path.

<!-- @mid:code-mlzg6u -->
```
workspace/
├── document.md
├── .midlight/
│   └── images/
│       ├── abc123.png    (hashed filename)
│       └── def456.jpg
└── ...
```

<!-- @mid:p-htzchh -->
**document.md:**

<!-- @mid:code-z70uh0 -->
```markdown
![](/.midlight/images/abc123.png)
```

<!-- @mid:p-yfbg17 -->
**Pros:**

<!-- @mid:list-nnmpkz -->
- Much smaller document files
- Images deduplicated by hash
- Version history efficient (only tracks text)

<!-- @mid:p-oqqv0o -->
**Cons:**

<!-- @mid:list-usivqf -->
- Broken images if folder moved
- Not compatible with standard Markdown viewers
- Must handle image cleanup (garbage collection)

<!-- @mid:h-fb1v3w -->
### Strategy C: Hybrid (Recommended)

<!-- @mid:list-sg9o3l -->
- **Small images (< 50KB)**: Keep as base64
- **Large images (≥ 50KB)**: Extract to .midlight/images/

<!-- @mid:p-g4g0f2 -->
**Implementation:**

<!-- @mid:code-59i9qc -->
```typescript
function processImage(base64: string): string {
  const sizeKB = (base64.length * 3/4) / 1024;

  if (sizeKB < 50) {
    return base64;  // Keep inline
  }

  const hash = crypto.createHash('sha256')
    .update(base64)
    .digest('hex')
    .slice(0, 16);

  const ext = detectImageType(base64);
  const filename = `${hash}.${ext}`;
  const imagePath = path.join(rootDir, '.midlight', 'images', filename);

  // Save to disk (if not already exists)
  if (!fs.existsSync(imagePath)) {
    fs.writeFileSync(imagePath, Buffer.from(base64, 'base64'));
  }

  return `/.midlight/images/${filename}`;
}
```

<!-- @mid:p-r9vqrf -->
**Pros:**

<!-- @mid:list-z15ghf -->
- Best of both worlds
- Small images remain portable
- Large images efficiently stored

<!-- @mid:p-ycmbk9 -->
**Cons:**

<!-- @mid:list-s3rgoi -->
- More complex implementation
- Still need garbage collection for deleted images

<!-- @mid:h-5us6xe -->
### Strategy D: Always External with Export Option

<!-- @mid:p-7i2cxm -->
Store all images externally, but provide "Export as Portable Document" option.

<!-- @mid:p-j3nz3o -->
**For export:**

<!-- @mid:list-fo0oey -->
- Re-embed all images as base64
- Create standalone document

<!-- @mid:p-8d13e1 -->
**Pros:**

<!-- @mid:list-zy611z -->
- Most efficient storage
- Clean separation
- Portable when needed

<!-- @mid:p-ebl9dn -->
**Cons:**

<!-- @mid:list-7m1gph -->
- Extra step for sharing
- Daily workflow uses non-portable format

---

<!-- @mid:h-jvv1db -->
## 8. Crash Recovery

<!-- @mid:h-y480zh -->
### The Problem

<!-- @mid:p-nku9cc -->
If the app crashes mid-edit, unsaved work is lost.

<!-- @mid:h-rnhj1m -->
### Solution: Write-Ahead Log (WAL)

<!-- @mid:p-cfiddu -->
Keep a temporary file that's updated more frequently than the main save.

<!-- @mid:code-dxvz82 -->
```
workspace/
├── document.md                     (saved every 1 second)
├── .midlight/
│   └── recovery/
│       └── document.md.wal         (saved every 100ms)
└── ...
```

<!-- @mid:p-asn8sc -->
**Implementation:**

<!-- @mid:code-qzau39 -->
```typescript
// On every keystroke (throttled to 100ms)
function writeRecoveryLog(content: string) {
  const walPath = getWalPath(activeFilePath);
  fs.writeFileSync(walPath, content);
}

// On successful save
function onSaveComplete() {
  const walPath = getWalPath(activeFilePath);
  if (fs.existsSync(walPath)) {
    fs.unlinkSync(walPath);  // Delete WAL
  }
}

// On app startup
function checkForRecovery() {
  const walFiles = glob.sync('.midlight/recovery/*.wal');

  for (const walPath of walFiles) {
    const originalPath = walPathToOriginal(walPath);
    const walContent = fs.readFileSync(walPath, 'utf8');
    const originalContent = fs.readFileSync(originalPath, 'utf8');

    if (walContent !== originalContent) {
      // Prompt user to recover
      promptRecovery(originalPath, walContent);
    }

    fs.unlinkSync(walPath);
  }
}
```

<!-- @mid:p-dee73h -->
**Recovery UI:**

<!-- @mid:code-qoct6o -->
```
┌─────────────────────────────────────────────────────┐
│  Recover Unsaved Changes?                           │
│                                                     │
│  Midlight found unsaved changes to "document.md"   │
│  from your last session.                            │
│                                                     │
│  [Recover Changes]  [Discard]  [Compare]            │
└─────────────────────────────────────────────────────┘
```

<!-- @mid:h-4o8tvq -->
### Alternative: Increase Auto-Save Frequency

<!-- @mid:p-zgq53o -->
Instead of WAL, simply auto-save more frequently:

<!-- @mid:list-9x9j58 -->
- Current: 1 second debounce
- Aggressive: 200ms debounce

<!-- @mid:p-txfbl8 -->
**Pros:**

<!-- @mid:list-3fybhs -->
- Simpler (no new system)
- Minimal data loss window

<!-- @mid:p-30cj58 -->
**Cons:**

<!-- @mid:list-z57rzr -->
- More disk writes
- May cause lag on slow disks
- Still loses ~200ms of work

<!-- @mid:h-a99x3x -->
### Recommendation

<!-- @mid:p-xm3v4d -->
**Implement WAL for MVP:**

<!-- @mid:list-clq47z -->
- Low implementation cost
- Significant user trust improvement
- Can disable on slow disks

---

<!-- @mid:h-mz0wpb -->
## 9. Recommended Implementation Path

<!-- @mid:h-f6wvr8 -->
### Phase 1: Foundation (Week 1-2)

<!-- @mid:p-j6z8vn -->
**Goal:** Basic version safety without UI

<!-- @mid:list-cnfage -->
1. **Shadow directory versioning**
 - Create `.midlight/history/{filename}/` structure
 - Save version on every "significant" save (5 min interval or content change > 100 chars)
 - Keep last 50 versions per file
 - Cleanup versions older than 30 days

<!-- @mid:list-4u9k4a -->
1. **Crash recovery (WAL)**
 - Write to `.midlight/recovery/` every 100ms
 - Check for recovery files on startup
 - Simple "Recover / Discard" dialog

<!-- @mid:list-49brln -->
1. **File watching**
 - Implement chokidar in main process
 - "File changed externally" notification
 - Simple reload/keep choice

<!-- @mid:h-jzyuxq -->
### Phase 2: User Interface (Week 3-4)

<!-- @mid:p-de594m -->
**Goal:** Users can browse and restore versions

<!-- @mid:list-ezylmf -->
1. **Version history modal**
 - List versions grouped by date
 - Preview selected version
 - "Restore" button

<!-- @mid:list-oy3g9x -->
1. **Diff view**
 - Side-by-side or inline diff
 - Highlight additions/deletions
 - Use `diff` library for comparison

<!-- @mid:h-ll94dv -->
### Phase 3: Polish (Week 5-6)

<!-- @mid:p-dtirwd -->
**Goal:** Production-ready experience

<!-- @mid:list-4djuvj -->
1. **Image optimization**
 - Extract large images to `.midlight/images/`
 - Deduplicate by hash
 - Garbage collection on app startup

<!-- @mid:list-2ew63l -->
1. **Version labels**
 - Let users name important versions
 - "Star" versions to prevent auto-cleanup

<!-- @mid:list-2f35q0 -->
1. **Settings**
 - Configure version retention
 - Enable/disable file watching
 - Recovery file location

<!-- @mid:h-p4nbae -->
### Future Considerations

<!-- @mid:list-ua6vgc -->
- **SQLite migration**: If version queries become slow
- **Git integration**: For users who want it
- **CRDT exploration**: For collaboration features

---

<!-- @mid:h-1gu2bf -->
## 10. Technical Appendix

<!-- @mid:h-pkw6ku -->
### A. File Structure Specification

<!-- @mid:code-k1rqo5 -->
```
workspace/
├── .midlight/
│   ├── config.json                 # Workspace settings
│   ├── history/
│   │   ├── {filename}/
│   │   │   ├── {timestamp}.md      # Version snapshots
│   │   │   └── ...
│   │   └── ...
│   ├── recovery/
│   │   └── {filename}.wal          # Crash recovery
│   └── images/
│       └── {hash}.{ext}            # Extracted images
├── document.md
└── ...
```

<!-- @mid:h-t01gam -->
### B. Version File Naming

<!-- @mid:p-5c6hzt -->
Format: `YYYY-MM-DDTHH-mm-ss-SSS.md`

<!-- @mid:p-75bfap -->
Example: `2024-01-15T14-30-45-123.md`

<!-- @mid:p-emv2tw -->
**Why this format:**

<!-- @mid:list-t2w1du -->
- Sortable alphabetically
- No special characters (cross-platform)
- Milliseconds prevent collisions

<!-- @mid:h-87ahk3 -->
### C. Config Schema

<!-- @mid:code-pzohdb -->
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

<!-- @mid:h-th404d -->
### D. IPC API Additions

<!-- @mid:code-1fr3ix -->
```typescript
// Main process handlers
ipcMain.handle('get-version-list', (_, filePath: string) => VersionInfo[]);
ipcMain.handle('get-version-content', (_, filePath: string, timestamp: string) => string);
ipcMain.handle('restore-version', (_, filePath: string, timestamp: string) => void);
ipcMain.handle('delete-version', (_, filePath: string, timestamp: string) => void);
ipcMain.handle('label-version', (_, filePath: string, timestamp: string, label: string) => void);

// Events (main → renderer)
ipcMain.on('file-changed-externally', (filePath: string) => void);
ipcMain.on('recovery-available', (recoveryInfo: RecoveryInfo) => void);
```

<!-- @mid:h-2j140q -->
### E. Dependencies to Add

<!-- @mid:code-cf2xkb -->
```json
{
  "dependencies": {
    "chokidar": "^4.0.0",
    "diff": "^5.1.0"
  }
}
```

<!-- @mid:p-v0t8sj -->
**Note:** chokidar v5+ is ESM-only and requires Node 20+. Use v4.x for CommonJS compatibility.

---

<!-- @mid:h-pq5kfb -->
## References

<!-- @mid:list-3a6tgi -->
- Automerge: CRDTs meet version control
- Yjs shared data types
- Loro CRDT library
- Obsidian Version History
- Chokidar file watching
- RxDB Electron Database patterns
- Rethinking Undo in text editors
- CKEditor real-time collaboration architecture

---

<!-- @mid:p-m5qqj3 -->
*Document created: 2025-12-05*
*Status: Planning complete, ready for implementation decisions*