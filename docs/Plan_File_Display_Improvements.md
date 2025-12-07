# File Display Improvements - Planning Document

## Current State

- All files display with the same generic document icon (`File` from lucide-react)
- All file extensions are visible (.md, .docx, .txt, etc.)
- No visual differentiation between supported and unsupported file types
- Folders use a generic folder icon
- No distinction between native Midlight files and regular markdown files

## Goals

1. Improve visual clarity and scanability of the file browser
2. Help users quickly identify file types and their capabilities
3. Communicate which files are native vs compatible vs importable vs unsupported
4. Maintain a clean, uncluttered interface
5. Guide users toward the right workflow for each file type

---

## Midlight File Categories

Understanding how Midlight handles different file types:

| Category | Detection | Can Open? | Formatting? | User Action |
|----------|-----------|-----------|-------------|-------------|
| **Native Midlight** | `.md` file with `.md.midlight` sibling | ✅ Full support | ✅ Preserved | Open directly |
| **Compatible MD** | `.md` file without `.md.midlight` | ✅ Opens | ❌ Plain text only | Open (offer to convert?) |
| **Importable** | `.docx`, `.html`, `.rtf` | ❌ No | N/A | Import → converts to Midlight |
| **Viewable** | `.png`, `.jpg`, `.gif`, `.webp`, `.svg`, `.pdf` | 👁️ View only | N/A | Preview, can embed in docs |
| **Unsupported** | Everything else | ❌ No | N/A | Dim/hide, no action |

### Native Midlight Files
- Files created in Midlight or fully imported
- Have rich formatting stored in `.md.midlight` metadata file
- Should look "native" - clean, prominent, no extension shown
- Icon: Custom Midlight document icon or distinct styling

### Compatible Markdown Files
- Standard `.md` files from Obsidian, Notion exports, GitHub, etc.
- Can be opened and edited, but formatting info will be lost/missing
- **Key Question**: What happens when user opens these?
  - Option A: Just open as plain markdown (simple but lossy)
  - Option B: Offer to "Import" which creates `.md.midlight` (guided)
  - Option C: Auto-create `.md.midlight` on open (seamless but implicit)
- Icon: Markdown icon, slightly different from native

### Importable Files
- `.docx` files that need conversion
- Potentially: `.html`, `.rtf`, Notion exports, etc.
- Clicking should trigger import flow, not try to open
- Icon: Import badge or arrow indicator

### Viewable Files
- Images, PDFs - can preview but not edit as documents
- **Show extension** - users care about `.png` vs `.jpg` vs `.gif`
- Could be embedded/linked in Midlight documents
- Icon: Image icon, PDF icon, etc.

### Unsupported Files
- System files, code files, config files, etc.
- Dim significantly or hide entirely
- No action on click (or show "unsupported" message)

---

## Decision Area 1: Import from Other Apps

### The Problem
Users may have markdown files from:
- **Obsidian**: Uses wiki-links `[[page]]`, callouts, front-matter, dataview
- **Notion**: Exports to markdown but loses databases, toggles, synced blocks
- **Typora/iA Writer**: Standard markdown, maybe front-matter
- **GitHub/GitLab**: Standard markdown with some HTML
- **Bear/Ulysses**: Proprietary formats, export to markdown

### Option A: Basic Markdown Only
Just read standard markdown, ignore app-specific features.

**Pros:**
- Simple implementation
- Works with any markdown file
- No false promises about format support

**Cons:**
- Wiki-links become broken `[[text]]`
- Callouts render as blockquotes
- Users lose organizational features

### Option B: Common Extensions Support
Support widely-used markdown extensions:
- Wiki-links → convert to standard links or preserve
- Callouts/admonitions → convert to styled blockquotes
- Front-matter → parse and store in `.md.midlight`
- Tables → already standard markdown

**Pros:**
- Better experience for Obsidian/Notion users
- Preserves more document structure
- Can improve over time

**Cons:**
- More complex parsing
- Edge cases for each app's quirks
- Maintenance burden

