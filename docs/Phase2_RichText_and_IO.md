<!-- @mid:h-35igr6 -->
# Phase 2: Rich Text, Typography, and I/O Implementation Plan

<!-- @mid:p-aunbvw -->
This document outlines the architectural approach for adding advanced formatting (Fonts, Alignment, Size) and robust Import/Export capabilities (DOCX, PDF) to Midlight.

<!-- @mid:p-nfpcv5 -->
**STATUS:**** ✅ ****COMPLETE**** (Last Updated: 2025-12-05)**

<!-- @mid:list-nqkqt6 -->
- Typography & Fonts: ✅ Complete
- Editor Extensions: ✅ Complete (all controls implemented)
- Advanced Text Formatting: ✅ Complete (underline, color, highlight)
- Import/Export: ✅ Complete (DOCX import with images, export with full formatting)
- Nested Lists: ✅ Complete (recursive processing with proper indentation)
- Horizontal Rules: ✅ Complete (toolbar button + DOCX export)
- Async DOCX Export: ✅ Complete (worker thread + progress UI)
- Print CSS: ✅ Complete

<!-- @mid:h-yuzv23 -->
## 1. Architecture & Strategy

<!-- @mid:p-7z3tjv -->
**### A. Typography & Consistency ✅ ****COMPLETE****
To ensure cross-platform consistency (Windows/Mac/Linux) without relying on user-installed fonts, we will ****bundle open-source fonts**** directly into the application.**

<!-- @mid:p-n7vvx5 -->
*`   `**`Strategy:`**` "Bundled Assets" ✅ `**`IMPLEMENTED`**`*`**` (via @fontsource npm packages)
`**`   `**`Implementation:`**`*`**`
    `**`*`**`   ✅ Font files bundled via @fontsource (imported in `**`src/main.tsx:5-24`**`)
    `**`*`**`   ✅ @font-face rules handled by @fontsource automatically
    `**`*`**`   ✅ Configure Tailwind/Tiptap to use these specific font families (`**`tailwind.config.js:20-24`**`)
    `**`   `**`Selection:`**` ✅ `**`EXPANDED`**`*`**` (10 fonts total)
        `**`   `**`Sans:`**`*`**` Inter, Lato, Open Sans, Roboto
        `**`   `**`Serif:`**`*`**` Merriweather, Lora, Crimson Text, Playfair Display
        `**`   `**`Mono:`**`*`**` JetBrains Mono, Fira Code
    `**`   `**`Note:`**`*`**` Using @fontsource is superior to local bundling for maintenance`*

<!-- @mid:p-zuzfcf -->
**### B. Editor State & Extensions ✅ ****COMPLETE****
We will extend the Tiptap engine to handle new attributes.**

<!-- @mid:p-h2yx5a -->
*`   ✅ `**`Alignment:`**`*`**` `**`@tiptap/extension-text-align`**` (Left, Center, Right, Justify) - `**`Editor.tsx:49-51`**`
`**`   ✅ `**`Font Family:`**`*`**` `**`@tiptap/extension-font-family`**` + `**`TextStyle`**` - `**`Editor.tsx:52-53`**`
`**`   ✅ `**`Font Size:`**`*`**` Custom `**`FontSize`**` extension created (`**`src/components/extensions/FontSize.ts`**`) - `**`Editor.tsx:7,55`**`
    `**`*`**`   ✅ Full UI controls implemented (`**`FontSizeDropdown.tsx`**`)
    `**`*`**`   ✅ Preset sizes: 10px, 12px, 14px, 16px, 18px, 20px, 24px, 28px, 32px
    `**`*`**`   ✅ Custom size input (1-200px range with validation)
    `**`*`**`   ✅ Displays actual computed font sizes from DOM
    `**`*`**`   ✅ Proportional scaling when changing block types (`**`BlockTypeDropdown.tsx:10-50`**`)
`**`   ✅ `**`UI Update:`**`*`**`
    `**`   ✅ `**`Fixed Toolbar`**`*`**` fully implemented with alignment, font family, font size, block types (`**`EditorToolbar.tsx`**`)
    `**`   ⚠️ `**`Floating Menu`**`*`**` partially implemented (intentionally deferred):
        `**`*`**`   ✅ Image bubble menu (`**`ImageWrapMenu.tsx`**`) for image-specific controls
        `**`*`**`   ⏸️ Text selection floating menu (Bold/Italic/Size) - Deferred per user decision (toolbar sufficient)`*

<!-- @mid:h-2nrspi -->
### C. Import/Export Pipeline

<!-- @mid:p-dvgl2z -->
***`#### 1. DOCX Import (Read) ✅ `******`COMPLETE WITH IMAGES`******`
`******`   `******`Library:`******`*`******` `******`mammoth.js`******` v1.11.0 ✅ INSTALLED
`******`   `******`Why:`******` It is lightweight, JS-only, and focuses on extracting `******`semantic value`******`*`******` (Headings, Lists) rather than pixel-perfect layout, which fits our Markdown/Tiptap philosophy perfectly.
`******`   `******`Flow:`******` ✅ `******`IMPLEMENTED`******`*`******` (Updated 2025-12-05)
    `******`*`******`   User clicks "Import DOCX..." in File menu
    `******`*`******`   Main Process reads buffer and extracts original filename (`******`main.ts:230-269`******`)
    `******`*`******`   `******`mammoth.convertToHtml`******` converts to HTML with `******`convertImage`******` option
    `******`*`******`   Images converted to base64 data URLs via `******`mammoth.images.imgElement()`******`
    `******`*`******`   If workspace is open:
        `******`*`******`   HTML converted to Markdown via `******`htmlToMarkdown()`******`
        `******`*`******`   New `******`.md`******` file created in workspace root with original filename
        `******`*`******`   File automatically opened in editor
        `******`*`******`   Sidebar refreshes to show new file
    `******`*`******`   If no workspace: Falls back to inserting into current editor
`******`   `******`Image Support:`******` ✅ `******`IMPLEMENTED`******`*`******` (2025-12-05)
    `******`*`******`   PNG, JPEG, GIF images converted to base64 data URLs
    `******`*`******`   Images become editable/resizable in the editor
    `******`*`******`   Full round-trip support (import → edit → export)`***

<!-- @mid:p-c1hv2z -->
***`#### 2. DOCX Export (Write) ✅ `******`COMPLETE`******`
`******`   `******`Libraries:`******`*`******`
    `******`*`******`   `******`docx`******` v9.5.1 ✅ INSTALLED + Modular Helper System ✅ CREATED
    `******`*`******`   `******`turndown`******` ✅ INSTALLED (HTML → Markdown conversion)
    `******`*`******`   `******`marked`******` ✅ INSTALLED (Markdown → HTML parsing)
    `******`*`******`   `******`react-colorful`******` ✅ INSTALLED (Color picker UI, 2.2kb gzipped)
`******`   `******`Why:`******`*`******` Generic HTML-to-DOCX converters often produce "messy" Word docs. The `******`docx`******` library allows us to programmatically build a clean Word document (Node -> Paragraph -> Run) from our Tiptap JSON.
`******`   `******`Architecture:`******`*`******` Modular helper file structure in `******`electron/docx-helpers/`******`:
    `******`*`******`   `******`types.ts`******` - TypeScript interfaces for Tiptap JSON structure
    `******`*`******`   `******`converters.ts`******` - Unit conversions (px→half-points, alignment mapping, font fallbacks)
    `******`*`******`   `******`text-processors.ts`******` - TextRun creation with full formatting
    `******`*`******`   `******`paragraph-processors.ts`******` - Paragraph and heading creation
    `******`*`******`   `******`image-processors.ts`******` - Base64 image embedding with alignment
`******`   `******`Flow:`******` ✅ `******`IMPLEMENTED`******`*`******` (`******`electron/docx-transformer.ts`******` + helpers, `******`main.ts:272-286`******`)
    `******`*`******`   Tiptap JSON -> Modular Transformer -> `******`docx`******` Object Model -> Buffer -> Write File
`******`   `******`Full Feature Support:`******`*`******`
    `******`   ✅ Paragraphs with text styling (bold, italic, strike, code, `******`underline`******`, `******`color`******`, `******`highlight`******`*`******`)
    `******`*`******`   ✅ Headings (H1, H2, H3) with custom font sizes and black color (overrides Word's blue)
    `******`   ✅ `******`Font family preservation`******`*`******` with Word-compatible fallbacks (Inter→Arial, Merriweather→Georgia, etc.)
    `******`   ✅ `******`Font size preservation`******`*`******` with 1:1 px→pt mapping (14px→14pt, 16px→16pt, etc.)
    `******`   ✅ `******`Text alignment preservation`******`*`******` (left, center, right, justify)
    `******`   ✅ `******`Text color preservation`******`*`******` with RGB hex color export
    `******`   ✅ `******`Highlight color preservation`******`*`******` with mapping to Word's highlight palette
    `******`   ✅ `******`Underline formatting`******`*`******` with single underline export
    `******`   ✅ `******`Image embedding`******`*`******` with base64-to-buffer conversion, proper MIME type detection, and alignment
    `******`*`******`   ✅ Bullet/ordered lists with formatting preservation
    `******`   ✅ `******`Nested list support`******`*`******` with recursive processing (up to 9 levels)
    `******`*`******`   ✅ Numbering configuration for ordered lists with level-specific formats (1. → a. → i.)
    `******`*`******`   ✅ Proper indentation for nested lists (720 twips per level)
    `******`   ✅ `******`Horizontal rules`******`*`******` exported as paragraph with bottom border`***

