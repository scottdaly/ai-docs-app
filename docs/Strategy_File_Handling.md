# Midlight File Handling Strategy

## Executive Summary

This document outlines a comprehensive long-term strategy for how Midlight handles files, imports, exports, and presents content to users. The goal is to create an experience that feels native and polished while remaining interoperable with the broader document ecosystem.

**Core Principle**: Midlight should feel like a first-class document editor (like Pages, Word, or Notion) while being built on open, portable formats (Markdown).

---

## Part 1: File Format Philosophy

### The Dual-File Architecture

Midlight uses a dual-file system:
- **`.md` file**: Standard Markdown - portable, readable anywhere
- **`.md.midlight` file**: Rich metadata - formatting, styles, AI context

This architecture provides:
1. **Portability**: The `.md` file works in any text editor, GitHub, Obsidian, etc.
2. **Rich Features**: The `.midlight` file enables features beyond standard Markdown
3. **Graceful Degradation**: If `.midlight` is lost, content survives in `.md`
4. **No Lock-in**: Users can leave Midlight anytime with their content intact

### What Goes Where

| `.md` File (Portable) | `.md.midlight` File (Rich) |
|-----------------------|---------------------------|
| All text content | Font choices & typography |
| Standard Markdown formatting | Custom styling (colors, spacing) |
| Links and images | Block-level metadata |
| Tables | AI conversation history |
| Code blocks | Collaboration state |
| Front-matter (optional) | Version history hints |

### Design Decisions

1. **Content always in `.md`**: Never store user content only in `.midlight`
2. **Invisible metadata file**: Users shouldn't see or manage `.midlight` files
3. **Auto-sync**: Changes to `.md` always update; `.midlight` created/updated silently
4. **Resilient**: If `.midlight` is corrupted/missing, fall back gracefully

---

## Part 2: File Categories & Taxonomy

### Category Definitions

#### 1. Native Midlight Documents
**Detection**: `.md` file with corresponding `.md.midlight` sibling

**Characteristics**:
- Full rich editing experience
- All Midlight features available
- Formatting preserved across sessions
- AI features fully functional

**User Experience**:
- Clean display name (no `.md` extension shown)
- Distinct "native" icon (consider Midlight brand element)
- Premium visual treatment (subtle accent color or styling)
- Opens instantly in full editor

#### 2. Compatible Markdown Files
**Detection**: `.md` file WITHOUT `.md.midlight` sibling

**Characteristics**:
- Can be opened and edited
- Standard Markdown rendering only
- No rich formatting preserved
- Potential data from other apps (Obsidian, Notion, etc.)

**User Experience**:
- Shows `.md` extension (signals "external" origin)
- Standard document icon (different from native)
- Opens in editor with conversion prompt
- "Import to Midlight" option available

**Conversion Flow**:
```
User opens external.md
    ↓
Editor opens, shows content
    ↓
Banner: "This file was created outside Midlight.
         Import it to enable rich formatting?"
    [Import to Midlight] [Keep as Plain Markdown]
    ↓
If Import: Creates .md.midlight, removes banner
If Keep: Continues as plain MD, no .midlight created
```

#### 3. Importable Documents
**Detection**: `.docx`, `.rtf`, `.html`, `.odt` extensions

**Characteristics**:
- Cannot be opened directly (binary or complex format)
- Must be converted to Midlight format
- Conversion may lose some features
- Original file preserved

**User Experience**:
- Shows full extension (`.docx`)
- Import indicator icon (arrow or badge)
- Single-click triggers import flow
- Clear progress indication

**Import Flow**:
```
User clicks report.docx
    ↓
Import dialog appears:
    "Import 'report.docx' to Midlight?"
    - Will create: report.md
    - Original file will be preserved
    [Import] [Cancel]
    ↓
Progress indicator during conversion
    ↓
New .md + .md.midlight created
    ↓
Opens in editor, original .docx unchanged
```

#### 4. Viewable Media
**Detection**: Image extensions (`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`), `.pdf`

**Characteristics**:
- Can be previewed, not edited as documents
- Can be embedded/linked in Midlight documents
- Useful for reference alongside documents

**User Experience**:
- Always shows extension (users care: png vs jpg)
- Appropriate icon (image icon, PDF icon)
- Single-click opens preview panel
- Drag-to-embed into documents (future)

**Supported Formats**:
| Format | Preview | Embed | Notes |
|--------|---------|-------|-------|
| PNG | Yes | Yes | Lossless, transparency |
| JPG/JPEG | Yes | Yes | Photos |
| GIF | Yes | Yes | Animated support |
| WebP | Yes | Yes | Modern format |
| SVG | Yes | Yes | Vector graphics |
| PDF | Yes | No | Multi-page support |

#### 5. Unsupported Files
**Detection**: Any extension not in above categories

**Characteristics**:
- Cannot be opened or previewed
- May be system files, code, data, etc.
- Visible for context but not actionable

**User Experience**:
- Shows extension
- Generic file icon
- Dimmed to 50% opacity
- Click shows tooltip: "This file type is not supported"
- No context menu actions except "Show in Finder"

---

## Part 3: Import Strategies

### Tier 1: Word Documents (Priority)

**Why Priority**: Most common import need, users switching from Word/Google Docs

**Conversion Mapping**:
| Word Feature | Midlight Equivalent |
|--------------|---------------------|
| Headings (H1-H6) | Markdown headings |
| Bold, Italic, Underline | Markdown emphasis + `.midlight` styling |
| Bullet lists | Markdown lists |
| Numbered lists | Markdown ordered lists |
| Tables | Markdown tables |
| Images | Extracted and embedded |
| Hyperlinks | Markdown links |
| Comments | Preserved in `.midlight` (future) |
| Track changes | Collapsed to final state |
| Headers/Footers | Converted to content or discarded |
| Page breaks | Horizontal rules or ignored |

