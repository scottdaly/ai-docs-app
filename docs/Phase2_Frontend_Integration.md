# Phase 2: Frontend Integration

**Status**: **COMPLETE**
**Completed**: 2025-12-05
**Depends on**: Phase 1 (Complete)

---

## Summary

Phase 2 connected the React frontend to the backend storage services implemented in Phase 1. The editor now stores and loads Tiptap JSON directly through the workspace APIs, enabling all versioning and recovery features.

---

## What Was Implemented

### Files Modified

| File | Changes |
|------|---------|
| `src/store/useFileSystem.ts` | Complete rewrite - uses workspace APIs, stores Tiptap JSON |
| `src/components/Editor.tsx` | Removed markdown conversion, loads/saves JSON directly |
| `src/App.tsx` | Updated DOCX import to use HTML-to-JSON converter |
| `electron/main.ts` | Added 16 IPC handlers for workspace APIs |
| `electron/preload.ts` | Exposed workspace APIs to renderer |
| `src/vite-env.d.ts` | Added type definitions for new APIs |

### Files Created

| File | Purpose |
|------|---------|
| `src/components/RecoveryPrompt.tsx` | UI for crash recovery notification |
| `src/utils/htmlToTiptap.ts` | Converts HTML (from DOCX) to Tiptap JSON |

### Files Deleted

| File | Reason |
|------|--------|
| `src/utils/markdown.ts` | Replaced by backend serializers |

---

## Key Changes

### State Management (useFileSystem.ts)

**Before:**
```typescript
fileContent: string  // Markdown string
saveFile: (content: string) => Promise<void>
```

**After:**
```typescript
editorContent: TiptapDocument | null  // Tiptap JSON
hasRecovery: boolean
recoveryTime: Date | null
saveFile: (json: TiptapDocument) => Promise<void>
loadFromRecovery: (filePath: string) => Promise<void>
discardRecovery: (filePath: string) => Promise<void>
```

### Editor (Editor.tsx)

**Before:**
```typescript
// Save
const html = editor.getHTML();
const markdown = htmlToMarkdown(html);
saveFile(markdown);

// Load
const html = markdownToHtml(fileContent);
editor.commands.setContent(html);
```

**After:**
```typescript
// Save
const json = editor.getJSON();
saveFile(json);

// Load
editor.commands.setContent(editorContent);  // Direct JSON
```

### Workspace Initialization

On `loadDir()`, the workspace is automatically initialized:
```typescript
await window.electronAPI.workspaceInit(path);
```

This creates the `.midlight/` folder structure if it doesn't exist.

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        EDITOR                                   │
│                                                                 │
│  editor.getJSON() ─────────────► saveFile(json)                │
│        ▲                               │                        │
│        │                               ▼                        │
│  editor.setContent(json) ◄──── workspaceSaveDocument()         │
│        ▲                               │                        │
│        │                               ▼                        │
│  editorContent ◄───────────── workspaceLoadDocument()          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                    WORKSPACE MANAGER                            │
│                                                                 │
│  • DocumentSerializer (JSON → Markdown + Sidecar)              │
│  • CheckpointManager (creates versions on save)                │
│  • ImageManager (extracts base64 images)                        │
│  • RecoveryManager (WAL for crash protection)                  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                       FILE SYSTEM                               │
│                                                                 │
│  workspace/                                                     │
│  ├── document.md           (clean markdown)                    │
│  └── .midlight/                                                │
│      ├── sidecars/         (formatting JSON)                   │
│      ├── checkpoints/      (version history)                   │
│      ├── objects/          (content blobs)                     │
│      ├── images/           (extracted images)                  │
│      └── recovery/         (WAL files)                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Features Now Active

### Automatic Checkpoints
- Created on every save (with change detection)
- Stored in `.midlight/checkpoints/`
- Content deduplicated via object store

### Crash Recovery
- WAL writes every 500ms while editing
- On load, checks for recovery files
- Shows RecoveryPrompt if unsaved changes found

### Image Extraction
- Base64 images extracted from documents
- Stored by content hash in `.midlight/images/`
- Automatic deduplication

### Sidecar Files
- Rich formatting preserved in JSON
- Block IDs for paragraph-level tracking
- Stored in `.midlight/sidecars/`

---

## Migration / Backward Compatibility

Existing `.md` files work automatically:

1. File opened without sidecar
2. DocumentDeserializer parses markdown to Tiptap JSON
3. Basic formatting extracted (headings, lists, bold, etc.)
4. On first save, sidecar created
5. Future loads use full sidecar

**No user action required** - migration is transparent.

---

## Testing

### Build Status
- TypeScript compilation: Clean
- Vite build: Successful
- All 165 backend tests: Passing

### Manual Testing Checklist

- [x] Open workspace, `.midlight/` folder created
- [x] Open markdown file, content loads correctly
- [x] Edit file, auto-save triggers
- [x] Close and reopen, changes persisted
- [x] Check `.midlight/sidecars/` has sidecar file
- [x] Check `.midlight/checkpoints/` has history
- [ ] Test crash recovery (force-kill while editing)
- [ ] Test DOCX import with new converter

---

## Next Steps

Phase 2 is complete. The foundation is now in place for:

- **Phase 3**: File watching for external changes
- **Phase 4**: History UI for browsing/restoring versions
- **Phase 5**: Drafts system for branching

---

*Completed: 2025-12-05*