<!-- @mid:p-txuzx1 -->
***`#### 3. PDF Export (Write) ✅ `******`COMPLETE`******`
`******`   `******`Library:`******`*`******` Electron's native `******`webContents.printToPDF()`******` ✅ IMPLEMENTED
`******`   `******`Why:`******`*`******` It uses the Chromium rendering engine. If it looks good in the app, it will look identical in the PDF. It handles fonts and CSS print media queries automatically.
`******`   `******`Flow:`******` ✅ `******`IMPLEMENTED`******`*`******` (`******`main.ts:247-270`******`)
    `******`*`******`   "Export to PDF" menu action
    `******`*`******`   `******`win.webContents.printToPDF({ printBackground: true, pageSize: 'A4', margins: {...} })`******`
    `******`*`******`   Apply `******`@media print`******` CSS (`******`index.css:295-334`******`)
    `******`*`******`   Save PDF to user-selected location
`******`   `******`Print CSS Features:`******`*`******`
    `******`*`******`   ✅ Hides UI elements (sidebar, toolbar, buttons)
    `******`*`******`   ✅ Resets layout for clean print
    `******`*`******`   ✅ White background, black text
    `******`*`******`   ✅ Theme-specific prose typography overrides`***

---

<!-- @mid:h-ohvmpc -->
## 2. Implementation Steps

<!-- @mid:h-d2lzj9 -->
### **Step 1: Advanced Typography (The Editor) ✅ ****COMPLETE**

<!-- @mid:list-nq5lm3 -->
1. ✅ **Asset Management:** Fonts bundled via @fontsource (`src/main.tsx:5-24`)
2. ✅ **CSS Configuration:** @font-face handled by @fontsource; Tailwind extended (`tailwind.config.js:20-24`)
3. ✅ **Tiptap Config:**
*   ✅ Installed and registered `@tiptap/extension-text-align`, `@tiptap/extension-font-family`, `@tiptap/extension-text-style` (`Editor.tsx:49-53`)
*   ✅ Created custom `FontSize` extension (`src/components/extensions/FontSize.ts`) - `Editor.tsx:7,55`
4. ✅ **UI Components:**
*   ✅ Alignment buttons/toggle group (`EditorToolbar.tsx:138-174`)
*   ✅ `FontFamilyDropdown` component (`FontFamilyDropdown.tsx`)
*   ✅ `FontSizeDropdown` component with advanced features (`FontSizeDropdown.tsx`):
    *   Preset sizes (10-32px)
    *   Custom size input (1-200px with validation)
    *   Displays actual computed font size using `window.getComputedStyle()`
    *   Reset functionality
*   ✅ `BlockTypeDropdown` enhanced with proportional font scaling (`BlockTypeDropdown.tsx:10-50`)
*   ✅ EditorToolbar fully integrated (`EditorToolbar.tsx:15,92`)

<!-- @mid:h-0d2r3u -->
### **Step 2: DOCX Import Logic ✅ ****COMPLETE**

<!-- @mid:list-xtvdv9 -->
1. ✅ **Install:** `mammoth` v1.11.0 installed
2. ✅ **IPC Handler:** `import-docx` handler created (`electron/main.ts:230-245`)
3. ✅ **Logic:**
*   ✅ Read file buffer via dialog
*   ✅ Run `mammoth.convertToHtml(buffer)`
*   ✅ Return raw HTML string to Renderer
4. ✅ **Frontend:** Custom event listener `editor:insert-content` in `Editor.tsx:197-217` uses `editor.commands.insertContent(html)`

<!-- @mid:h-dpo4br -->
### **Step 3: DOCX Export Logic ✅ ****COMPLETE WITH FULL FORMATTING**

<!-- @mid:list-3alp2i -->
1. ✅ **Install:** `docx` v9.5.1 installed
2. ✅ **Modular Architecture:** Helper system created in `electron/docx-helpers/`
*   ✅ **types.ts:** TypeScript interfaces for Tiptap JSON (TiptapNode, TiptapMark, TextStyleAttrs)
*   ✅ **converters.ts:** Core conversion utilities
    *   `pxToHalfPoints()` - 1:1 px→pt mapping (14px→28 half-points→14pt)
    *   `tiptapAlignToDocx()` - Maps left/center/right/justify to AlignmentType enum
    *   `extractFontName()` - Extracts font name and maps to Word-compatible fallbacks
    *   `FONT_FALLBACK_MAP` - Inter→Arial, Merriweather→Georgia, JetBrains Mono→Courier New
*   ✅ **text-processors.ts:** TextRun creation with full formatting
    *   `createTextRun()` - Handles bold, italic, strike, code, fontSize, fontFamily, color
    *   `processTextNodes()` - **CRITICAL BUG FIX:** Processes ALL text nodes (not just first)
    *   Defaults to Georgia font (14pt) when no formatting specified