**Implementation**: Use mammoth.js (already in project) with enhanced post-processing

### Tier 2: Plain Markdown Enhancement

**Why Important**: Users coming from Obsidian, Notion, GitHub

**Common Extensions to Support**:

1. **Wiki-Links** (Obsidian)
   ```markdown
   [[Another Page]]           → [Another Page](Another%20Page.md)
   [[Page|Display Text]]      → [Display Text](Page.md)
   [[Page#Heading]]           → [Page](Page.md#heading)
   ```

2. **Callouts/Admonitions** (Obsidian, GitHub)
   ```markdown
   > [!NOTE]                  → Styled blockquote in .midlight
   > Important information

   > [!WARNING]               → Warning-styled blockquote
   > Be careful here
   ```

3. **Front-matter** (Jekyll, Hugo, Obsidian)
   ```yaml
   ---
   title: My Document
   tags: [work, important]
   created: 2024-01-15
   ---
   ```
   → Parsed and stored in `.midlight` metadata

4. **Task Lists** (GitHub)
   ```markdown
   - [ ] Unchecked task       → Interactive checkbox
   - [x] Completed task       → Checked checkbox
   ```

**Implementation Approach**:
- Detect on file open (scan for patterns)
- Offer "Smart Import" if extensions detected
- Convert in place or preserve based on user preference

### Tier 3: Notion Export (Priority)

**Why Priority**: Large user base, common migration path, users want to escape Notion

**Notion Export Structure**:
```
Notion_Export/
├── Page Name abc123.md           # UUID suffixes on everything
├── Nested Page def456/
│   ├── Nested Page def456.md
│   └── Sub Page ghi789.md
├── Database xyz999/
│   ├── Database xyz999.csv       # or .md with table
│   └── Row 1 aaa111.md
└── images/
    └── image1.png
```

**Challenges & Solutions**:
| Challenge | Solution |
|-----------|----------|
| UUID suffixes in filenames | Strip UUIDs, handle conflicts |
| Nested folder = nested page | Flatten or preserve structure (user choice) |
| Databases → CSV/tables | Convert to Markdown tables |
| Internal links with UUIDs | Rebuild links after rename |
| Toggle blocks | Convert to details/summary or headers |
| Callout blocks | Convert to blockquotes with styling |
| Embedded images | Copy to local folder, update paths |

### Tier 4: Rich Text / HTML (Future)

**Use Cases**:
- Paste from web pages
- Import HTML documents
- Legacy RTF files

**Approach**: Convert to Markdown + store styling in `.midlight`

---

## Part 4: Export Strategies

### Export Formats

| Format | Use Case | Fidelity |
|--------|----------|----------|
| Markdown (`.md`) | Sharing, GitHub, other apps | Content only |
| Markdown + Midlight | Backup, transfer between Midlight instances | Full |
| Word (`.docx`) | Business documents, collaboration | High |
| PDF | Final distribution, printing | Visual |
| HTML | Web publishing | High |

### Export Implementation

**Markdown Export** (Already exists):
- Just the `.md` file, portable anywhere

**Full Backup Export**:
- Zip containing `.md` + `.md.midlight`
- Can be imported to restore full document

**Word Export** (Future):
- Convert Markdown to docx
- Apply styling from `.midlight`
- Use docx library (officegen or docx)

**PDF Export** (Future):
- Render document with styling
- Use puppeteer or similar for print-quality output

---

## Part 5: User Interface Specifications

### File Browser Display

#### Icon System

```
┌─────────────────────────────────────────────────────┐
│ Native Midlight    [◆] My Document                  │
│                        (accent color, no extension) │
├─────────────────────────────────────────────────────┤
│ Compatible MD      [≡] notes.md                     │
│                        (neutral, shows .md)         │
├─────────────────────────────────────────────────────┤
│ Importable         [↓] report.docx                  │
│                        (import badge)               │
├─────────────────────────────────────────────────────┤
│ Image              [▣] photo.png                    │
│                        (shows extension)            │
├─────────────────────────────────────────────────────┤
│ Unsupported        [?] config.yaml                  │
│                        (dimmed 50%)                 │
└─────────────────────────────────────────────────────┘
```

#### Visual Hierarchy

| Category | Opacity | Icon Color | Text Style |
|----------|---------|------------|------------|
| Native | 100% | Accent (brand color) | Normal weight |
| Compatible | 100% | Neutral (gray) | Normal weight |
| Importable | 100% | Neutral + badge | Normal weight |
| Viewable | 100% | Neutral | Normal weight |
| Unsupported | 50% | Muted | Normal weight |

#### Extension Display Rules

| Category | Extension Shown | Example |
|----------|-----------------|---------|
| Native Midlight | Hidden | `My Document` |
| Compatible MD | Shown | `notes.md` |
| Importable | Shown | `report.docx` |
| Images | Always shown | `photo.png` |
| Unsupported | Shown | `config.yaml` |

### Hidden Items

The following should never appear in the file browser:

1. **`.midlight/` folder** - App's internal data directory
2. **`.md.midlight` files** - Metadata files (paired with their `.md`)
3. **`.git/` folder** - Version control (optional: make configurable)
4. **`.DS_Store`** - macOS system files
5. **`Thumbs.db`** - Windows system files

### Context Menu Actions

| Category | Available Actions |
|----------|-------------------|
| Native | Open, Rename, Duplicate, Delete, Copy, Cut, Show in Finder |
| Compatible | Open, Import to Midlight, Rename, Delete, Copy, Cut, Show in Finder |
| Importable | Import, Show in Finder |
| Viewable | Preview, Show in Finder |
| Unsupported | Show in Finder |