### Option C: Dedicated Importers
Create app-specific import flows:
- "Import from Obsidian" - handles vault structure, wiki-links
- "Import from Notion" - handles nested pages, databases → tables
- "Import from Word" - existing docx import

**Pros:**
- Best possible conversion quality
- Can handle app-specific features properly
- Clear user expectations

**Cons:**
- Significant development effort
- Need to maintain as source apps change
- May still lose some features

### Option D: Hybrid Approach
1. Basic markdown support for quick open
2. "Smart Import" option that detects source and applies conversions
3. Dedicated importers for most common sources (Obsidian, Notion, Word)

**Pros:**
- Flexible for different user needs
- Progressive enhancement
- Can prioritize based on user demand

**Cons:**
- More UI complexity
- Multiple code paths to maintain

### Recommendation
**Start with Option A (Basic Markdown)** for MVP, with clear messaging that formatting may differ. Add **Option B (Common Extensions)** as enhancement. Consider **dedicated Obsidian importer** if user demand exists, since Obsidian has significant market share.

---

## Decision Area 2: File Type Icons

### Option A: Midlight-Aware Icons
Different icons based on Midlight file categories:

| Category | Icon | Visual Treatment |
|----------|------|------------------|
| Native Midlight (`.md` + `.md.midlight`) | Custom Midlight icon or FileText with accent | Full opacity, accent color |
| Compatible MD (`.md` only) | FileText (standard) | Full opacity, neutral |
| Importable (`.docx`) | FileText with import arrow | Full opacity, subtle badge |
| Images (`.png`, `.jpg`, etc.) | Image | Full opacity |
| PDF | FileText2 or PDF icon | Full opacity |
| Unsupported | File (generic) | Dimmed (50% opacity) |

**Pros:**
- Clearly distinguishes native vs non-native content
- Guides users to correct workflow
- Reinforces Midlight brand for native files

**Cons:**
- Need to check for `.md.midlight` sibling files (extra file system lookups)
- More complex logic

### Option B: Simpler Category Icons
Broader categories without native/compatible distinction:

| Category | File Types | Icon |
|----------|------------|------|
| Documents | All `.md`, `.docx`, `.txt` | FileText |
| Images | `.png`, `.jpg`, `.gif`, etc. | Image |
| Importable | `.docx` specifically | FileText + badge |
| Other | Everything else | File (dimmed) |

**Pros:**
- Simpler implementation
- No file system lookups needed
- Still provides useful differentiation

**Cons:**
- Doesn't distinguish native Midlight files
- Less guidance for users

### Recommendation
**Option A (Midlight-Aware Icons)** is worth the extra complexity. It reinforces the app's identity and helps users understand which files have full Midlight support. The `.md.midlight` check can be cached during directory loading.

---

## Decision Area 3: File Extension Visibility

### Option A: Always Show Extensions
Keep current behavior - all extensions visible.

```
document.md
report.docx
image.png
```

**Pros:**
- Complete clarity about file types
- No ambiguity with similarly-named files
- Familiar to technical users

**Cons:**
- More visual clutter
- Redundant when icons already indicate type
- Less polished appearance

### Option B: Hide Extensions for Native Files Only
Hide `.md` extension only for native Midlight files (those with `.md.midlight`).

```
My Document           (native - was document.md, has .md.midlight)
notes.md              (compatible MD - keeps extension)
report.docx           (importable - keeps extension)
photo.png             (viewable - keeps extension)
```

**Pros:**
- Native files feel "native" (like .pages in Apple Pages)
- Users can distinguish native vs compatible MD at a glance
- Extensions remain useful for non-native files
- Images keep extensions (useful info: png vs jpg)

**Cons:**
- Requires checking for `.md.midlight` sibling

### Option C: Hide All MD Extensions
Hide `.md` for all markdown files, show others.

```
My Document           (was document.md)
notes                 (was notes.md)
report.docx
photo.png
```

**Pros:**
- Cleaner look for document-focused workflow
- All markdown files look "native"

**Cons:**
- Can't distinguish native from compatible MD
- May confuse users coming from other apps

### Option D: Category-Based Extension Rules
Different rules for different categories:

| Category | Extension Visibility |
|----------|---------------------|
| Native Midlight | Hidden |
| Compatible MD | Shown (.md) |
| Importable | Shown (.docx) |
| Images | Shown (.png, .jpg - users care!) |
| Other | Shown |

**Pros:**
- Each category optimized for user needs
- Images keep extensions (important distinction)
- Clear visual hierarchy

**Cons:**
- Complex rules to explain/document

### Recommendation
**Option B (Hide Extensions for Native Files Only)** or **Option D (Category-Based Rules)** both work well. Key insight: **always show image extensions** since users care about format (png vs jpg vs gif). Native Midlight files should feel native with hidden extensions.

---

## Decision Area 4: Unsupported File Handling

### Option A: Show All Files Equally
Display all files with equal visual weight.

**Pros:**
- Users see complete folder contents
- No judgment about file types
- Simple implementation

**Cons:**
- Users may try to open unsupported files
- No guidance about app capabilities

### Option B: Dim Unsupported Files
Show unsupported files with reduced opacity.

```css
.unsupported { opacity: 0.5; }
```

**Pros:**
- Complete visibility of folder contents
- Visual hierarchy guides users
- Non-destructive (files still accessible)

**Cons:**
- May feel like files are "broken"
- Subjective which files to dim

### Option C: Hide Unsupported Files
Only show files the app can open.

**Pros:**
- Clean, focused interface
- No confusion about capabilities
- Simpler mental model

**Cons:**
- Users can't see full folder contents
- May cause confusion ("where did my file go?")
- Different view than Finder/Explorer

### Option D: Filter Toggle
Add a toggle to show/hide unsupported files.

**Pros:**
- User choice
- Best of both worlds
- Progressive disclosure

**Cons:**
- More UI complexity
- Another setting to manage

### Recommendation
**Option B (Dim Unsupported Files)** balances visibility with guidance. Users see everything but understand what's supported.

---

## Decision Area 5: Special Folders

### Folders to Consider
- `.midlight/` - App's internal data folder
- `.git/` - Git repository data
- `node_modules/` - Dependencies (if in a code project)
- Other dotfiles/folders

### Option A: Show All Folders
Display everything including system/hidden folders.

**Pros:**
- Complete transparency
- Users can access everything

**Cons:**
- Clutter from irrelevant folders
- Users might accidentally modify system files

### Option B: Hide System Folders
Hide `.midlight/`, `.git/`, and other dot-folders by default.

**Pros:**
- Cleaner interface
- Protects system folders
- Focuses on user content

**Cons:**
- Less transparency
- Power users may want access

### Option C: Show with Different Styling
Show system folders but with distinct styling (dimmed, italic, etc.).

**Pros:**
- Visible but de-emphasized
- Users know they exist
- Clear it's "system" content

**Cons:**
- Still adds visual clutter

### Recommendation
**Option B (Hide System Folders)** is cleanest. The `.midlight/` folder is internal app data and shouldn't be user-accessible. Could add a "Show Hidden Files" toggle later if needed.

---

## Implementation Plan

### Phase 1: File Category Detection ✅ COMPLETED
1. ~~Modify `loadDir` to check for `.md.midlight` sibling files~~
2. ~~Add `fileCategory` property to `FileNode` interface~~
3. ~~Categories: `native`, `compatible`, `importable`, `viewable`, `unsupported`~~

**Implemented in:**
- `src/shared/types.ts` - Added `FileCategory` type
- `src/shared/fileUtils.ts` - Created categorization utilities
- `electron/main.ts` - Updated read-dir handler

### Phase 2: File Type Icons ✅ COMPLETED
1. ~~Create a `getFileIcon` utility function based on category~~
2. ~~Add distinct icon/styling for native Midlight files~~
3. ~~Add import indicator for `.docx` files~~
4. ~~Add image icons for viewable files~~

**Implemented in:**
- `src/utils/fileIcons.tsx` - Icon selection based on category
- `src/components/Sidebar.tsx` - Dynamic icon rendering