*   ✅ **paragraph-processors.ts:** Paragraph and heading creation
    *   `createParagraph()` - Creates paragraphs with alignment and formatted text
    *   `createHeading()` - Creates headings with level-specific default sizes (H1=32pt, H2=24pt, H3=20pt)
    *   Forces black color on headings (overrides Word's blue default)
*   ✅ **image-processors.ts:** Image embedding utilities
    *   `base64ToBuffer()` - Converts data URLs to Buffer for DOCX
    *   `extractImageType()` - Detects MIME type (png, jpg, gif, bmp)
    *   `parseDimension()` - Parses px/% dimensions with validation
    *   `createImageParagraph()` - Creates ImageRun with proper type specification
*   ✅ **list-processors.ts:** Recursive list processing (added 2025-12-05)
    *   `processListItem()` - Handles individual list items with nested list support
    *   `processBulletList()` - Processes bullet lists at any nesting level
    *   `processOrderedList()` - Processes ordered lists with level-specific numbering
3. ✅ **Main Transformer:** `electron/docx-transformer.ts` orchestrates all helpers
*   ✅ Handles paragraphs, headings, lists, images, horizontal rules
*   ✅ Includes numbering configuration for ordered lists (9 levels with indentation)
*   ✅ Error handling with try-catch per node
4. ✅ **Export Trigger:**
*   Menu action "Export to DOCX..."
*   Custom event `editor:export-request`
*   Editor calls `editor.getJSON()` (`Editor.tsx:221-241`)
*   IPC call `exportDocx(json)`
*   Main saves to disk (`main.ts:272-286`)

<!-- @mid:h-i53k8w -->
### **Step 4: PDF Export Logic ✅ ****COMPLETE**

<!-- @mid:list-xa5yvz -->
1. ✅ **IPC Handler:** `export-pdf` created (`electron/main.ts:247-270`)
2. ✅ **Logic:**
*   ✅ `win.webContents.printToPDF({ printBackground: true, pageSize: 'A4', margins: {...} })`
*   ✅ Write buffer to user-selected path via save dialog
3. ✅ **Print CSS:** Comprehensive `@media print` styles in `index.css:295-334`
*   ✅ Hides Sidebar, Toolbar, TitleBar, and draggable elements
*   ✅ Resets layout (removes overflow, padding, flex)
*   ✅ Ensures black text on white background
*   ✅ Preserves prose typography with theme-specific overrides

---

<!-- @mid:h-3ixifg -->
## 3. Risk Mitigation

<!-- @mid:p-5k391i -->
*   ✅ **Font Loading:***** Fonts are loaded via @fontsource at app startup. Electron handles this well. No layout shifts observed in PDF generation.
**   ✅ **Font Compatibility:***** Web fonts mapped to Word-compatible system fonts to ensure proper rendering:
    *****   Sans-serif fonts (Inter, Roboto, Open Sans, Lato) → Arial
    *****   Serif fonts (Merriweather, Crimson Text, Lora, Playfair Display) → Georgia
    *****   Monospace fonts (JetBrains Mono, Fira Code) → Courier New
**   ✅ **Image Handling in DOCX:*****
    **   **Import:***** Text-only import implemented (images deferred as planned)
    **   **Export:** ✅ **COMPLETE***** - Base64 image embedding with proper MIME type detection (png, jpg, gif, bmp)
    **   **Validation:***** Dimension clamping (1-2000px) and error handling for corrupt images
**   ✅ **Performance:***** Large DOCX exports now use async worker thread with progress UI (implemented 2025-12-05)
**   ✅ **DOCX Corruption Prevention:*****
    *****   Font size validation (2-400 half-points)
    *****   Image dimension validation (1-2000px)
    *****   Numbering configuration for ordered lists (prevents Word errors)*

---

<!-- @mid:h-j64h47 -->
## 4. Implementation Status Summary

<!-- @mid:h-4lngne -->
### ✅ Fully Implemented

<!-- @mid:list-9dckhu -->
- **Typography system (10 bundled fonts via @fontsource)**
- Inter, Roboto, Open Sans, Lato (sans-serif)
- Merriweather, Lora, Crimson Text, Playfair Display (serif)
- JetBrains Mono, Fira Code (monospace)
- **Tailwind configuration**
- Font families configured
- Default font: Merriweather (serif)
- Default size: 14px
- **Text alignment extension and UI controls**
- Left, center, right, justify support
- Integrated into EditorToolbar
- **Font family extension and dropdown picker**
- Shows "Merriweather" as default (instead of generic "Font")
- Live preview on hover
- **Font size extension and advanced dropdown controls:**
- Custom FontSize Tiptap extension (`src/components/extensions/FontSize.ts`)
- FontSizeDropdown component with presets (10-32px) and custom input (1-200px)
- Displays actual computed font sizes from DOM using `window.getComputedStyle()`
- Proportional scaling when changing block types (maintains size relationships)
- Default: 14px (was 16px, changed to 14px for better readability)
- **DOCX Import** ✅ **WITH IMAGES** (2025-12-05)
- Full import with mammoth.js including embedded images
- Images converted to base64 data URLs
- Preserves headings, lists, and basic formatting
- **DOCX Export (Full Implementation)** ✅ **COMPLETE**
- Modular helper system (`electron/docx-helpers/`)
- Font family preservation with Word-compatible fallbacks
- Font size preservation with 1:1 px→pt mapping
- Text alignment preservation
- Image embedding (base64 with proper MIME types)
- Heading customization (black color, level-specific sizes)
- List support with numbering configuration
- **Nested list support** with recursive processing and proper indentation (2025-12-05)
- **Horizontal rule support** exported as paragraph with bottom border (2025-12-05)
- **RGB color normalization** - converts `rgb(r,g,b)` to hex for DOCX compatibility (2025-12-05)
- **Critical bug fix:** All text nodes processed (not just first)
- **PDF Export**
- Electron printToPDF with print CSS
- Theme-aware output
- **All IPC handlers and preload API**

<!-- @mid:h-2pkvq2 -->
### ✅ Advanced Text Formatting (IMPLEMENTED - 2025-12-04)

<!-- @mid:list-e1x5cv -->
- **Underline formatting** (`Underline.ts` extension)
- **Text color picker** with full color wheel, presets, and custom hex input
- **Highlight color picker** with toggle button, color palette, and custom picker
- **Recent colors feature** with localStorage persistence (up to 8 colors per picker)
- **Custom Code extension** without input rules (prevents backtick insertion issues)
- **Selection visibility improvements** with custom CSS for better contrast

<!-- @mid:h-moyxr3 -->
### ⏸️ Intentionally Deferred (Per User Decision)

<!-- @mid:list-9toyib -->
- Text selection floating/bubble menu (toolbar is sufficient for current needs)

<!-- @mid:h-tk85ga -->
### 🎯 Next Steps (Priority Order)

<!-- @mid:p-7g5gai -->
**Phase 2 Core Features:**** ✅ ****COMPLETE**

<!-- @mid:p-122jtp -->
All essential rich text editing and DOCX export features have been successfully implemented, including advanced text formatting added on 2025-12-04.

<!-- @mid:p-isi408 -->
**Completed Features (2025-12-04):**

<!-- @mid:list-csum7h -->
- ✅ Underline formatting with DOCX export
- ✅ Text color picker with full color wheel, presets, and recent colors
- ✅ Highlight color picker with palette view and custom picker
- ✅ Recent colors tracking (localStorage, up to 8 per picker)
- ✅ Custom markdown conversion system (replaced tiptap-markdown)
- ✅ CSS fixes for inline code backticks and selection visibility

<!-- @mid:p-9h6ju6 -->
**Completed Features (2025-12-05):**

<!-- @mid:list-c121o7 -->
- ✅ Nested list support in DOCX export with recursive processing
- ✅ Proper list indentation (720 twips = 0.5 inch per level)
- ✅ Level-specific numbering formats (1. → a. → i. repeating pattern)
- ✅ CSS styling for nested ordered lists in editor (decimal → lower-alpha → lower-roman)
- ✅ RGB to hex color normalization for DOCX compatibility
- ✅ Horizontal rule toolbar button (Minus icon)
- ✅ Horizontal rule DOCX export (paragraph with bottom border)
- ✅ **Image import from DOCX** - images converted to base64 data URLs via mammoth.js
- ✅ **DOCX import creates new file** - imported content saved as new .md file in workspace
- ✅ **Async DOCX export** - worker thread with progress UI for non-blocking exports

<!-- @mid:p-2cyrsv -->
**Notes:**

<!-- @mid:list-oxh5uv -->
- Text selection floating menu was evaluated and intentionally deferred as the fixed toolbar provides sufficient functionality
- Font family/size/alignment preservation ✅ **COMPLETE**
- Image embedding in DOCX export ✅ **COMPLETE**
- Image import from DOCX ✅ **COMPLETE** (2025-12-05)
- Advanced text formatting (underline/color/highlight) ✅ **COMPLETE** (2025-12-04)

---

<!-- @mid:h-eb1peu -->
## 5. Font Size Implementation Details

<!-- @mid:p-79g256 -->
The font size feature includes several advanced capabilities beyond basic size selection:

<!-- @mid:p-wxom3e -->
`### Custom FontSize Extension
Created a custom Tiptap extension (``src/components/extensions/FontSize.ts``) due to package version conflicts:`

<!-- @mid:list-1baxb3 -->
- Adds `fontSize` attribute to `TextStyle` mark
- Provides `setFontSize(size)` and `unsetFontSize()` commands
- Parses and renders font-size CSS inline styles

<!-- @mid:p-k2jd1f -->
**`### FontSizeDropdown Component (`****`src/components/FontSizeDropdown.tsx`****`)
`****`Features:`**

<!-- @mid:list-blqjzh -->
- **Preset Sizes:** 10px, 12px, 14px, 16px (default), 18px, 20px, 24px, 28px, 32px
- **Custom Input:** 1-200px range with validation, keyboard shortcuts (Enter/Escape)
- **Smart Display:** Uses `window.getComputedStyle()` to display actual rendered font size
- Shows "32" for H1, "24" for H2, "20" for H3, "16" for paragraph
- Shows actual custom size if user has set one
- Shows "Mixed" if selection contains multiple sizes
- **Reset Functionality:** Removes custom fontSize attribute

<!-- @mid:p-jv96de -->
**Key Implementation:**

<!-- @mid:code-gvtqeo -->
```typescript
const getComputedFontSize = (): string => {
  const { from } = editor.state.selection;
  const domAtPos = editor.view.domAtPos(from);
  const element = /* find closest element node */;
  const computedStyle = window.getComputedStyle(element);
  return Math.round(parseFloat(computedStyle.fontSize)).toString();
};
```

<!-- @mid:p-5em2fp -->
**`### Proportional Font Scaling (`****`BlockTypeDropdown.tsx`****`)
`****`Problem:`****` When a user sets a custom font size and then changes block type (e.g., paragraph → H1), the size should scale proportionally, not reset or stay the same.`**

<!-- @mid:p-npt3tu -->
**Solution:**** Implemented ratio-based scaling that maintains user intent:**

<!-- @mid:code-x5717f -->
```typescript
const DEFAULT_SIZES = {
  paragraph: 16, h1: 32, h2: 24, h3: 20
};

const getScaledFontSize = (editor, targetType) => {
  const currentSize = /* current custom size */;
  const currentType = /* detect current block type */;

  const ratio = DEFAULT_SIZES[targetType] / DEFAULT_SIZES[currentType];
  const scaledSize = Math.round(currentSize * ratio);

  return `${scaledSize}px`;
};
```

<!-- @mid:p-25z1u3 -->
**Example Scaling:**

<!-- @mid:list-7ul412 -->
- Paragraph at 20px → H1 scales to 40px (20 × 32/16 = 40)
- H1 at 40px → H2 scales to 30px (40 × 24/32 = 30)
- H2 at 30px → Paragraph scales to 20px (30 × 16/24 = 20)

<!-- @mid:p-k3we35 -->
This preserves the user's intention to have "larger than default" or "smaller than default" text across block type changes.

---

<!-- @mid:h-vm30ft -->
## 6. DOCX Export Implementation Details

<!-- @mid:p-lg0r2s -->
The DOCX export system uses a modular architecture that transforms Tiptap JSON to Word documents while preserving all formatting.

<!-- @mid:h-ogka3z -->
### Architecture: Modular Helper System

<!-- @mid:p-6qgamc -->
`Instead of a monolithic transformer, the implementation uses specialized helper modules in ``electron/docx-helpers/``:`

<!-- @mid:p-2qegjt -->
**File Structure:**

<!-- @mid:code-kaxs62 -->
```
electron/
├── docx-transformer.ts          # Main orchestrator (fallback, sync)
├── docx-worker.ts               # Async worker thread (added 2025-12-05)
└── docx-helpers/
    ├── types.ts                 # TypeScript interfaces
    ├── converters.ts            # Unit conversions & mappings
    ├── text-processors.ts       # TextRun creation
    ├── paragraph-processors.ts  # Paragraph/heading creation
    ├── image-processors.ts      # Image embedding
    └── list-processors.ts       # Recursive list processing (added 2025-12-05)

src/
├── components/
│   └── ExportProgress.tsx       # Progress modal UI (added 2025-12-05)
└── store/
    └── useExportStore.ts        # Export state management (added 2025-12-05)
```

<!-- @mid:h-vd5567 -->
### Key Design Decisions

<!-- @mid:p-nawzg8 -->
**#### 1. Font Compatibility Strategy
****Problem:**** Web fonts (Inter, Merriweather, etc.) loaded via @fontsource aren't installed system-wide on the user's computer. When Word opens the DOCX and can't find "Inter", it falls back to a default font that may not match the intended style.**

<!-- @mid:p-zh02j9 -->
**`Solution:`****` `****`FONT_FALLBACK_MAP`****` in `****`converters.ts`****` maps web fonts to universally-available system fonts:`**

<!-- @mid:code-jnrcbe -->
```typescript
const FONT_FALLBACK_MAP = {
  'Inter': 'Arial',           // Sans-serif group
  'Roboto': 'Arial',
  'Open Sans': 'Arial',
  'Lato': 'Arial',
  'Merriweather': 'Georgia',  // Serif group
  'Crimson Text': 'Georgia',
  'Lora': 'Georgia',
  'Playfair Display': 'Georgia',
  'JetBrains Mono': 'Courier New',  // Monospace group
  'Fira Code': 'Courier New',
};
```

<!-- @mid:p-yqz5r3 -->
**Result:**** Inter text exports as Arial (clean sans-serif), Merriweather as Georgia (classic serif), maintaining visual consistency.**

<!-- @mid:p-o1ww8q -->
**#### 2. Font Size Conversion: 1:1 Parity
****Problem:**** Browsers measure in pixels (px), Word measures in points (pt). Traditional conversion (96 DPI standard) causes confusion: 16px → 12pt makes the numbers inconsistent.**

<!-- @mid:p-5m0y05 -->
**Solution:**** Use 1:1 mapping for intuitive number parity:**

<!-- @mid:code-khu8jl -->
```typescript
export function pxToHalfPoints(px: string): number {
  const numericValue = parseFloat(px);
  const halfPoints = Math.round(numericValue * 2);
  // 14px → 28 half-points → 14pt in Word
  // User sees "14" in editor, sees "14pt" in Word
  return halfPoints;
}
```

<!-- @mid:p-nkxvj9 -->
**Benefits:**

<!-- @mid:list-uqhzdx -->
- What you see is what you get (WYSIWYG)
- 14px in editor = 14pt in Word
- No mental math required for users

<!-- @mid:p-eizqak -->
**#### 3. Critical Bug Fix: Multiple Text Runs
****Original Bug:**** Only the first text node in a paragraph was exported:**

<!-- @mid:code-o72d2p -->
```typescript
// BROKEN CODE (original implementation)
text: node.content?.[0]?.text || ''  // Only reads first node!
```

<!-- @mid:p-trsqap -->
**If a paragraph had mixed formatting like "****Hello**** _world_", only "Hello" would export.**

<!-- @mid:p-shit6d -->
**`Fix:`****` `****`processTextNodes()`****` function iterates ALL text nodes:`**

<!-- @mid:code-b3qhrv -->
```typescript
export function processTextNodes(nodes: TiptapNode[]): TextRun[] {
  return nodes
    .filter(node => node.type === 'text')
    .map(node => createTextRun(node));  // Each node becomes a TextRun
}
```

<!-- @mid:p-s35lhk -->
**Result:**** All text with all formatting is preserved.**

<!-- @mid:p-9flvkl -->
**#### 4. Heading Customization
****Problem:**** Word's default heading styles use blue color and may not match the app's visual design.**

<!-- @mid:p-438oy3 -->
**`Solution:`****` Override Word defaults in `****`paragraph-processors.ts`****`:`**

<!-- @mid:code-4o1ibw -->
```typescript
export function createHeading(node: TiptapNode): Paragraph {
  const level = node.attrs?.level || 1;
  let defaultSize = 64;  // H1 = 32pt
  if (level === 2) defaultSize = 48;  // H2 = 24pt
  if (level === 3) defaultSize = 40;  // H3 = 20pt

  // Force black color on ALL text runs
  const children = processTextNodes(node.content || [], {
    color: '000000',  // Black, not Word's blue
    defaultSize
  });

  return new Paragraph({
    heading: HeadingLevel[`HEADING_${level}`],
    children
  });
}
```

<!-- @mid:p-svhs1o -->
**Result:**** Headings maintain editor hierarchy (H1 > H2 > H3) with consistent black color.**

<!-- @mid:p-8kfsm7 -->
**#### 5. Image Embedding
****Challenge:**** Tiptap stores images as base64 data URLs. Word requires binary image data with proper format specification.**

<!-- @mid:p-gwyygh -->
**`Solution:`****` Multi-step conversion in `****`image-processors.ts`****`:`**

<!-- @mid:code-hjs1xm -->
```typescript
// 1. Extract base64 data
const imageBuffer = base64ToBuffer(src);  // "data:image/png;base64,..." → Buffer

// 2. Detect image format
const imageType = extractImageType(src);  // → "image/png"
let fileExtension = 'png';
if (imageType === 'image/jpeg') fileExtension = 'jpg';

// 3. Create ImageRun with type specification (fixes Word warnings)
const imageRun = new ImageRun({
  data: imageBuffer,
  type: fileExtension,  // Critical: tells Word the format
  transformation: { width: widthPx, height: heightPx }
});
```

<!-- @mid:p-i1kst5 -->
**Result:**** Images embed cleanly without "unreadable content" warnings.**

<!-- @mid:h-tgb146 -->
### Error Prevention & Validation

<!-- @mid:p-qqfx7s -->
The transformer includes robust validation to prevent DOCX corruption:

<!-- @mid:list-pbtoes -->
1. **Font Size Validation** (`converters.ts:31-35`)

<!-- @mid:code-hb0j60 -->
```typescript
   if (halfPoints < 2) return 2;    // Min 1pt
   if (halfPoints > 400) return 400; // Max 200pt
   
```

<!-- @mid:list-zvfqkg -->
1. **Image Dimension Validation** (`image-processors.ts:77-79`)

<!-- @mid:code-8749j5 -->
```typescript
   if (numericValue < 1) return 1;
   if (numericValue > 2000) return 2000;
   
```

<!-- @mid:list-l4u2ed -->
1. **Numbering Configuration** (`docx-transformer.ts:76-90`)
 - Ordered lists require explicit numbering config
 - Without this, Word shows "experienced an error" on open

<!-- @mid:list-kfrgj7 -->
1. **Per-Node Error Handling** (`docx-transformer.ts:13-68`)

<!-- @mid:code-jq8row -->
```typescript
   for (const node of content.content || []) {
     try {
       // Process node...
     } catch (error) {
       console.error(`Error processing ${node.type}:`, error);
       children.push(new Paragraph({ text: '' }));  // Graceful fallback
     }
   }
   
```

<!-- @mid:h-hcqw39 -->
### Testing Strategy

<!-- @mid:p-jd5m5g -->
`Created ``DOCX_EXPORT_TEST.md`` with comprehensive test cases:`

<!-- @mid:list-csjeba -->
- Mixed formatting in single paragraph (bug fix verification)
- Font families (Inter, Merriweather, JetBrains Mono)
- Font sizes (10px-32px range)
- Text alignment (left, center, right, justify)
- Headings with custom sizes and alignment
- Lists with formatting preservation
- Images with dimensions and alignment
- Edge cases (empty paragraphs, custom sizes on headings)

<!-- @mid:h-jk31g6 -->
### Performance Considerations

<!-- @mid:p-nhvixl -->
**Current Approach:**** ✅ Async Worker Thread (implemented 2025-12-05)**

<!-- @mid:list-kcrk92 -->
- DOCX generation runs in separate worker thread
- Progress UI shows real-time status
- Non-blocking - UI remains responsive
- Handles large documents without freezing

<!-- @mid:p-a9n70o -->
See "Async DOCX Export with Worker Thread" section for implementation details.

---

<!-- @mid:h-yreunt -->
## 7. Advanced Text Formatting Implementation Details (2025-12-04)

<!-- @mid:p-qjofjm -->
### Overview
Implemented comprehensive text formatting capabilities including underline, text color, and background highlighting with full-featured color pickers and recent color tracking.

<!-- @mid:h-w1p2x7 -->
### Extensions Created

<!-- @mid:p-bv0msj -->
`#### 1. Underline Extension (``src/components/extensions/Underline.ts``)
Simple mark extension for underline formatting:`

<!-- @mid:code-diyl67 -->
```typescript
export const Underline = Mark.create({
  name: 'underline',
  parseHTML() {
    return [
      { tag: 'u' },
      { style: 'text-decoration=underline' },
    ];
  },
  renderHTML() {
    return ['u', 0];
  },
  addCommands() {
    return {
      toggleUnderline: () => ({ commands }) => {
        return commands.toggleMark(this.name);
      },
    };
  },
  addKeyboardShortcuts() {
    return {
      'Mod-u': () => this.editor.commands.toggleUnderline(),
    };
  },
});
```

<!-- @mid:p-vvthyu -->
**Features:**

<!-- @mid:list-a74x7m -->
- Toggle via toolbar button
- Keyboard shortcut: Ctrl/Cmd+U
- Serializes to `<u>` tag in HTML
- Exports to DOCX as single underline

<!-- @mid:p-k2l21u -->
`#### 2. TextColor Extension (``src/components/extensions/TextColor.ts``)
Extends TextStyle to support color attribute:`

<!-- @mid:code-w5uwwg -->
```typescript
export const TextColor = Extension.create({
  name: 'textColor',
  addGlobalAttributes() {
    return [{
      types: ['textStyle'],
      attributes: {
        color: {
          default: null,
          parseHTML: element => element.style.color,
          renderHTML: attributes => {
            if (!attributes.color) return {};
            return { style: `color: ${attributes.color}` };
          },
        },
      },
    }];
  },
  addCommands() {
    return {
      setTextColor: (color: string) => ({ chain }) => {
        return chain().setMark('textStyle', { color }).run();
      },
      unsetTextColor: () => ({ chain }) => {
        return chain()
          .setMark('textStyle', { color: null })
          .removeEmptyTextStyle()
          .run();
      },
    };
  },
});
```

<!-- @mid:p-mm93dh -->
**Features:**

<!-- @mid:list-4d59kr -->
- Stores colors as hex codes (#RRGGBB)
- Inline style serialization: `<span style="color: #ff0000">`
- Exports to DOCX with RGB color values

<!-- @mid:p-kve864 -->
`#### 3. TextHighlight Extension (``src/components/extensions/TextHighlight.ts``)
Custom mark for background color highlighting:`

<!-- @mid:code-ls27p5 -->
```typescript
export const TextHighlight = Mark.create({
  name: 'highlight',
  addOptions() {
    return {
      multicolor: true,
    };
  },
  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: element => element.style.backgroundColor,
        renderHTML: attributes => {
          if (!attributes.color) return {};
          return {
            style: `background-color: ${attributes.color}`,
          };
        },
      },
    };
  },
  parseHTML() {
    return [{ tag: 'mark' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['mark', HTMLAttributes, 0];
  },
  addCommands() {
    return {
      setHighlight: (color: string) => ({ commands }) => {
        return commands.setMark(this.name, { color });
      },
      unsetHighlight: () => ({ commands }) => {
        return commands.unsetMark(this.name);
      },
    };
  },
});
```

<!-- @mid:p-h97gbr -->
**Features:**

<!-- @mid:list-275shy -->
- Multi-color highlighting support
- Serializes to `<mark style="background-color: #ffff00">`
- Exports to DOCX (mapped to nearest Word highlight color)

<!-- @mid:p-sel034 -->
**`#### 4. Custom Code Extension (`****`src/components/extensions/CustomCode.ts`****`)
`****`Problem:`****` The default Code extension combined with tiptap-markdown was inserting literal backtick characters into the editor as text.`**

<!-- @mid:p-r1b2bd -->
**Solution:**** Created custom Code extension without input/paste rules:**

<!-- @mid:code-zj0acq -->
```typescript
export const CustomCode = Code.extend({
  addInputRules() {
    return [];  // Disable markdown-style code triggers
  },
  addPasteRules() {
    return [];  // Disable paste conversion
  },
});
```

<!-- @mid:p-qfj3l1 -->
**Configuration:**

<!-- @mid:code-pp14xm -->
```typescript
CustomCode.configure({
  HTMLAttributes: {
    class: 'bg-muted px-1.5 py-0.5 rounded text-sm font-mono',
  },
})
```

<!-- @mid:h-ln2ei0 -->
### UI Components

<!-- @mid:p-3d07is -->
`#### 1. ColorPickerDropdown (``src/components/ColorPickerDropdown.tsx``)
Full-featured text color picker with:`

<!-- @mid:list-ahkl27 -->
- **HexColorPicker** from react-colorful (visual color wheel)
- **Preset colors** (16 professional Tailwind-based colors):
- Grays: Black, Gray 700, Gray 500, Gray 400
- Colors: Red, Orange, Yellow, Green, Cyan, Blue, Violet, Fuchsia, Pink
- Special: Amber (brown), Dark Blue, Dark Red
- **Custom hex input** with validation (`#[0-9A-Fa-f]{6}`)
- **Recent colors** (up to 8 custom colors, excludes presets)
- **Current color indicator** (colored bar under "A" icon)
- **Clear color button**

<!-- @mid:p-rccd60 -->
**Recent Colors Implementation:**

<!-- @mid:code-hoou9c -->
```typescript
const [recentColors, setRecentColors] = useState<string[]>(() => {
  const saved = localStorage.getItem('recentTextColors');
  return saved ? JSON.parse(saved) : [];
});

const addToRecent = (color: string) => {
  const normalized = color.toUpperCase();
  // Don't add if it's already in the preset colors
  if (PRESET_COLORS.map(c => c.toUpperCase()).includes(normalized)) {
    return;
  }
  const updated = [normalized, ...recentColors.filter(c => c !== normalized)].slice(0, 8);
  setRecentColors(updated);
  localStorage.setItem('recentTextColors', JSON.stringify(updated));
};
```

<!-- @mid:p-k98ml5 -->
**Auto-save Recent Colors:**

<!-- @mid:list-8e7xbx -->
- When clicking outside the color picker
- When typing a valid hex code
- When using the color wheel

<!-- @mid:p-14muq3 -->
`#### 2. HighlightPickerDropdown (``src/components/HighlightPickerDropdown.tsx``)
Split-button design with toggle + dropdown:`

<!-- @mid:p-iykwhc -->
**Main Button:**** Toggle highlight on/off**

<!-- @mid:list-4ifqh2 -->
- Shows current highlight color as indicator bar
- Active state when highlight applied

<!-- @mid:p-gwm3eh -->
**Dropdown Button:**** Color selection**

<!-- @mid:list-4l72rl -->
- **Palette View** (default):
- 16 preset highlight colors (bright, light colors)
- Recent colors section (custom colors only)
- "Custom..." option
- "Remove Highlight" button (when active)
- **Custom Picker View**:
- HexColorPicker with color wheel
- Hex input field
- Back button (ChevronLeft icon)
- Centered "Highlight Color" header

<!-- @mid:p-yiapfq -->
**Key Features:**

<!-- @mid:list-kr3epc -->
- Separate storage: `recentHighlightColors`
- Filters out preset colors from recent
- Updates selected color when editor highlight changes
- Auto-saves custom color on dropdown close

<!-- @mid:h-vfpksq -->
### Markdown Conversion System

<!-- @mid:p-zx77uj -->
**Problem:**** The tiptap-markdown extension was showing markdown syntax (backticks, etc.) as literal text in the editor instead of applying formatting.**

<!-- @mid:p-smfile -->
**Solution:**** Replace tiptap-markdown with custom HTML ↔ Markdown conversion:**

<!-- @mid:p-oyl4sl -->
**`#### Created `****`src/utils/markdown.ts`****`
`****`Libraries:`**

<!-- @mid:list-g0t7cl -->
- `turndown` - HTML → Markdown conversion
- `marked` - Markdown → HTML parsing

<!-- @mid:p-nivf6g -->
**Custom Rules:**

<!-- @mid:code-r6lhgm -->
```typescript
// Preserve inline code
turndownService.addRule('code', {
  filter: 'code',
  replacement: (content) => `\`${content}\``,
});

