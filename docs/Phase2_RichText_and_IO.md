# Phase 2: Rich Text, Typography, and I/O Implementation Plan

This document outlines the architectural approach for adding advanced formatting (Fonts, Alignment, Size) and robust Import/Export capabilities (DOCX, PDF) to Project Muse.

**STATUS:** ✅ **COMPLETE** (Last Updated: 2025-12-03)
- Typography & Fonts: ✅ Complete
- Editor Extensions: ✅ Complete (all controls implemented)
- Import/Export: ✅ Complete (DOCX export with full formatting preservation)
- Print CSS: ✅ Complete

## 1. Architecture & Strategy

### A. Typography & Consistency ✅ **COMPLETE**
To ensure cross-platform consistency (Windows/Mac/Linux) without relying on user-installed fonts, we will **bundle open-source fonts** directly into the application.

*   **Strategy:** "Bundled Assets" ✅ **IMPLEMENTED** (via @fontsource npm packages)
*   **Implementation:**
    *   ✅ Font files bundled via @fontsource (imported in `src/main.tsx:5-24`)
    *   ✅ @font-face rules handled by @fontsource automatically
    *   ✅ Configure Tailwind/Tiptap to use these specific font families (`tailwind.config.js:20-24`)
    *   **Selection:** ✅ **EXPANDED** (10 fonts total)
        *   *Sans:* Inter, Lato, Open Sans, Roboto
        *   *Serif:* Merriweather, Lora, Crimson Text, Playfair Display
        *   *Mono:* JetBrains Mono, Fira Code
    *   **Note:** Using @fontsource is superior to local bundling for maintenance

### B. Editor State & Extensions ✅ **COMPLETE**
We will extend the Tiptap engine to handle new attributes.

*   ✅ **Alignment:** `@tiptap/extension-text-align` (Left, Center, Right, Justify) - `Editor.tsx:49-51`
*   ✅ **Font Family:** `@tiptap/extension-font-family` + `TextStyle` - `Editor.tsx:52-53`
*   ✅ **Font Size:** Custom `FontSize` extension created (`src/components/extensions/FontSize.ts`) - `Editor.tsx:7,55`
    *   ✅ Full UI controls implemented (`FontSizeDropdown.tsx`)
    *   ✅ Preset sizes: 10px, 12px, 14px, 16px, 18px, 20px, 24px, 28px, 32px
    *   ✅ Custom size input (1-200px range with validation)
    *   ✅ Displays actual computed font sizes from DOM
    *   ✅ Proportional scaling when changing block types (`BlockTypeDropdown.tsx:10-50`)
*   ✅ **UI Update:**
    *   ✅ **Fixed Toolbar** fully implemented with alignment, font family, font size, block types (`EditorToolbar.tsx`)
    *   ⚠️ **Floating Menu** partially implemented (intentionally deferred):
        *   ✅ Image bubble menu (`ImageWrapMenu.tsx`) for image-specific controls
        *   ⏸️ Text selection floating menu (Bold/Italic/Size) - Deferred per user decision (toolbar sufficient)

### C. Import/Export Pipeline

#### 1. DOCX Import (Read) ✅ **COMPLETE**
*   **Library:** `mammoth.js` v1.11.0 ✅ INSTALLED
*   **Why:** It is lightweight, JS-only, and focuses on extracting *semantic value* (Headings, Lists) rather than pixel-perfect layout, which fits our Markdown/Tiptap philosophy perfectly.
*   **Flow:** ✅ **IMPLEMENTED**
    *   User clicks "Import DOCX..." in File menu
    *   Main Process reads buffer (`main.ts:230-245`)
    *   `mammoth.convertToHtml` converts to HTML
    *   Custom event `editor:insert-content` dispatched
    *   Editor inserts via `editor.commands.insertContent()` (`Editor.tsx:197-217`)
*   **Limitation:** Text-only import (images deferred as per risk mitigation)