### Click Behaviors

| Category | Single Click | Double Click |
|----------|--------------|--------------|
| Native | Select | Open in editor |
| Compatible | Select | Open in editor (with import prompt) |
| Importable | Select | Start import flow |
| Viewable | Select | Open preview |
| Unsupported | Select | Show "unsupported" tooltip |

---

## Part 6: Technical Implementation

### FileNode Interface Update

```typescript
interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];

  // New properties
  category: 'native' | 'compatible' | 'importable' | 'viewable' | 'unsupported';
  hasMidlightData: boolean;  // true if .md.midlight exists
  displayName: string;       // name without extension for native files
}
```

### Category Detection Logic

```typescript
function categorizeFile(name: string, siblingNames: string[]): FileCategory {
  const ext = getExtension(name).toLowerCase();

  // Check for native Midlight
  if (ext === '.md') {
    const midlightFile = name + '.midlight';
    if (siblingNames.includes(midlightFile)) {
      return 'native';
    }
    return 'compatible';
  }

  // Importable formats
  if (['.docx', '.rtf', '.html', '.odt'].includes(ext)) {
    return 'importable';
  }

  // Viewable formats
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.pdf'].includes(ext)) {
    return 'viewable';
  }

  return 'unsupported';
}
```

### File Filtering Logic

```typescript
function shouldShowFile(name: string): boolean {
  // Hide midlight metadata files
  if (name.endsWith('.md.midlight')) return false;

  // Hide system files
  if (name === '.DS_Store' || name === 'Thumbs.db') return false;

  return true;
}

function shouldShowFolder(name: string): boolean {
  // Hide system/app folders
  const hiddenFolders = ['.midlight', '.git', 'node_modules', '.svn', '.hg'];
  return !hiddenFolders.includes(name);
}
```

### Display Name Logic

```typescript
function getDisplayName(node: FileNode): string {
  if (node.category === 'native') {
    // Remove .md extension for native files
    return node.name.replace(/\.md$/i, '');
  }
  return node.name;
}
```

---

## Part 7: Bulk Import Workflows

### Overview

Bulk import is critical for user adoption. Users switching from Obsidian or Notion have years of content they need to bring over. The import experience should be:

1. **Discoverable** - Easy to find in the app
2. **Informative** - Show what will be imported and any issues
3. **Configurable** - Let users control the conversion
4. **Reliable** - Never lose data, handle errors gracefully
5. **Fast** - Progress indication for large vaults/exports

### Entry Points

Users should be able to start bulk import from:
1. **Welcome screen** - "Import from Obsidian/Notion" buttons
2. **File menu** - File → Import → From Obsidian Vault / From Notion Export
3. **Empty state** - When no workspace is open
4. **Drag & drop** - Drag an Obsidian vault or Notion export folder

---

### Obsidian Vault Import

#### What is an Obsidian Vault?

An Obsidian vault is a folder containing:
```
My Vault/
├── .obsidian/              # Settings, plugins, themes (ignore)
│   ├── workspace.json
│   ├── app.json
│   └── plugins/
├── Daily Notes/            # User folders
│   ├── 2024-01-01.md
│   └── 2024-01-02.md
├── Projects/
│   ├── Project A.md
│   └── Project B.md
├── attachments/            # Images, PDFs (common convention)
│   └── image.png
├── Templates/              # Template files
│   └── Daily Note.md
└── README.md
```

#### Obsidian-Specific Syntax

| Feature | Obsidian Syntax | Midlight Conversion |
|---------|-----------------|---------------------|
| Wiki-links | `[[Page Name]]` | `[Page Name](Page%20Name.md)` |
| Wiki-links with alias | `[[Page Name\|Display]]` | `[Display](Page%20Name.md)` |
| Heading links | `[[Page#Heading]]` | `[Page](Page.md#heading)` |
| Block references | `[[Page#^block-id]]` | `[Page](Page.md)` (lossy) |
| Embeds | `![[Image.png]]` | `![Image](attachments/Image.png)` |
| Note embeds | `![[Other Note]]` | Link to note (no embed support yet) |
| Tags | `#tag` or `#nested/tag` | Preserve in text, store in metadata |
| Callouts | `> [!NOTE] Title` | Styled blockquote |
| Front-matter | YAML at top | Parse into `.midlight` metadata |
| Comments | `%%hidden%%` | Remove or convert to HTML comment |
| Highlights | `==highlighted==` | Convert to mark or span |
| Dataview | ` ```dataview ``` ` | Remove (not supported) |