// Preserve styled spans (colors)
turndownService.addRule('styledSpan', {
  filter: (node) => node.nodeName === 'SPAN' && (node.style.color || node.style.backgroundColor),
  replacement: (content, node: any) => {
    // Returns HTML: <span style="color: #ff0000">text</span>
  },
});

// Preserve mark elements (highlights)
turndownService.addRule('mark', {
  filter: 'mark',
  replacement: (content, node: any) => {
    const bgColor = node.style.backgroundColor;
    return `<mark style="background-color: ${bgColor}">${content}</mark>`;
  },
});

// Preserve underline
turndownService.addRule('underline', {
  filter: 'u',
  replacement: (content) => `<u>${content}</u>`,
});
```

<!-- @mid:p-qlxazw -->
**Editor Integration:**

<!-- @mid:code-yv7avh -->
```typescript
// Save: HTML → Markdown
const html = editor.getHTML();
const markdown = htmlToMarkdown(html);
saveFile(markdown);

// Load: Markdown → HTML
const html = markdownToHtml(fileContent);
editor.commands.setContent(html);
```

<!-- @mid:p-91c4yn -->
**Benefits:**

<!-- @mid:list-z5qq15 -->
- True WYSIWYG editing (no markdown syntax visible)
- Files still save as markdown
- All formatting preserved in markdown via HTML tags
- No interference with code marks or other formatting

<!-- @mid:h-80wn07 -->
### CSS Fixes

<!-- @mid:p-vy936j -->
**`#### 1. Disabled Tailwind Prose Backticks (`****`src/index.css`****`)
`****`Problem:`****` Tailwind's `****`@tailwindcss/typography`****` plugin adds decorative backticks to `****`<code>`****` elements via `****`::before`****` and `****`::after`****` pseudo-elements.`**