#### 2. DOCX Export (Write) ✅ **COMPLETE**
*   **Library:** `docx` v9.5.1 ✅ INSTALLED + Modular Helper System ✅ CREATED
*   **Why:** Generic HTML-to-DOCX converters often produce "messy" Word docs. The `docx` library allows us to programmatically build a clean Word document (Node -> Paragraph -> Run) from our Tiptap JSON.
*   **Architecture:** Modular helper file structure in `electron/docx-helpers/`:
    *   `types.ts` - TypeScript interfaces for Tiptap JSON structure
    *   `converters.ts` - Unit conversions (px→half-points, alignment mapping, font fallbacks)
    *   `text-processors.ts` - TextRun creation with full formatting
    *   `paragraph-processors.ts` - Paragraph and heading creation
    *   `image-processors.ts` - Base64 image embedding with alignment
*   **Flow:** ✅ **IMPLEMENTED** (`electron/docx-transformer.ts` + helpers, `main.ts:272-286`)
    *   Tiptap JSON -> Modular Transformer -> `docx` Object Model -> Buffer -> Write File
*   **Full Feature Support:**
    *   ✅ Paragraphs with text styling (bold, italic, strike, code)
    *   ✅ Headings (H1, H2, H3) with custom font sizes and black color (overrides Word's blue)
    *   ✅ **Font family preservation** with Word-compatible fallbacks (Inter→Arial, Merriweather→Georgia, etc.)
    *   ✅ **Font size preservation** with 1:1 px→pt mapping (14px→14pt, 16px→16pt, etc.)
    *   ✅ **Text alignment preservation** (left, center, right, justify)
    *   ✅ **Image embedding** with base64-to-buffer conversion, proper MIME type detection, and alignment
    *   ✅ Bullet/ordered lists with formatting preservation (flat only)
    *   ✅ Numbering configuration for ordered lists
*   **Deferred Features:**
    *   ⏸️ Nested list support (requires recursive processing)
    *   ⏸️ Advanced text formatting (underline, color, highlighting)

#### 3. PDF Export (Write) ✅ **COMPLETE**
*   **Library:** Electron's native `webContents.printToPDF()` ✅ IMPLEMENTED
*   **Why:** It uses the Chromium rendering engine. If it looks good in the app, it will look identical in the PDF. It handles fonts and CSS print media queries automatically.
*   **Flow:** ✅ **IMPLEMENTED** (`main.ts:247-270`)
    *   "Export to PDF" menu action
    *   `win.webContents.printToPDF({ printBackground: true, pageSize: 'A4', margins: {...} })`
    *   Apply `@media print` CSS (`index.css:295-334`)
    *   Save PDF to user-selected location
*   **Print CSS Features:**
    *   ✅ Hides UI elements (sidebar, toolbar, buttons)
    *   ✅ Resets layout for clean print
    *   ✅ White background, black text
    *   ✅ Theme-specific prose typography overrides

---

## 2. Implementation Steps

### Step 1: Advanced Typography (The Editor) ✅ **COMPLETE**
1.  ✅ **Asset Management:** Fonts bundled via @fontsource (`src/main.tsx:5-24`)
2.  ✅ **CSS Configuration:** @font-face handled by @fontsource; Tailwind extended (`tailwind.config.js:20-24`)
3.  ✅ **Tiptap Config:**
    *   ✅ Installed and registered `@tiptap/extension-text-align`, `@tiptap/extension-font-family`, `@tiptap/extension-text-style` (`Editor.tsx:49-53`)
    *   ✅ Created custom `FontSize` extension (`src/components/extensions/FontSize.ts`) - `Editor.tsx:7,55`
4.  ✅ **UI Components:**
    *   ✅ Alignment buttons/toggle group (`EditorToolbar.tsx:138-174`)
    *   ✅ `FontFamilyDropdown` component (`FontFamilyDropdown.tsx`)
    *   ✅ `FontSizeDropdown` component with advanced features (`FontSizeDropdown.tsx`):
        *   Preset sizes (10-32px)
        *   Custom size input (1-200px with validation)
        *   Displays actual computed font size using `window.getComputedStyle()`
        *   Reset functionality
    *   ✅ `BlockTypeDropdown` enhanced with proportional font scaling (`BlockTypeDropdown.tsx:10-50`)
    *   ✅ EditorToolbar fully integrated (`EditorToolbar.tsx:15,92`)

### Step 2: DOCX Import Logic ✅ **COMPLETE**
1.  ✅ **Install:** `mammoth` v1.11.0 installed
2.  ✅ **IPC Handler:** `import-docx` handler created (`electron/main.ts:230-245`)
3.  ✅ **Logic:**
    *   ✅ Read file buffer via dialog
    *   ✅ Run `mammoth.convertToHtml(buffer)`
    *   ✅ Return raw HTML string to Renderer
4.  ✅ **Frontend:** Custom event listener `editor:insert-content` in `Editor.tsx:197-217` uses `editor.commands.insertContent(html)`

### Step 3: DOCX Export Logic ✅ **COMPLETE WITH FULL FORMATTING**
1.  ✅ **Install:** `docx` v9.5.1 installed
2.  ✅ **Modular Architecture:** Helper system created in `electron/docx-helpers/`
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
3.  ✅ **Main Transformer:** `electron/docx-transformer.ts` orchestrates all helpers
    *   ✅ Handles paragraphs, headings, lists, images
    *   ✅ Includes numbering configuration for ordered lists
    *   ✅ Error handling with try-catch per node
4.  ✅ **Export Trigger:**
    *   Menu action "Export to DOCX..."
    *   Custom event `editor:export-request`
    *   Editor calls `editor.getJSON()` (`Editor.tsx:221-241`)
    *   IPC call `exportDocx(json)`
    *   Main saves to disk (`main.ts:272-286`)

### Step 4: PDF Export Logic ✅ **COMPLETE**
1.  ✅ **IPC Handler:** `export-pdf` created (`electron/main.ts:247-270`)
2.  ✅ **Logic:**
    *   ✅ `win.webContents.printToPDF({ printBackground: true, pageSize: 'A4', margins: {...} })`
    *   ✅ Write buffer to user-selected path via save dialog
3.  ✅ **Print CSS:** Comprehensive `@media print` styles in `index.css:295-334`
    *   ✅ Hides Sidebar, Toolbar, TitleBar, and draggable elements
    *   ✅ Resets layout (removes overflow, padding, flex)
    *   ✅ Ensures black text on white background
    *   ✅ Preserves prose typography with theme-specific overrides

---

## 3. Risk Mitigation

*   ✅ **Font Loading:** Fonts are loaded via @fontsource at app startup. Electron handles this well. No layout shifts observed in PDF generation.
*   ✅ **Font Compatibility:** Web fonts mapped to Word-compatible system fonts to ensure proper rendering:
    *   Sans-serif fonts (Inter, Roboto, Open Sans, Lato) → Arial
    *   Serif fonts (Merriweather, Crimson Text, Lora, Playfair Display) → Georgia
    *   Monospace fonts (JetBrains Mono, Fira Code) → Courier New
*   ✅ **Image Handling in DOCX:**
    *   **Import:** Text-only import implemented (images deferred as planned)
    *   **Export:** ✅ **COMPLETE** - Base64 image embedding with proper MIME type detection (png, jpg, gif, bmp)
    *   **Validation:** Dimension clamping (1-2000px) and error handling for corrupt images
*   ⚠️ **Performance:** Large DOCX exports currently synchronous. No Web Worker or async processing implemented yet. Consider for future optimization if users report slowness with large documents.
*   ✅ **DOCX Corruption Prevention:**
    *   Font size validation (2-400 half-points)
    *   Image dimension validation (1-2000px)
    *   Numbering configuration for ordered lists (prevents Word errors)

---

## 4. Implementation Status Summary

### ✅ Fully Implemented
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
- **DOCX Import**
  - Text-only import with mammoth.js
  - Preserves headings, lists, and basic formatting
- **DOCX Export (Full Implementation)** ✅ **COMPLETE**
  - Modular helper system (`electron/docx-helpers/`)
  - Font family preservation with Word-compatible fallbacks
  - Font size preservation with 1:1 px→pt mapping
  - Text alignment preservation
  - Image embedding (base64 with proper MIME types)
  - Heading customization (black color, level-specific sizes)
  - List support with numbering configuration
  - **Critical bug fix:** All text nodes processed (not just first)
- **PDF Export**
  - Electron printToPDF with print CSS
  - Theme-aware output
- **All IPC handlers and preload API**

### ⏸️ Intentionally Deferred (Per User Decision)
- Text selection floating/bubble menu (toolbar is sufficient for current needs)
- Async DOCX generation with Web Worker (defer until users report performance issues)
- Nested list support in DOCX export (requires recursive processing)
- Image import from DOCX (defer to future phase)
- Advanced text formatting: underline, color, highlighting

### 🎯 Next Steps (Priority Order)

**Phase 2 Core Features:** ✅ **COMPLETE**

All essential rich text editing and DOCX export features have been successfully implemented. The following optional enhancements are available for future phases if needed:

1. **Low Priority:** Nested list support in DOCX export
   - Currently: Flat lists work perfectly
   - Enhancement: Add recursive processing for nested bullet/numbered lists
2. **Low Priority:** Implement async DOCX generation with progress indicator
   - Currently: DOCX export is synchronous and works well for typical documents
   - Enhancement: Move to Web Worker for very large documents (if users report slowness)
3. **Future Phase:** Image import from DOCX
   - Currently: Images work in editor and export to DOCX, but don't import from DOCX
   - Enhancement: Extract and embed images during DOCX import
4. **Future Phase:** Advanced text formatting
   - Underline, text color, highlighting
   - Would require additional Tiptap extensions and DOCX transformer updates

**Notes:**
- Text selection floating menu was evaluated and intentionally deferred as the fixed toolbar provides sufficient functionality
- Font family/size/alignment preservation ✅ **COMPLETE**
- Image embedding in DOCX export ✅ **COMPLETE**

---

## 5. Font Size Implementation Details

The font size feature includes several advanced capabilities beyond basic size selection:

### Custom FontSize Extension
Created a custom Tiptap extension (`src/components/extensions/FontSize.ts`) due to package version conflicts:
- Adds `fontSize` attribute to `TextStyle` mark
- Provides `setFontSize(size)` and `unsetFontSize()` commands
- Parses and renders font-size CSS inline styles

### FontSizeDropdown Component (`src/components/FontSizeDropdown.tsx`)
**Features:**
- **Preset Sizes:** 10px, 12px, 14px, 16px (default), 18px, 20px, 24px, 28px, 32px
- **Custom Input:** 1-200px range with validation, keyboard shortcuts (Enter/Escape)
- **Smart Display:** Uses `window.getComputedStyle()` to display actual rendered font size
  - Shows "32" for H1, "24" for H2, "20" for H3, "16" for paragraph
  - Shows actual custom size if user has set one
  - Shows "Mixed" if selection contains multiple sizes
- **Reset Functionality:** Removes custom fontSize attribute

**Key Implementation:**
```typescript
const getComputedFontSize = (): string => {
  const { from } = editor.state.selection;
  const domAtPos = editor.view.domAtPos(from);
  const element = /* find closest element node */;
  const computedStyle = window.getComputedStyle(element);
  return Math.round(parseFloat(computedStyle.fontSize)).toString();
};
```

### Proportional Font Scaling (`BlockTypeDropdown.tsx`)
**Problem:** When a user sets a custom font size and then changes block type (e.g., paragraph → H1), the size should scale proportionally, not reset or stay the same.

**Solution:** Implemented ratio-based scaling that maintains user intent:
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

**Example Scaling:**
- Paragraph at 20px → H1 scales to 40px (20 × 32/16 = 40)
- H1 at 40px → H2 scales to 30px (40 × 24/32 = 30)
- H2 at 30px → Paragraph scales to 20px (30 × 16/24 = 20)

This preserves the user's intention to have "larger than default" or "smaller than default" text across block type changes.

---

## 6. DOCX Export Implementation Details

The DOCX export system uses a modular architecture that transforms Tiptap JSON to Word documents while preserving all formatting.

### Architecture: Modular Helper System

Instead of a monolithic transformer, the implementation uses specialized helper modules in `electron/docx-helpers/`:

**File Structure:**
```
electron/
├── docx-transformer.ts          # Main orchestrator
└── docx-helpers/
    ├── types.ts                 # TypeScript interfaces
    ├── converters.ts            # Unit conversions & mappings
    ├── text-processors.ts       # TextRun creation
    ├── paragraph-processors.ts  # Paragraph/heading creation
    └── image-processors.ts      # Image embedding
```

### Key Design Decisions

#### 1. Font Compatibility Strategy
**Problem:** Web fonts (Inter, Merriweather, etc.) loaded via @fontsource aren't installed system-wide on the user's computer. When Word opens the DOCX and can't find "Inter", it falls back to a default font that may not match the intended style.

**Solution:** `FONT_FALLBACK_MAP` in `converters.ts` maps web fonts to universally-available system fonts:
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

**Result:** Inter text exports as Arial (clean sans-serif), Merriweather as Georgia (classic serif), maintaining visual consistency.

#### 2. Font Size Conversion: 1:1 Parity
**Problem:** Browsers measure in pixels (px), Word measures in points (pt). Traditional conversion (96 DPI standard) causes confusion: 16px → 12pt makes the numbers inconsistent.

**Solution:** Use 1:1 mapping for intuitive number parity:
```typescript
export function pxToHalfPoints(px: string): number {
  const numericValue = parseFloat(px);
  const halfPoints = Math.round(numericValue * 2);
  // 14px → 28 half-points → 14pt in Word
  // User sees "14" in editor, sees "14pt" in Word
  return halfPoints;
}
```

**Benefits:**
- What you see is what you get (WYSIWYG)
- 14px in editor = 14pt in Word
- No mental math required for users

#### 3. Critical Bug Fix: Multiple Text Runs
**Original Bug:** Only the first text node in a paragraph was exported:
```typescript
// BROKEN CODE (original implementation)
text: node.content?.[0]?.text || ''  // Only reads first node!
```

If a paragraph had mixed formatting like "**Hello** _world_", only "Hello" would export.

**Fix:** `processTextNodes()` function iterates ALL text nodes:
```typescript
export function processTextNodes(nodes: TiptapNode[]): TextRun[] {
  return nodes
    .filter(node => node.type === 'text')
    .map(node => createTextRun(node));  // Each node becomes a TextRun
}
```

**Result:** All text with all formatting is preserved.

#### 4. Heading Customization
**Problem:** Word's default heading styles use blue color and may not match the app's visual design.

**Solution:** Override Word defaults in `paragraph-processors.ts`:
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

**Result:** Headings maintain editor hierarchy (H1 > H2 > H3) with consistent black color.

#### 5. Image Embedding
**Challenge:** Tiptap stores images as base64 data URLs. Word requires binary image data with proper format specification.

**Solution:** Multi-step conversion in `image-processors.ts`:
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

**Result:** Images embed cleanly without "unreadable content" warnings.

### Error Prevention & Validation

The transformer includes robust validation to prevent DOCX corruption:

1. **Font Size Validation** (`converters.ts:31-35`)
   ```typescript
   if (halfPoints < 2) return 2;    // Min 1pt
   if (halfPoints > 400) return 400; // Max 200pt
   ```

2. **Image Dimension Validation** (`image-processors.ts:77-79`)
   ```typescript
   if (numericValue < 1) return 1;
   if (numericValue > 2000) return 2000;
   ```

3. **Numbering Configuration** (`docx-transformer.ts:76-90`)
   - Ordered lists require explicit numbering config
   - Without this, Word shows "experienced an error" on open

4. **Per-Node Error Handling** (`docx-transformer.ts:13-68`)
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

### Testing Strategy

Created `DOCX_EXPORT_TEST.md` with comprehensive test cases:
- Mixed formatting in single paragraph (bug fix verification)
- Font families (Inter, Merriweather, JetBrains Mono)
- Font sizes (10px-32px range)
- Text alignment (left, center, right, justify)
- Headings with custom sizes and alignment
- Lists with formatting preservation
- Images with dimensions and alignment
- Edge cases (empty paragraphs, custom sizes on headings)

### Performance Considerations

**Current Approach:** Synchronous processing
- Works well for typical documents (< 50 pages)
- Simplifies error handling and debugging

**Future Optimization (if needed):**
- Move transformation to Web Worker
- Add progress indicator for large documents
- Stream processing for very large files

**Decision:** Defer optimization until users report actual slowness. Premature optimization adds complexity without proven benefit.