#### Obsidian Import Wizard Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    Import from Obsidian                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Step 1: Select Vault                                           │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 📁 /Users/scott/Documents/My Obsidian Vault             │   │
│  └─────────────────────────────────────────────────────────┘   │
│  [Browse...]                                                    │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Step 2: Analysis Results                                       │
│                                                                 │
│  📊 Found:                                                      │
│     • 247 markdown files                                        │
│     • 12 folders                                                │
│     • 89 images/attachments                                     │
│                                                                 │
│  🔗 Detected Obsidian features:                                 │
│     • 156 wiki-links across 45 files                            │
│     • 23 files with front-matter                                │
│     • 8 files with callouts                                     │
│     • 3 files with dataview (will be removed)                   │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Step 3: Conversion Options                                     │
│                                                                 │
│  [✓] Convert wiki-links to standard markdown links              │
│  [✓] Import front-matter as document metadata                   │
│  [✓] Convert callouts to styled blockquotes                     │
│  [✓] Copy attachments to workspace                              │
│  [ ] Preserve original folder structure                         │
│  [ ] Skip template files (Templates/ folder)                    │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Step 4: Destination                                            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 📁 /Users/scott/Documents/Midlight Workspace            │   │
│  └─────────────────────────────────────────────────────────┘   │
│  [Browse...] [Use Current Workspace]                            │
│                                                                 │
│  ⚠️  3 files already exist and will be renamed with (1) suffix  │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                              [Cancel]  [Import 247 Files]       │
└─────────────────────────────────────────────────────────────────┘
```

#### Progress & Results

```
┌─────────────────────────────────────────────────────────────────┐
│                    Importing from Obsidian                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ████████████████████████░░░░░░░░░░  156 / 247 files            │
│                                                                 │
│  Currently processing: Projects/Project A.md                    │
│                                                                 │
│  ✓ 156 files imported                                           │
│  ✓ 312 wiki-links converted                                     │
│  ✓ 89 attachments copied                                        │
│  ⚠ 3 dataview blocks removed                                    │
│  ⚠ 2 broken links detected (files not found)                    │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                          [Cancel]               │
└─────────────────────────────────────────────────────────────────┘
```

#### Post-Import Report

```
┌─────────────────────────────────────────────────────────────────┐
│                    Import Complete! 🎉                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Successfully imported 247 files from your Obsidian vault.      │
│                                                                 │
│  ✓ 247 markdown files → Midlight documents                      │
│  ✓ 312 wiki-links → standard links                              │
│  ✓ 23 front-matter blocks → metadata                            │
│  ✓ 89 attachments copied                                        │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  ⚠️  Some items need attention:                                 │
│                                                                 │
│  • 2 broken links (referenced files not found):                 │
│    - [[Old Project]] in Projects/Archive.md                     │
│    - [[Missing Note]] in Daily Notes/2024-01-05.md              │
│                                                                 │
│  • 3 dataview queries removed (not supported):                  │
│    - Projects/Dashboard.md                                      │
│    - Daily Notes/Weekly Review.md                               │
│                                                                 │
│  [View Import Log]                                              │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                        [Open Workspace]         │
└─────────────────────────────────────────────────────────────────┘
```

---

### Notion Export Import

#### Getting Data Out of Notion

Users need instructions for exporting from Notion:

```
How to Export from Notion:
1. Open Notion → Settings & Members → Settings
2. Scroll to "Export all workspace content"
3. Choose "Markdown & CSV" format
4. Click "Export"
5. Wait for email with download link
6. Download and unzip the export
```

#### Notion Export Structure

```
Export-abc123/
├── Page Title 1a2b3c4d.md              # UUIDs everywhere
├── Another Page 5e6f7g8h/
│   ├── Another Page 5e6f7g8h.md        # Folder = nested page
│   ├── Child Page 9i0j1k2l.md
│   └── Images/
│       └── screenshot.png
├── My Database 3m4n5o6p/
│   ├── My Database 3m4n5o6p.csv        # Database as CSV
│   ├── Row 1 7q8r9s0t.md               # Each row can be a page
│   └── Row 2 1u2v3w4x.md
└── Untitled 5y6z7a8b.md                # Notion's famous "Untitled"
```

#### Notion-Specific Challenges

| Issue | Problem | Solution |
|-------|---------|----------|
| UUID filenames | `Page Name a1b2c3d4.md` | Strip UUID suffix, handle conflicts |
| Nested folders | Folder per sub-page | Option to flatten or preserve |
| Internal links | `[Link](Other%20Page%20x1y2z3.md)` | Map old→new filenames, update links |
| Database exports | CSV files mixed with pages | Convert CSV→Markdown tables |
| Untitled pages | Many `Untitled abc123.md` | Prompt user to rename or auto-name |
| Empty pages | Exported empty files | Option to skip empty files |
| Code blocks | Sometimes malformed | Clean up formatting |
| Images | Scattered in subfolders | Consolidate to single attachments folder |

#### Notion Import Wizard Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    Import from Notion                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Step 1: Select Notion Export Folder                            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 📁 /Users/scott/Downloads/Export-2024-01-15             │   │
│  └─────────────────────────────────────────────────────────┘   │
│  [Browse...]                                                    │
│                                                                 │
│  💡 Tip: Export from Notion using "Markdown & CSV" format       │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Step 2: Analysis Results                                       │
│                                                                 │
│  📊 Found:                                                      │
│     • 183 markdown files                                        │
│     • 4 CSV databases                                           │
│     • 67 images                                                 │
│     • 12 "Untitled" pages                                       │
│                                                                 │
│  ⚠️  Issues detected:                                           │
│     • 12 pages named "Untitled" (will need renaming)            │
│     • 8 empty pages (can be skipped)                            │
│     • 156 internal links to update                              │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Step 3: Conversion Options                                     │
│                                                                 │
│  [✓] Remove UUID suffixes from filenames                        │
│  [✓] Update internal links after rename                         │
│  [✓] Convert CSV databases to Markdown tables                   │
│  [✓] Consolidate images to /attachments folder                  │
│  [ ] Flatten folder structure (nested pages → single folder)    │
│  [✓] Skip empty pages                                           │
│                                                                 │
│  Handle "Untitled" pages:                                       │
│  (•) Rename to "Untitled 1", "Untitled 2", etc.                 │
│  ( ) Keep original names with UUID                              │
│  ( ) Prompt me for each one                                     │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Step 4: Destination                                            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 📁 /Users/scott/Documents/Midlight Workspace            │   │
│  └─────────────────────────────────────────────────────────┘   │
│  [Browse...] [Use Current Workspace]                            │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                              [Cancel]  [Import 175 Files]       │
└─────────────────────────────────────────────────────────────────┘
```

---

### Technical Implementation

#### Import Service Architecture