<!-- @mid:p-nixpae -->
**Solution:**

<!-- @mid:code-fulew9 -->
```css
/* DISABLE PROSE BACKTICKS ON CODE ELEMENTS */
.prose code::before,
.prose code::after {
  content: '' !important;
}
```

<!-- @mid:p-sij8c4 -->
**This was the ****root cause**** of visible backticks - CSS was adding them, not the editor!**

<!-- @mid:p-3t3zce -->
**`#### 2. Custom Selection Colors (`****`src/index.css`****`)
`****`Problem:`****` Default browser selection made highlighted text and colored text invisible when selected.`**

<!-- @mid:p-4xffji -->
**`Solution:`****` Custom selection styling outside `****`@layer base`****` for higher specificity:`**

<!-- @mid:code-4ovbv1 -->
```css
/* CUSTOM SELECTION STYLES - OUTSIDE LAYER FOR HIGHER SPECIFICITY */
.ProseMirror ::selection {
  background-color: rgba(100, 149, 237, 0.20) !important; /* Cornflower blue at 20% */
  color: inherit !important;
}
```

<!-- @mid:p-750dim -->
**Key insights:**

<!-- @mid:list-f6ro4k -->
- Moved outside `@layer base` to override Tailwind defaults
- 20% opacity allows text colors and highlights to remain visible
- `color: inherit` preserves text color through selection