### Phase 3: Extension Visibility ✅ COMPLETED
1. ~~Create a `getDisplayName` utility function~~
2. ~~Hide `.md` extension for native files only~~
3. ~~Keep extensions for images, importable, compatible MD~~

**Implemented in:**
- `src/shared/fileUtils.ts` - `getDisplayName()` function
- `electron/main.ts` - Sets `displayName` during directory read

### Phase 4: Visual Styling ✅ COMPLETED
1. ~~Dim unsupported files (opacity: 0.5)~~
2. ~~Add accent color/styling for native files~~
3. ~~Consider import badge for importable files~~

**Implemented in:**
- `src/components/Sidebar.tsx` - Category-based styling

### Phase 5: Hidden Folders & Files ✅ COMPLETED
1. ~~Filter out `.midlight/` folder from display~~
2. ~~Filter out `.md.midlight` files (metadata, not user files)~~
3. ~~Hide other system folders (`.git/`, etc.)~~

**Implemented in:**
- `electron/main.ts` - `shouldHideFolder()` and `shouldHideFile()` functions
- Hides: `.midlight`, `.git`, `.svn`, `.hg`, `node_modules`, `.vscode`, `.idea`

### Phase 6: Click Behavior (Future)
1. Native/Compatible: Open in editor
2. Importable: Trigger import flow
3. Viewable: Open preview
4. Unsupported: Show message or no action

---

## Summary of Recommendations

| Area | Recommendation |
|------|----------------|
| **Import Strategy** | Basic Markdown for MVP, add extensions later |
| **Icons** | Midlight-aware icons (native vs compatible) |
| **Extensions** | Hide for native Midlight only, show for images |
| **Unsupported** | Dim to 50% opacity |
| **System Folders** | Hide `.midlight/`, `.git/`, `.md.midlight` files |

This approach creates a clear hierarchy:
1. **Native Midlight files** - Premium treatment, hidden extensions, distinct icon
2. **Compatible MD** - Workable, shows `.md` extension
3. **Importable** - Shows conversion is needed
4. **Viewable** - Images with extensions (users care about format)
5. **Unsupported** - Clearly de-emphasized

---

## Open Questions

1. **Compatible MD behavior**: When opening a `.md` without `.md.midlight`:
   - Just open it (lossy)?
   - Prompt to import/convert?
   - Auto-create `.md.midlight`?

   *Status: Still open - current behavior opens directly*

2. **Obsidian compatibility**: Priority for supporting wiki-links, callouts, front-matter?

   ✅ **RESOLVED**: Full Obsidian import implemented with:
   - Wiki-link conversion (`[[Page]]` → `[Page](Page.md)`)
   - Callout/admonition conversion
   - Front-matter parsing and metadata storage
   - Dataview block removal with warnings
   - Multi-step import wizard at File → Import → From Obsidian Vault

3. **Click behavior for importable**: Should clicking `.docx` auto-start import or show a dialog first?

   *Status: Still open - current behavior opens import dialog for bulk import*

4. **Rename behavior**: If user renames file in browser, should `.md.midlight` rename too?

   *Status: Still open*

---

## Implementation Status Summary

| Component | Status | Files |
|-----------|--------|-------|
| File Categorization | ✅ Complete | `src/shared/types.ts`, `src/shared/fileUtils.ts` |
| Dynamic Icons | ✅ Complete | `src/utils/fileIcons.tsx`, `src/components/Sidebar.tsx` |
| Extension Hiding | ✅ Complete | `electron/main.ts`, `src/shared/fileUtils.ts` |
| Folder/File Filtering | ✅ Complete | `electron/main.ts` |
| Obsidian Import | ✅ Complete | `electron/services/importService.ts`, `src/components/ImportWizard.tsx` |
| Notion Import | ✅ Complete | `electron/services/importService.ts`, `src/components/ImportWizard.tsx` |
| Security Audit | ✅ Complete | Path traversal protection, IPC validation, regex DoS fixes |

**Next Steps (Phase 4+):**
- Drag-drop import detection
- Quick import with defaults
- Single file import prompts
- Image/PDF preview panel