```typescript
// src/services/importService.ts

interface ImportSource {
  type: 'obsidian' | 'notion' | 'folder';
  path: string;
}

interface ImportAnalysis {
  totalFiles: number;
  markdownFiles: number;
  attachments: number;
  databases: number;  // Notion CSV files

  // Detected features
  wikiLinks: number;
  frontMatter: number;
  callouts: number;
  dataviewBlocks: number;  // Will be removed

  // Issues
  untitledPages: string[];
  emptyPages: string[];
  brokenLinks: string[];
  conflicts: string[];  // Files that already exist
}

interface ImportOptions {
  convertWikiLinks: boolean;
  importFrontMatter: boolean;
  convertCallouts: boolean;
  copyAttachments: boolean;
  preserveFolderStructure: boolean;
  skipEmptyPages: boolean;
  removeUUIDSuffixes: boolean;  // Notion
  convertCSVToTables: boolean;  // Notion
  untitledHandling: 'number' | 'keep' | 'prompt';
}

interface ImportProgress {
  phase: 'analyzing' | 'converting' | 'copying' | 'linking' | 'complete';
  current: number;
  total: number;
  currentFile: string;
  errors: ImportError[];
  warnings: ImportWarning[];
}

interface ImportResult {
  success: boolean;
  filesImported: number;
  linksConverted: number;
  attachmentsCopied: number;
  errors: ImportError[];
  warnings: ImportWarning[];
  report: string;  // Markdown report for user
}

class ImportService {
  async analyzeSource(source: ImportSource): Promise<ImportAnalysis>;
  async importFiles(
    source: ImportSource,
    destination: string,
    options: ImportOptions,
    onProgress: (progress: ImportProgress) => void
  ): Promise<ImportResult>;
}
```

#### Wiki-Link Converter

```typescript
// src/utils/wikiLinkConverter.ts

interface WikiLink {
  original: string;      // [[Page Name|Alias]]
  target: string;        // Page Name
  alias?: string;        // Alias
  heading?: string;      // #Heading
  blockRef?: string;     // ^block-id
  isEmbed: boolean;      // ![[...]]
}

function parseWikiLinks(content: string): WikiLink[] {
  const regex = /(!?)\[\[([^\]|#^]+)(?:#([^\]|^]+))?(?:\^([^\]|]+))?(?:\|([^\]]+))?\]\]/g;
  // ... parse and return
}

function convertWikiLink(link: WikiLink, fileMap: Map<string, string>): string {
  // fileMap maps original names to new paths
  const newPath = fileMap.get(link.target) || `${link.target}.md`;
  const display = link.alias || link.target;

  if (link.isEmbed && isImage(link.target)) {
    return `![${display}](${encodeURI(newPath)})`;
  }

  let href = encodeURI(newPath);
  if (link.heading) {
    href += `#${link.heading.toLowerCase().replace(/\s+/g, '-')}`;
  }

  return `[${display}](${href})`;
}
```

#### Notion UUID Stripper

```typescript
// src/utils/notionCleaner.ts

function stripNotionUUID(filename: string): string {
  // "Page Name abc123def456.md" → "Page Name.md"
  // UUID is typically 32 hex chars at end before extension
  return filename.replace(/\s+[a-f0-9]{32}(\.[^.]+)$/i, '$1');
}

function buildFilenameMap(files: string[]): Map<string, string> {
  const map = new Map<string, string>();
  const usedNames = new Set<string>();

  for (const file of files) {
    const cleanName = stripNotionUUID(file);
    let finalName = cleanName;

    // Handle conflicts
    let counter = 1;
    while (usedNames.has(finalName)) {
      const ext = path.extname(cleanName);
      const base = path.basename(cleanName, ext);
      finalName = `${base} (${counter})${ext}`;
      counter++;
    }

    usedNames.add(finalName);
    map.set(file, finalName);
  }

  return map;
}
```

#### Link Rebuilder

```typescript
// src/utils/linkRebuilder.ts