<!-- @mid:h-ppo0nl -->
### DOCX Export Updates

<!-- @mid:p-79p8in -->
`Updated ``electron/docx-helpers/`` to support new formatting:`

<!-- @mid:h-xigkln -->
#### types.ts

<!-- @mid:code-j1nlwv -->
```typescript
export interface TextStyleAttrs {
  fontSize?: string;
  fontFamily?: string;
  color?: string;  // Added for text color
}
```

<!-- @mid:h-2mda1d -->
#### text-processors.ts

<!-- @mid:code-gl672t -->
```typescript
export function createTextRun(node: TiptapNode, options?: { color?: string; defaultSize?: number }): TextRun {
  const marks = node.marks || [];

  const isUnderline = marks.some(m => m.type === 'underline');
  const textStyle = extractTextStyle(marks);
  const highlightMark = marks.find(m => m.type === 'highlight');

  const textColor = textStyle.color?.replace('#', '') || options?.color;
  const highlightColor = highlightMark?.attrs?.color;
  const docxHighlight = highlightColor ? hexToDocxHighlight(highlightColor) : undefined;

  return new TextRun({
    text: node.text || '',
    underline: isUnderline ? { type: 'single' } : undefined,
    color: textColor,
    highlight: docxHighlight,
    // ... other formatting
  });
}
```

<!-- @mid:p-00pyqg -->
**#### converters.ts
****Highlight Color Mapping:**** DOCX only supports specific highlight colors, so we map hex colors to the nearest Word color:**

<!-- @mid:code-bhllss -->
```typescript
export function hexToDocxHighlight(hex: string): string {
  const colorMap: Record<string, string> = {
    '#ffff00': 'yellow',
    '#00ff00': 'green',
    '#00ffff': 'cyan',
    '#ff00ff': 'magenta',
    '#0000ff': 'blue',
    '#ff0000': 'red',
    '#ffa500': 'darkYellow',
    '#808080': 'darkGray',
  };

  const normalized = hex.toLowerCase();

  // Exact match or find closest color using RGB distance
  // ...
}
```

<!-- @mid:h-x5hc3a -->
### Testing Checklist

<!-- @mid:p-c0yrv6 -->
**✅ ****Underline:**

<!-- @mid:list-l2m6xb -->
- Toggle via button
- Keyboard shortcut (Ctrl+U)
- Exports to DOCX
- Persists in markdown

<!-- @mid:p-3xn9f4 -->
**✅ ****Text Color:**

<!-- @mid:list-32rqfr -->
- Color wheel picker
- Preset colors
- Custom hex input with validation
- Recent colors (custom only)
- Current color indicator
- Clear color function
- Exports to DOCX
- Persists in markdown via inline styles

<!-- @mid:p-wok16p -->
**✅ ****Highlight Color:**

<!-- @mid:list-mjzkku -->
- Toggle button (on/off)
- Dropdown with palette
- Custom picker view
- Recent colors (custom only)
- Color indicator
- Remove highlight function
- Exports to DOCX (mapped colors)
- Persists in markdown via `<mark>` tags