async function rebuildLinks(
  files: string[],
  filenameMap: Map<string, string>  // old → new
): Promise<void> {
  for (const file of files) {
    let content = await fs.readFile(file, 'utf-8');

    // Find all markdown links
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;

    content = content.replace(linkRegex, (match, text, href) => {
      // Decode and check if it maps to a renamed file
      const decoded = decodeURIComponent(href);
      const newHref = filenameMap.get(decoded);

      if (newHref) {
        return `[${text}](${encodeURI(newHref)})`;
      }
      return match;
    });

    await fs.writeFile(file, content);
  }
}
```

---

### Quick Import (Drag & Drop)

For users who don't need the full wizard:

1. User drags Obsidian vault folder onto Midlight window
2. App detects `.obsidian` folder → "This looks like an Obsidian vault"
3. Offer: "Quick Import" (sensible defaults) or "Customize Import"
4. Quick Import uses:
   - Convert wiki-links: Yes
   - Import front-matter: Yes
   - Copy attachments: Yes
   - Preserve structure: Yes

Same for Notion:
1. User drags export folder
2. App detects UUID patterns → "This looks like a Notion export"
3. Offer Quick Import with sensible defaults

---

## Part 8: Migration & Compatibility

### Handling Existing Documents

When user opens folder with existing `.md` files:
1. Scan for `.md.midlight` siblings to identify native files
2. Display compatible files with `.md` extension
3. No automatic conversion - user controls this

### Bulk Import Feature (Future)

For users migrating from other apps:

```
Import Wizard
├── Select source folder or vault
├── Detected X markdown files
│   ├── Y with wiki-links (Obsidian-style)
│   ├── Z with front-matter
│   └── W plain markdown
├── Conversion options:
│   ├── [x] Convert wiki-links to standard links
│   ├── [x] Import front-matter as metadata
│   └── [x] Create Midlight files for all
└── [Start Import]
```

### Sync Considerations

If user edits `.md` file externally:
1. Detect change on focus/reload
2. Parse markdown content
3. Attempt to preserve `.midlight` styling where possible
4. Mark conflicts if structure changed significantly

---

## Part 9: Implementation Roadmap

### Phase 1: Foundation (Immediate) ✅ COMPLETED

**Goal**: Basic category detection and visual differentiation

Tasks:
- [x] Add `category` and `displayName` to FileNode
- [x] Implement `categorizeFile()` in loadDir
- [x] Filter out `.md.midlight` files from display
- [x] Filter out `.midlight/` and `.git/` folders
- [x] Update file icons based on category
- [x] Hide `.md` extension for native files
- [x] Dim unsupported files

**Implementation Notes:**
- Added `FileCategory` type to `src/shared/types.ts`
- Created `src/shared/fileUtils.ts` with categorization utilities
- Updated `electron/main.ts` read-dir handler with filtering and categorization
- Created `src/utils/fileIcons.tsx` for dynamic icon selection
- Updated `src/components/Sidebar.tsx` with category-aware rendering

### Phase 2: Bulk Import - Obsidian (High Priority) ✅ COMPLETED

**Goal**: Easy migration path from Obsidian

Tasks:
- [x] Create ImportService with analyzeSource() method
- [x] Implement Obsidian vault detection (.obsidian folder)
- [x] Build wiki-link parser and converter
- [x] Handle callout/admonition conversion
- [x] Parse and store front-matter metadata
- [x] File menu: Import → From Obsidian Vault
- [x] Import wizard UI (multi-step dialog)
- [x] Progress indicator with cancellation
- [x] Post-import report with warnings

**Implementation Notes:**
- Created `electron/services/importService.ts` with full Obsidian import logic
- Wiki-link conversion: `[[Page]]` → `[Page](Page.md)`
- Callout conversion: `> [!NOTE]` → styled blockquotes
- Front-matter parsing with YAML support
- Multi-step wizard in `src/components/ImportWizard.tsx`
- Real-time progress updates via IPC

**Security Audit Completed:**
- Added path traversal protection with `sanitizeRelativePath()` and `isPathSafe()`
- Added IPC input validation with `validatePath()`
- Fixed regex DoS vulnerabilities with content size limits
- Improved error handling in file traversal

### Phase 3: Bulk Import - Notion (High Priority) ✅ COMPLETED

**Goal**: Easy migration path from Notion

Tasks:
- [x] Implement Notion export detection (UUID patterns)
- [x] UUID stripping and conflict resolution
- [x] Internal link rebuilding after rename
- [x] CSV → Markdown table conversion
- [x] Handle "Untitled" pages
- [x] Skip empty pages option
- [x] Image consolidation to attachments folder
- [x] File menu: Import → From Notion Export
- [x] Notion-specific wizard UI

**Implementation Notes:**
- Added Notion functions to `electron/services/importService.ts`:
  - `stripNotionUUID()` - Removes 32-char UUID suffixes from filenames
  - `buildNotionFilenameMap()` - Handles conflicts when stripping UUIDs
  - `csvToMarkdownTable()` - Converts Notion database exports to MD tables
  - `rebuildNotionLinks()` - Updates internal links after renaming files
  - `analyzeNotionExport()` - Scans folder for Notion-specific features
  - `importNotionExport()` - Full import with progress tracking
- Updated `ImportWizard.tsx` with Notion-specific options:
  - Remove UUID suffixes from filenames
  - Convert CSV databases to Markdown tables
- Enabled "From Notion Export..." menu item

### Phase 4: Quick Import & Drag-Drop

**Goal**: Frictionless import for casual users

#### 4.1 Welcome Screen (No Workspace Open)

When no workspace is open, show a welcoming empty state with clear actions:

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│              [Midlight Logo/Icon]                   │
│                                                     │
│              Welcome to Midlight                    │
│                                                     │
│    ┌─────────────────────────────────────────┐     │
│    │  📁  Open Workspace                      │     │
│    │      Choose an existing folder           │     │
│    └─────────────────────────────────────────┘     │
│                                                     │
│    ┌─────────────────────────────────────────┐     │
│    │  ⬇️  Import from Obsidian               │     │
│    │      Migrate your Obsidian vault         │     │
│    └─────────────────────────────────────────┘     │
│                                                     │
│    ┌─────────────────────────────────────────┐     │
│    │  ⬇️  Import from Notion                 │     │
│    │      Import a Notion export              │     │
│    └─────────────────────────────────────────┘     │
│                                                     │
│    ── or drag a folder here to get started ──      │
│                                                     │
│    Recent Workspaces:                              │
│    • ~/Documents/Notes                             │
│    • ~/Work/Project Docs                           │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Tasks:**
- [ ] Create `WelcomeScreen.tsx` component
- [ ] Show when `rootDir` is null in App.tsx
- [ ] "Open Workspace" button → existing folder picker
- [ ] "Import from Obsidian" button → triggers import wizard
- [ ] "Import from Notion" button → triggers import wizard
- [ ] Recent workspaces list (stored in localStorage or electron-store)
- [ ] Click recent workspace to open directly

#### 4.2 Drag-Drop Detection

Enable dragging folders onto the app to open or import them:

**Detection Logic:**
1. User drops a folder onto the app window
2. Check folder contents:
   - Has `.obsidian/` folder → Obsidian vault detected
   - Has files with UUID patterns (32 hex chars) → Notion export detected
   - Has `.midlight/` folder → Existing Midlight workspace
   - Otherwise → Generic folder (just open it)

**UX Flow:**
```
┌──────────────────────────────────────────────────────┐
│  Obsidian Vault Detected                             │
│                                                      │
│  "My Notes" appears to be an Obsidian vault.         │
│  Would you like to:                                  │
│                                                      │
│  ┌────────────────────┐  ┌────────────────────┐     │
│  │   Quick Import     │  │  Customize Import  │     │
│  │   (Recommended)    │  │                    │     │
│  └────────────────────┘  └────────────────────┘     │
│                                                      │
│  ┌────────────────────────────────────────────┐     │
│  │   Open Without Importing                   │     │
│  │   (Files will be treated as plain MD)      │     │
│  └────────────────────────────────────────────┘     │
│                                                      │
└──────────────────────────────────────────────────────┘
```

**Tasks:**
- [ ] Add `onDrop` and `onDragOver` handlers to main App container
- [ ] Create `DropZone.tsx` component with visual feedback
- [ ] Show drop overlay when dragging folders over app
- [ ] Create `ImportDetectionDialog.tsx` for detected source prompts
- [ ] Implement folder type detection (Obsidian/Notion/Midlight/generic)
- [ ] IPC handler for dropped folder path validation

#### 4.3 Quick Import Mode

Add a streamlined import path that uses sensible defaults:

**Quick Import Defaults:**
| Option | Obsidian | Notion |
|--------|----------|--------|
| Convert wiki-links | ✅ | N/A |
| Convert callouts | ✅ | N/A |
| Remove UUIDs | N/A | ✅ |
| Convert CSV to tables | N/A | ✅ |
| Copy attachments | ✅ | ✅ |
| Preserve folder structure | ✅ | ✅ |
| Skip empty pages | ✅ | ✅ |
| Create .midlight files | ✅ | ✅ |
| Import front-matter | ✅ | ✅ |

**UX Flow:**
- "Quick Import" → Skips options step, uses defaults
- Shows only: select → analyze → importing → complete
- "Customize" button still available to access full options

**Tasks:**
- [ ] Add `quickImport` prop to ImportWizard
- [ ] Skip options step when `quickImport=true`
- [ ] Add "Quick Import" vs "Customize" choice in detection dialog
- [ ] Store user preference for default import mode

#### 4.4 Empty Folder State Enhancement

When workspace is open but empty, show helpful prompts:

```
┌─────────────────────────────────────────────────────┐
│  This folder is empty                               │
│                                                     │
│  ┌─────────────────────────────────────────┐       │
│  │  ✨ Create your first document           │       │
│  └─────────────────────────────────────────┘       │
│                                                     │
│  Or import existing files:                          │
│  • Import from Obsidian                             │
│  • Import from Notion                               │
│  • Import DOCX files                                │
│                                                     │
│  ── drag files here to add them ──                  │
└─────────────────────────────────────────────────────┘
```

**Tasks:**
- [ ] Enhance empty state in Sidebar.tsx
- [ ] Add import shortcut links
- [ ] Add drag-drop support for individual files (docx, md)

#### 4.5 Implementation Files

| File | Purpose |
|------|---------|
| `src/components/WelcomeScreen.tsx` | Main welcome screen component |
| `src/components/DropZone.tsx` | Drag-drop overlay and handlers |
| `src/components/ImportDetectionDialog.tsx` | Dialog shown after drop detection |
| `src/store/useRecentWorkspaces.ts` | Store for recent workspace paths |
| `electron/main.ts` | Add IPC for folder drop handling |
| `src/App.tsx` | Integrate WelcomeScreen and DropZone |
| `src/components/Sidebar.tsx` | Enhanced empty state |
| `src/components/ImportWizard.tsx` | Add quickImport mode |

#### 4.6 Task Checklist

**Welcome Screen:**
- [ ] Create `WelcomeScreen.tsx` with logo, title, action buttons
- [ ] Add "Open Workspace" action
- [ ] Add "Import from Obsidian" action
- [ ] Add "Import from Notion" action
- [ ] Create `useRecentWorkspaces` store
- [ ] Show recent workspaces list
- [ ] Persist recent workspaces to localStorage

**Drag-Drop:**
- [ ] Add drag-drop event handlers to App.tsx
- [ ] Create `DropZone.tsx` with visual overlay
- [ ] Add IPC handler for folder path from drop event
- [ ] Implement source type detection for dropped folders
- [ ] Create `ImportDetectionDialog.tsx` component
- [ ] Handle "Quick Import" choice
- [ ] Handle "Customize Import" choice (opens full wizard)
- [ ] Handle "Open Without Import" choice

**Quick Import:**
- [ ] Add `quickImport` prop to `ImportWizard`
- [ ] Define default options for Obsidian quick import
- [ ] Define default options for Notion quick import
- [ ] Skip options step in quick mode
- [ ] Add toggle between Quick/Custom in detection dialog

**Empty State:**
- [ ] Enhance Sidebar empty state with import options
- [ ] Add drag-drop hint text
- [ ] Style import action links

### Phase 5: Single File Import Flow

**Goal**: Smooth import for .docx and compatible .md

Tasks:
- [ ] Add import prompt for compatible .md files
- [ ] Improve .docx import with better styling preservation
- [ ] Add progress indicator for single imports
- [ ] Create "Import to Midlight" context menu action

### Phase 6: Media Integration

**Goal**: Preview and embed images/PDFs

Tasks:
- [ ] Image preview panel
- [ ] PDF preview (first page at minimum)
- [ ] Drag-to-embed in documents
- [ ] Image optimization on embed

### Phase 7: Export Options

**Goal**: Export to common formats

Tasks:
- [ ] Export to Word (.docx)
- [ ] Export to PDF (styled)
- [ ] Export to HTML
- [ ] Bulk export (folder → zip)

---

## Part 10: Success Metrics

### User Experience Goals

1. **Recognition**: Users should instantly understand which files are "native"
2. **Guidance**: File browser should guide users to correct workflows
3. **No Confusion**: Clear distinction between open, import, and preview
4. **No Clutter**: System files hidden, clean interface maintained
5. **Easy Migration**: Users can import entire Obsidian vault or Notion workspace in <5 minutes

### Technical Goals

1. **Performance**: Category detection adds <10ms to directory load
2. **Reliability**: Graceful fallback if `.midlight` corrupted/missing
3. **Compatibility**: 95%+ of standard Markdown files render correctly
4. **Fidelity**: .docx import preserves 90%+ of formatting

### Bulk Import Goals

1. **Obsidian**: 99% of wiki-links correctly converted
2. **Obsidian**: Front-matter, callouts, and highlights preserved
3. **Notion**: 100% of files renamed without UUID suffixes
4. **Notion**: All internal links work after import
5. **Both**: Progress indication for imports >10 files
6. **Both**: Clear reporting of any issues or data loss

---

## Appendix: Icon Recommendations

Using lucide-react icons (already in project):

| Category | Icon | Alternative |
|----------|------|-------------|
| Native Midlight | `FileText` with accent | Custom brand icon |
| Compatible MD | `FileText` | `FileCode` |
| Importable (.docx) | `FileInput` | `FileText` + badge |
| Image | `Image` | - |
| PDF | `FileText` | `File` |
| Unsupported | `File` | `FileQuestion` |
| Folder | `Folder` / `FolderOpen` | - |

Consider creating a custom Midlight document icon for native files to reinforce brand identity and make native files instantly recognizable.

---

## Appendix B: Competitive Analysis - Import Features

### How Other Apps Handle Import

| App | Obsidian Import | Notion Import | Approach |
|-----|-----------------|---------------|----------|
| **Craft** | Manual copy/paste | Manual | No dedicated import |
| **Bear** | Wiki-link support | No | Opens Obsidian files natively |
| **Ulysses** | Markdown import | No | Batch import, loses links |
| **Notion** | N/A | N/A | Has export, competitors import |
| **Logseq** | Compatible | Export only | Uses same wiki-link format |
| **Capacities** | Import wizard | No | Dedicated Obsidian importer |

### Opportunity

Most competitors either:
1. Don't offer import (expect users to copy/paste)
2. Offer basic import (loses formatting/links)
3. Are compatible by default (Logseq uses same format as Obsidian)

**Midlight can differentiate** by offering the best import experience:
- One-click import with intelligent conversion
- Clear progress and reporting
- Minimal data loss with transparent warnings
- Works for both Obsidian AND Notion (rare)

---

## Appendix C: Import Edge Cases

### Obsidian Edge Cases

| Scenario | How to Handle |
|----------|---------------|
| Circular wiki-links | Works fine (A→B, B→A) |
| Self-referential links | Convert to anchor link |
| Links to non-existent files | Keep as-is, warn user |
| Deeply nested folders (>5 levels) | Preserve structure |
| Very long filenames | Truncate to 200 chars |
| Special characters in filenames | URL-encode in links |
| Duplicate filenames in different folders | Preserve with folder context |
| Files with no extension | Treat as markdown if text |
| Binary files in vault | Copy to attachments, ignore content |
| Obsidian canvas files (.canvas) | Skip with warning (not supported) |
| Excalidraw files | Skip with warning |
| Dataview inline queries | Remove, add warning |

### Notion Edge Cases

| Scenario | How to Handle |
|----------|---------------|
| UUID conflicts after stripping | Add (1), (2) suffix |
| Multiple "Untitled" pages | Number them or prompt user |
| Empty pages | Option to skip |
| Pages with only images | Import as image gallery |
| Database views | Import as separate tables |
| Linked databases | Convert to regular table |
| Toggle headings | Convert to regular headings |
| Synced blocks | Convert to regular content |
| Page mentions | Convert to links |
| Date mentions | Convert to text |
| Inline code vs code blocks | Preserve formatting |
| Gallery views | Convert to image list |
| Board views | Convert to task list (if possible) |

---

## Appendix D: Sample Import Code Snippets

### Detecting Source Type

```typescript
async function detectSourceType(folderPath: string): Promise<'obsidian' | 'notion' | 'generic'> {
  const contents = await fs.readdir(folderPath);

  // Check for Obsidian vault
  if (contents.includes('.obsidian')) {
    return 'obsidian';
  }

  // Check for Notion export (UUID patterns in filenames)
  const hasUUIDs = contents.some(name =>
    /\s[a-f0-9]{32}\.(md|csv)$/i.test(name)
  );
  if (hasUUIDs) {
    return 'notion';
  }

  return 'generic';
}
```

### Front-matter Parser

```typescript
interface FrontMatter {
  title?: string;
  tags?: string[];
  created?: string;
  modified?: string;
  aliases?: string[];
  [key: string]: unknown;
}

function parseFrontMatter(content: string): { frontMatter: FrontMatter | null; content: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

  if (!match) {
    return { frontMatter: null, content };
  }

  try {
    const frontMatter = yaml.parse(match[1]) as FrontMatter;
    return { frontMatter, content: match[2] };
  } catch {
    return { frontMatter: null, content };
  }
}
```

### Callout Converter

```typescript
function convertCallouts(content: string): string {
  // Obsidian: > [!NOTE] Title
  // Convert to styled blockquote

  const calloutRegex = /^> \[!(\w+)\](?: (.+))?\n((?:> .*\n?)*)/gm;

  return content.replace(calloutRegex, (match, type, title, body) => {
    const cleanBody = body.replace(/^> ?/gm, '').trim();
    const titlePart = title ? `**${title}**\n\n` : '';

    // Return as blockquote with type indicator
    // This can be styled differently via .midlight metadata
    return `> **${type.toUpperCase()}**\n> ${titlePart}${cleanBody.split('\n').join('\n> ')}\n`;
  });
}
```