<!-- @mid:p-rjo2gj -->
**✅ ****Inline Code:**

<!-- @mid:list-ch75ni -->
- No visible backticks in editor
- Applies code styling (monospace, background)
- Exports to DOCX
- Persists in markdown

<!-- @mid:p-23cv9o -->
**✅ ****Selection Visibility:**

<!-- @mid:list-hw658g -->
- Highlights remain visible when selected
- Text colors remain visible when selected
- 20% blue overlay provides clear selection feedback

<!-- @mid:h-lq72cb -->
### Known Limitations

<!-- @mid:list-mowxd0 -->
1. **DOCX Highlight Colors:** Limited to Word's color palette (yellow, green, cyan, magenta, blue, red, darkYellow, darkGray). Custom colors are mapped to nearest match.

<!-- @mid:list-7fjyi4 -->
1. **Markdown Persistence:** Colors and highlights require HTML tags in markdown files:
 - Text color: `<span style="color: #ff0000">text</span>`
 - Highlight: `<mark style="background-color: #ffff00">text</mark>`
 - Not pure markdown, but widely supported by markdown renderers

<!-- @mid:list-q7dgsl -->
1. **Recent Colors:** Stored in browser localStorage, not synced across devices

<!-- @mid:h-ia07my -->
### Performance Notes

<!-- @mid:list-wcolto -->
- Color pickers use react-colorful (2.2kb gzipped)
- Recent colors limited to 8 per picker to minimize localStorage usage
- No performance impact on editor rendering
- DOCX export handles colors efficiently (no additional processing time)

---

<!-- @mid:h-p65k49 -->
## 8. Nested List & Horizontal Rule Implementation (2025-12-05)

<!-- @mid:h-26gnyo -->
### Nested List Support

<!-- @mid:p-a23a2o -->
`#### Problem
The original DOCX export only handled flat lists - all items were exported at ``level: 0``, and nested sublists were ignored.`

<!-- @mid:p-j9y3ih -->
`#### Tiptap JSON Structure
Tiptap represents nested lists by embedding ``bulletList`` or ``orderedList`` nodes inside ``listItem`` nodes:`

<!-- @mid:code-uqyu3o -->
```json
{
  "type": "orderedList",
  "content": [
    {
      "type": "listItem",
      "content": [
        { "type": "paragraph", "content": [{ "type": "text", "text": "Item 1" }] },
        {
          "type": "orderedList",
          "content": [
            {
              "type": "listItem",
              "content": [
                { "type": "paragraph", "content": [{ "type": "text", "text": "Nested 1.1" }] }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

<!-- @mid:p-847utr -->
`#### Solution: Recursive Processing
Created ``electron/docx-helpers/list-processors.ts`` with three functions:`

<!-- @mid:code-3qxh0x -->
```typescript
// Process individual list items, recursing into nested lists
function processListItem(listItem: TiptapNode, context: ListContext): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  for (const content of listItem.content || []) {
    if (content.type === 'paragraph') {
      // Create paragraph at current level
      paragraphs.push(new Paragraph({
        bullet: { level: context.level },  // or numbering for ordered
        children: processTextNodes(content.content || []),
      }));
    } else if (content.type === 'bulletList') {
      // Recurse with incremented level
      paragraphs.push(...processBulletList(content, context.level + 1));
    } else if (content.type === 'orderedList') {
      paragraphs.push(...processOrderedList(content, context.level + 1));
    }
  }

  return paragraphs;
}
```

<!-- @mid:p-dlu29b -->
#### Numbering Configuration
Word requires explicit numbering configuration for each level:

<!-- @mid:code-4303yj -->
```typescript
numbering: {
  config: [{
    reference: 'default-numbering',
    levels: [
      { level: 0, format: 'decimal', text: '%1.', style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
      { level: 1, format: 'lowerLetter', text: '%2.', style: { paragraph: { indent: { left: 1440, hanging: 360 } } } },
      { level: 2, format: 'lowerRoman', text: '%3.', style: { paragraph: { indent: { left: 2160, hanging: 360 } } } },
      // Pattern repeats for levels 3-8
    ],
  }],
}
```

<!-- @mid:p-3v5qhr -->
**Indentation Values (in twips):**

<!-- @mid:list-yp0sx3 -->
- Level 0: 720 (0.5 inch)
- Level 1: 1440 (1.0 inch)
- Level 2: 2160 (1.5 inch)
- Each level adds 720 twips (0.5 inch)

<!-- @mid:p-tohwi2 -->
**Numbering Pattern:**** decimal → lowerLetter → lowerRoman (repeating)**

<!-- @mid:list-eyk4ed -->
- Level 0: 1. 2. 3.
- Level 1: a. b. c.
- Level 2: i. ii. iii.
- Level 3: 1. 2. 3. (pattern repeats)

<!-- @mid:p-cc0g1e -->
#### CSS for Editor Display
Added CSS to style nested ordered lists in the editor:

<!-- @mid:code-o3gbhy -->
```css
/* Nested Ordered List Styles - Progressive numbering (1, a, i) */
.prose ol { list-style-type: decimal; }
.prose ol ol { list-style-type: lower-alpha; }
.prose ol ol ol { list-style-type: lower-roman; }
.prose ol ol ol ol { list-style-type: decimal; }
/* Pattern continues... */
```

<!-- @mid:h-3n0up7 -->
### Horizontal Rule Support

<!-- @mid:p-vfyli6 -->
#### Editor Toolbar
Added a horizontal rule button using the Minus icon from lucide-react:

<!-- @mid:code-4fsb4u -->
```typescript
<button
  onClick={() => editor.chain().focus().setHorizontalRule().run()}
  title="Insert Horizontal Rule"
>
  <Minus size={16} />
</button>
```

<!-- @mid:p-oooavz -->
`The ``setHorizontalRule()`` command is provided by Tiptap's StarterKit.`

<!-- @mid:p-p73xjs -->
#### DOCX Export
Horizontal rules are exported as an empty paragraph with a bottom border:

<!-- @mid:code-187bmn -->
```typescript
case 'horizontalRule':
  children.push(new Paragraph({
    border: {
      bottom: {
        color: '999999',
        space: 1,
        style: BorderStyle.SINGLE,
        size: 6,  // 0.75pt line
      },
    },
    spacing: {
      before: 200,  // ~0.14 inch
      after: 200,
    },
  }));
  break;
```

<!-- @mid:h-42ppsc -->
### RGB Color Normalization Fix

<!-- @mid:p-1qemft -->
`#### Problem
Text colors from the editor were stored as ``rgb(r, g, b)`` format, but the DOCX library requires hex format (``RRGGBB``).`

<!-- @mid:p-cq3421 -->
`#### Solution
Added ``normalizeColorToHex()`` function in ``text-processors.ts``:`

<!-- @mid:code-xvrf39 -->
```typescript
function normalizeColorToHex(color: string | undefined): string | undefined {
  if (!color) return undefined;

  // Already hex format
  if (color.startsWith('#')) {
    return color.replace('#', '');
  }

  // RGB format: rgb(r, g, b)
  const rgbMatch = color.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 10);
    const g = parseInt(rgbMatch[2], 10);
    const b = parseInt(rgbMatch[3], 10);
    const toHex = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0');
    return `${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  return undefined;
}
```

<!-- @mid:p-k3mbyq -->
This function is called for both text colors and highlight colors before passing to the DOCX library.

<!-- @mid:h-5kmjbw -->
### Image Import from DOCX (2025-12-05)

<!-- @mid:p-to743y -->
`#### Problem
The original DOCX import using mammoth.js silently dropped all embedded images because no ``convertImage`` option was provided.`

<!-- @mid:p-ooy4o6 -->
`#### Solution
Mammoth.js provides a built-in ``convertImage`` option that extracts images and converts them to base64 data URLs:`

<!-- @mid:code-35s477 -->
```typescript
ipcMain.handle('import-docx', async () => {
    // ... file dialog code ...

    const buffer = await fs.readFile(filePaths[0]);

    // Configure mammoth to convert images to base64 data URLs
    const options = {
        convertImage: mammoth.images.imgElement(function(image: any) {
            return image.read("base64").then(function(imageBuffer: string) {
                return {
                    src: "data:" + image.contentType + ";base64," + imageBuffer
                };
            });
        })
    };

    const result = await mammoth.convertToHtml({ buffer }, options);

    // Return both HTML and original filename
    const originalFilename = path.basename(filePaths[0], '.docx');
    return { html: result.value, filename: originalFilename };
});
```

<!-- @mid:h-pbnz0o -->
#### How It Works

<!-- @mid:list-d44mx8 -->
1. When mammoth.js encounters an embedded image in the DOCX file, it calls the `convertImage` function
2. The function reads the image data as base64 using `image.read("base64")`
3. It returns an object with `src` set to a data URL: `data:image/png;base64,...`
4. Mammoth includes this as an `<img src="data:...">` tag in the HTML output
5. Tiptap's `insertContent()` parses the HTML and creates image nodes
6. The `ResizableImage` extension (with `allowBase64: true`) handles the base64 images

<!-- @mid:h-shwpfe -->
#### Supported Formats

<!-- @mid:list-qfelj3 -->
- PNG (`image/png`)
- JPEG (`image/jpeg`)
- GIF (`image/gif`)

<!-- @mid:p-aghqkq -->
Note: Windows-specific formats like WMF/EMF may not be supported and will be logged as warnings.

<!-- @mid:p-clk1b3 -->
#### Full Round-Trip Support
Images now have complete round-trip support:

<!-- @mid:list-7n5omv -->
1. **Import:** DOCX → base64 data URL → Tiptap image node
2. **Edit:** Resize, crop, align in the editor
3. **Export:** Tiptap image node → base64 buffer → DOCX ImageRun

<!-- @mid:h-22f59b -->
### DOCX Import as New File (2025-12-05)

<!-- @mid:p-0mqtw7 -->
#### Problem
Originally, importing a DOCX file would insert content into the currently open file, which was confusing and could overwrite existing work.

<!-- @mid:p-u3vmpi -->
#### Solution
Updated the import flow to create a new markdown file in the workspace:

<!-- @mid:p-eq9wv4 -->
**1. IPC Handler Returns Filename (`electron/main.ts`)**

<!-- @mid:code-qah2ah -->
```typescript
// Extract filename without extension
const originalFilename = path.basename(filePaths[0], '.docx');

return {
    html: result.value,
    filename: originalFilename
};
```

<!-- @mid:p-h0a0x2 -->
**2. New `createFile` Function (`src/store/useFileSystem.ts`)**

<!-- @mid:code-p3eomh -->
```typescript
createFile: async (filename, content) => {
    const { rootDir, openFiles } = get();
    if (!rootDir) return null;

    // Ensure .md extension
    const finalFilename = filename.endsWith('.md') ? filename : `${filename}.md`;
    let filePath = `${rootDir}/${finalFilename}`;

    // Generate unique filename if file exists
    let counter = 1;
    let baseName = finalFilename.replace('.md', '');
    while (fileExists(filePath)) {
        filePath = `${rootDir}/${baseName} (${counter}).md`;
        counter++;
    }

    // Write file, open in editor, refresh sidebar
    await window.electronAPI.writeFile(filePath, content);
    set({ openFiles: [...openFiles, newFile], activeFilePath: filePath, ... });
    await get().loadDir(rootDir);

    return filePath;
}
```

<!-- @mid:p-dsen55 -->
**3. App.tsx Import Handler**

<!-- @mid:code-ivuqtu -->
```typescript
if (action === 'import-docx') {
    const result = await window.electronAPI.importDocx();
    if (result) {
        const { html, filename } = result;
        const { rootDir, createFile } = useFileSystem.getState();

        if (!rootDir) {
            // No workspace - insert into current editor
            window.dispatchEvent(new CustomEvent('editor:insert-content', { detail: html }));
            return;
        }

        // Convert HTML to Markdown and create new file
        const markdown = htmlToMarkdown(html);
        await createFile(filename, markdown);
    }
}
```

<!-- @mid:h-8h5k7z -->
#### New Import Flow

<!-- @mid:list-wis1u0 -->
1. User clicks File → Import DOCX...
2. Selects a DOCX file (e.g., `Report.docx`)
3. If workspace is open:
 - Content converted to Markdown
 - New file created: `Report.md`
 - If file exists: `Report (1).md`, `Report (2).md`, etc.
 - File opens in editor
 - Sidebar updates to show new file
4. If no workspace: Falls back to inserting into current editor

<!-- @mid:h-cq9bcm -->
### Async DOCX Export with Worker Thread (2025-12-05)

<!-- @mid:p-wmwz9w -->
#### Problem
The original DOCX export ran synchronously on the main Electron process, which could block the UI for large documents with many elements or images.

<!-- @mid:p-1qonks -->
#### Solution
Implemented a comprehensive async export system with:

<!-- @mid:list-n7f9tb -->
1. **Worker Thread** - DOCX generation runs in a separate thread
2. **Progress Tracking** - Real-time progress updates during export
3. **Progress UI** - Modal dialog showing export status

<!-- @mid:h-m065do -->
#### Architecture

<!-- @mid:p-kogqje -->
**1. Worker Thread (`electron/docx-worker.ts`)**

<!-- @mid:list-86wbav -->
- Self-contained DOCX generation logic (all helpers inlined)
- Sends progress messages to parent via `parentPort.postMessage()`
- Reports progress every 10 nodes for responsive UI
- Phases: "Processing document" → "Building document" → "Generating file"

<!-- @mid:code-tcsv92 -->
```typescript
// Progress reporting
function sendProgress(current: number, total: number, phase: string) {
  parentPort?.postMessage({ type: 'progress', current, total, phase });
}

// Main loop with progress
for (let i = 0; i < nodes.length; i++) {
  // Process node...
  if (i % 10 === 0 || i === nodes.length - 1) {
    sendProgress(i + 1, total, 'Processing document');
  }
}
```

<!-- @mid:p-ey4coq -->
**2. Main Process Handler (`electron/main.ts`)**

<!-- @mid:list-r3klpt -->
- Spawns worker with document content as `workerData`
- Forwards progress messages to renderer via IPC
- Handles completion and errors

<!-- @mid:code-oqwrvf -->
```typescript
ipcMain.handle('export-docx', async (_, content) => {
  const worker = new Worker(workerPath, { workerData: content });

  worker.on('message', async (message) => {
    if (message.type === 'progress') {
      win?.webContents.send('docx-export-progress', message);
    } else if (message.type === 'complete') {
      await fs.writeFile(filePath, Buffer.from(message.buffer));
      resolve({ success: true });
    }
  });
});
```

<!-- @mid:p-feywtf -->
**3. IPC Progress Channel (`electron/preload.ts`)**

<!-- @mid:code-vjtlaf -->
```typescript
onDocxExportProgress: (callback) => {
  const subscription = (_, progress) => callback(progress);
  ipcRenderer.on('docx-export-progress', subscription);
  return () => ipcRenderer.off('docx-export-progress', subscription);
}
```

<!-- @mid:p-x248b4 -->
**4. Progress UI Component (`src/components/ExportProgress.tsx`)**

<!-- @mid:list-1v92ib -->
- Modal overlay with progress bar
- Shows current phase and element count
- Auto-closes on success (1.5s delay)
- Displays errors with close button
- States: Loading → Progress → Complete/Error

<!-- @mid:p-lg0lrz -->
**5. Export Store (`src/store/useExportStore.ts`)**

<!-- @mid:list-b2352e -->
- Simple Zustand store tracking `isExporting` state
- Triggers modal visibility

<!-- @mid:h-k4n4wf -->
#### File Changes

<!-- @mid:p-zx4cn2 -->
**`| File | Purpose |
|------|---------|
| `****`electron/docx-worker.ts`****` | `****`NEW`****` - Worker thread with DOCX generation |
| `****`electron/main.ts`****` | Updated export handler to use worker |
| `****`electron/preload.ts`****` | Added `****`onDocxExportProgress`****` listener |
| `****`src/components/ExportProgress.tsx`****` | `****`NEW`****` - Progress modal UI |
| `****`src/store/useExportStore.ts`****` | `****`NEW`****` - Export state management |
| `****`src/App.tsx`****` | Integrated progress modal |
| `****`src/vite-env.d.ts`****` | Added TypeScript types for electron API |
| `****`vite.config.ts`****` | Added worker to build entries |`**

<!-- @mid:h-y843bg -->
#### Benefits

<!-- @mid:list-vwsft0 -->
1. **Non-blocking** - UI remains responsive during export
2. **Feedback** - Users see progress for large documents
3. **Error handling** - Graceful error display with retry option
4. **Scalability** - Can handle very large documents without freezing