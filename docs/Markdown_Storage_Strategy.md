<!-- @mid:h-ia3cmn -->
# Markdown Storage Strategy: Achieving Word Processor Parity

<!-- @mid:p-ear21g -->
A critical analysis of how to store rich document features while maintaining Markdown as the backbone, and whether this is the right architectural choice.

---

<!-- @mid:h-lhr0ws -->
## Table of Contents

<!-- @mid:list-2mbvo7 -->
1. The Fundamental Tension
2. Current Implementation Analysis
3. Feature Storage Requirements
4. Storage Architecture Options
5. Recommendation: Hybrid Markdown+Sidecar
6. Implementation Specification
7. Migration & Compatibility
8. Version Control Integration
9. Decision Matrix

---

<!-- @mid:h-ab5thm -->
## 1. The Fundamental Tension

<!-- @mid:h-9tg61o -->
### What Markdown Does Well

<!-- @mid:p-0c4o92 -->
**Markdown was designed for ****semantic simplicity****:**

<!-- @mid:code-utqlnq -->
```markdown
# Heading           → "This is important"
**bold**            → "This is emphasized"
- item              → "This is a list"
[link](url)         → "This points somewhere"
```

<!-- @mid:p-1ocrl4 -->
**It deliberately ****avoids**** visual formatting because:**

<!-- @mid:list-izvhwo -->
- Content should be portable across renderers
- Presentation should be separate from content
- Files should be human-readable

<!-- @mid:h-q0ji7k -->
### What Word Processors Expect

<!-- @mid:p-zfw8rk -->
**Users expect ****visual formatting****:**

<!-- @mid:p-3rlzp7 -->
| Feature | Markdown Support | Word Processor |
|---------|------------------|----------------|
| Bold/Italic | ✓ Native | ✓ |
| Headings | ✓ Native | ✓ |
| Lists | ✓ Native | ✓ |
| Links | ✓ Native | ✓ |
| Font family | ✗ None | ✓ |
| Font size | ✗ None | ✓ |
| Text color | ✗ None | ✓ |
| Highlight | ✗ None | ✓ |
| Text alignment | ✗ None | ✓ |
| Line spacing | ✗ None | ✓ |
| Page margins | ✗ None | ✓ |
| Underline | ✗ None | ✓ |
| Strikethrough | ~GFM extension | ✓ |
| Tables | ~GFM extension | ✓ |
| Images with size/position | ✗ Limited | ✓ |
| Headers/Footers | ✗ None | ✓ |
| Page breaks | ✗ None | ✓ |
| Columns | ✗ None | ✓ |
| Footnotes | ~Extension | ✓ |

<!-- @mid:h-okkx9v -->
### The Core Question

<!-- @mid:bq-4k23bo -->
> **Can we achieve word processor feature parity while keeping Markdown as "the backbone"?**

<!-- @mid:p-ag8lgi -->
**Short answer****: Yes, but Markdown becomes the ****content backbone****, not the ****format backbone****. We need additional storage for visual formatting.**

---

<!-- @mid:h-8zp5mu -->
## 2. Current Implementation Analysis

<!-- @mid:h-7ty1kv -->
### How We Currently Store Rich Formatting

<!-- @mid:p-7fnz3o -->
**`File`****`: `****`src/utils/markdown.ts`**

<!-- @mid:p-lrzgoy -->
**We use ****inline HTML within Markdown**** for features Markdown doesn't support:**

<!-- @mid:code-p1mord -->
```markdown
# My Document

This is **bold** and *italic* text.

<span style="color: #ff0000">Red text</span>

<span style="font-family: 'Inter'; font-size: 18px">Custom font</span>

<mark style="background-color: #ffff00">Highlighted</mark>

<u>Underlined text</u>

<p style="text-align: center">Centered paragraph</p>

![](data:image/png;base64,iVBORw0KGgo...)
```

<!-- @mid:h-znvf1f -->
### Problems with Current Approach

<!-- @mid:h-bm8x6q -->
#### **1. ****Bloated Files**

<!-- @mid:code-niej7v -->
```markdown
<!-- Simple sentence with formatting becomes: -->
<span style="font-family: 'Merriweather'; font-size: 16px; color: #333333">
The quick brown fox
</span>
<span style="font-family: 'Merriweather'; font-size: 16px; color: #ff0000">
jumps over
</span>
<span style="font-family: 'Merriweather'; font-size: 16px; color: #333333">
the lazy dog.
</span>
```

<!-- @mid:p-unju4j -->
A paragraph that would be 50 characters becomes 400+ characters.

<!-- @mid:p-iw4i5h -->
**#### 2. ****Lost Readability****
The file is no longer "human-readable Markdown"—it's HTML soup:**

<!-- @mid:code-zkxrws -->
```markdown
<p style="text-align: justify"><span style="font-family: 'Inter'; font-size: 14px; color: #1a1a1a">Lorem ipsum dolor sit amet, <span style="font-weight: bold; color: #ff0000">consectetur</span> adipiscing elit.</span></p>
```

<!-- @mid:h-4trg29 -->
#### **3. ****Renderer Incompatibility**

<!-- @mid:list-ss7vhh -->
- GitHub won't render `style` attributes (security)
- Many Markdown viewers strip HTML
- Obsidian shows raw HTML
- Static site generators may sanitize

<!-- @mid:p-grogj9 -->
**#### 4. ****Diff Noise****
Version control becomes useless:**

<!-- @mid:code-fa0jxv -->
```diff
- <span style="font-family: 'Inter'; font-size: 14px">Hello</span>
+ <span style="font-family: 'Inter'; font-size: 16px">Hello</span>
```

<!-- @mid:p-vzxrtb -->
User changed font size, but it looks like the whole line changed.

<!-- @mid:p-tpx1eg -->
**#### 5. ****No Document-Level Settings****
Where do we store:**

<!-- @mid:list-x9zbht -->
- Default font for the document?
- Page margins?
- Line spacing?
- Theme preferences?

<!-- @mid:p-oyrya0 -->
**Currently: ****Nowhere****. Every paragraph carries its own styles.**

<!-- @mid:p-kj8xxx -->
**#### 6. ****Image Problems****
Base64 images embedded in Markdown:**

<!-- @mid:list-bcc4kf -->
- 1MB image = 1.37MB in base64
- Every version stores the full image
- Files become multi-megabyte

---

<!-- @mid:h-h8uyvf -->
## 3. Feature Storage Requirements

<!-- @mid:h-6xchp5 -->
### Complete Feature Inventory

<!-- @mid:p-rbj25r -->
Let's catalog everything a word processor user expects:

<!-- @mid:p-ozybxu -->
#### Document-Level Settings
| Feature | Storage Need | Current Support |
|---------|--------------|-----------------|
| Default font family | Document metadata | ❌ None |
| Default font size | Document metadata | ❌ None |
| Default text color | Document metadata | ❌ None |
| Page size (A4, Letter) | Document metadata | ❌ None |
| Page margins | Document metadata | ❌ None |
| Page orientation | Document metadata | ❌ None |
| Line spacing | Document metadata | ❌ None |
| Paragraph spacing | Document metadata | ❌ None |
| Headers/Footers | Document metadata + content | ❌ None |

<!-- @mid:p-p8tm02 -->
#### Block-Level Formatting
| Feature | Storage Need | Current Support |
|---------|--------------|-----------------|
| Paragraph alignment | Per-paragraph | ⚠️ Inline HTML |
| First-line indent | Per-paragraph | ❌ None |
| Paragraph spacing | Per-paragraph | ❌ None |
| Block quotes | Native markdown | ✅ Native |
| Code blocks | Native markdown | ✅ Native |
| Lists | Native markdown | ✅ Native |
| Tables | GFM extension | ✅ GFM |
| Horizontal rules | Native markdown | ✅ Native |
| Page breaks | Per-location | ❌ None |

<!-- @mid:p-7wrspd -->
#### Inline/Span-Level Formatting
| Feature | Storage Need | Current Support |
|---------|--------------|-----------------|
| Bold | Native markdown | ✅ Native |
| Italic | Native markdown | ✅ Native |
| Strikethrough | GFM extension | ✅ GFM |
| Underline | Per-span | ⚠️ Inline HTML |
| Font family override | Per-span | ⚠️ Inline HTML |
| Font size override | Per-span | ⚠️ Inline HTML |
| Text color | Per-span | ⚠️ Inline HTML |
| Background/highlight | Per-span | ⚠️ Inline HTML |
| Superscript | Per-span | ❌ None |
| Subscript | Per-span | ❌ None |
| Small caps | Per-span | ❌ None |

<!-- @mid:p-2m351s -->
#### Media & Objects
| Feature | Storage Need | Current Support |
|---------|--------------|-----------------|
| Images | URL or embedded | ⚠️ Base64 inline |
| Image size | Per-image attrs | ⚠️ Data attributes |
| Image alignment | Per-image attrs | ⚠️ Data attributes |
| Image caption | Per-image | ❌ None |
| Tables | GFM or HTML | ⚠️ Limited |
| Embeds (video, etc.) | URL reference | ❌ None |

<!-- @mid:p-8qhj3z -->
#### Version Control & Metadata
| Feature | Storage Need | Current Support |
|---------|--------------|-----------------|
| Author | Document metadata | ❌ None |
| Created date | Document metadata | ❌ None |
| Modified date | Document metadata | ❌ None |
| Tags/Categories | Document metadata | ❌ None |
| Custom properties | Document metadata | ❌ None |
| Comments/Annotations | Anchored to content | ❌ None |
| Version history | Separate system | 📋 Planned |

---

<!-- @mid:h-3cr3r5 -->
## 4. Storage Architecture Options

<!-- @mid:h-gc84p6 -->
### Option A: Pure Markdown + Inline HTML (Current)

<!-- @mid:p-c0t83g -->
`Keep everything in one ``.md`` file with HTML for rich features.`

<!-- @mid:code-2epez8 -->
```markdown
---
title: My Document
---

# Heading

<p style="text-align: center; font-family: Inter; font-size: 18px">
Styled paragraph content here.
</p>
```

<!-- @mid:p-jps79m -->
**Pros:**

<!-- @mid:list-uko7c5 -->
- Single file
- "It's still Markdown"
- No format change needed

<!-- @mid:p-jv7beg -->
**Cons:**

<!-- @mid:list-nfc3pu -->
- Bloated, unreadable files
- No document-level settings
- Base64 images explode file size
- Diff/version control useless
- Other Markdown tools won't render correctly

<!-- @mid:p-xuhcv0 -->
**Verdict:**** ❌ ****Not viable for word processor parity**

---

<!-- @mid:h-hmp2l5 -->
### Option B: Markdown + YAML Frontmatter

<!-- @mid:p-tym5wu -->
Use YAML frontmatter for document settings, keep inline HTML for span formatting.

<!-- @mid:code-m6d9u9 -->
```markdown
---
title: My Document
author: Jane Doe
defaultFont: Inter
defaultSize: 14px
lineSpacing: 1.5
pageMargins: 1in
---

# Heading

<span style="color: red">Highlighted text</span> in a paragraph.
```

<!-- @mid:p-ob8cqa -->
**Pros:**

<!-- @mid:list-49bkju -->
- Document settings have a home
- Standard format (Obsidian, Jekyll, etc.)
- Still one file

<!-- @mid:p-08zkh7 -->
**Cons:**

<!-- @mid:list-y0qhm8 -->
- Inline HTML still bloats content
- No solution for images
- Frontmatter can't handle complex structures (per-paragraph styles)
- Still unreadable with heavy formatting

<!-- @mid:p-iessit -->
**Verdict:**** ⚠️ ****Partial solution—good for document metadata, not formatting**

---

<!-- @mid:h-wbq8df -->
### Option C: Markdown + Sidecar JSON

<!-- @mid:p-pvnzf0 -->
Store content in Markdown, formatting/metadata in a companion file.

<!-- @mid:code-yejiy0 -->
```
document.md           # Pure, clean Markdown
document.md.midlight  # Formatting, settings, media references
```

<!-- @mid:p-ekmsay -->
**document.md:**

<!-- @mid:code-jmtqt2 -->
```markdown
# My Document

The quick brown fox jumps over the lazy dog.

Here's another paragraph with some important text.
```

<!-- @mid:p-6y35qe -->
**document.md.midlight:**

<!-- @mid:code-q2bgck -->
```json
{
  "version": 1,
  "document": {
    "defaultFont": "Inter",
    "defaultSize": "14px",
    "lineSpacing": 1.5,
    "pageMargins": { "top": "1in", "right": "1in", "bottom": "1in", "left": "1in" }
  },
  "blocks": {
    "p:0": { "align": "justify" },
    "p:1": { "align": "center", "fontSize": "18px" }
  },
  "spans": [
    { "start": 45, "end": 54, "marks": ["bold", { "color": "#ff0000" }] }
  ],
  "images": {
    "img:0": {
      "file": ".midlight/images/abc123.png",
      "width": 400,
      "height": 300,
      "align": "center",
      "caption": "A brown fox"
    }
  }
}
```

<!-- @mid:p-k4nrg3 -->
**Pros:**

<!-- @mid:list-70s8wp -->
- Markdown stays clean and portable
- All formatting centralized and structured
- Images stored separately (efficient)
- Easy to diff/version control
- Could open `.md` in any editor (basic viewing)

<!-- @mid:p-gsvmix -->
**Cons:**

<!-- @mid:list-o44n5k -->
- Two files per document
- Sync complexity (what if one changes?)
- Position tracking (`start: 45`) fragile
- Midlight-specific format
- Learning curve for users who look at files

<!-- @mid:p-zkwmyo -->
**Verdict:**** ⚠️ ****Good separation, but position-based spans are fragile**

---

<!-- @mid:h-jydgfs -->
### Option D: Tiptap JSON as Primary Format

<!-- @mid:p-p4qq8m -->
Abandon Markdown storage; use Tiptap's native JSON.

<!-- @mid:p-cmlse0 -->
**document.midlight:**

<!-- @mid:code-jaq3kq -->
```json
{
  "type": "doc",
  "content": [
    {
      "type": "heading",
      "attrs": { "level": 1 },
      "content": [{ "type": "text", "text": "My Document" }]
    },
    {
      "type": "paragraph",
      "attrs": { "textAlign": "justify" },
      "content": [
        { "type": "text", "text": "The quick brown fox " },
        {
          "type": "text",
          "marks": [{ "type": "bold" }, { "type": "textStyle", "attrs": { "color": "#ff0000" } }],
          "text": "jumps over"
        },
        { "type": "text", "text": " the lazy dog." }
      ]
    }
  ],
  "meta": {
    "defaultFont": "Inter",
    "pageSize": "A4"
  }
}
```

<!-- @mid:p-s8tkja -->
**Pros:**

<!-- @mid:list-r934ze -->
- Perfect fidelity with editor state
- No conversion loss
- All formatting naturally preserved
- Structured, queryable
- Future-proof for collaboration (CRDTs)

<!-- @mid:p-5u6wo2 -->
**Cons:**

<!-- @mid:list-u5fyo6 -->
- Not human-readable
- Can't open in other editors
- Proprietary format lock-in
- Breaks "Markdown backbone" promise
- Users can't edit files manually

<!-- @mid:p-7gnl25 -->
**Verdict:**** ⚠️ ****Maximum fidelity, but abandons Markdown philosophy**

---

<!-- @mid:h-b09rkq -->
### Option E: Hybrid—Markdown Content + Embedded Formatting Blocks

<!-- @mid:p-8heigz -->
Use Markdown with special code blocks for formatting data.

<!-- @mid:code-t9zqdl -->
```markdown
---
title: My Document
defaultFont: Inter
---

# My Document

The quick brown fox jumps over the lazy dog.

<!--midlight
{
  "p:0": { "align": "justify" },
  "spans": [{ "text": "jumps over", "bold": true, "color": "#ff0000" }]
}
-->

Here's another paragraph.
```

<!-- @mid:p-zpeg4d -->
**Pros:**

<!-- @mid:list-on4wnk -->
- Single file
- Markdown viewers show content (ignore comment)
- All data together
- HTML comment is standard

<!-- @mid:p-u3q77w -->
**Cons:**

<!-- @mid:list-d8nsdn -->
- Fragile text matching for spans
- Comment block is ugly
- Position tracking still problematic
- Complex parsing

<!-- @mid:p-b23hv5 -->
**Verdict:**** ⚠️ ****Clever hack, but fragile**

---

<!-- @mid:h-gk7sl3 -->
### Option F: Markdown + Per-Block Attributes (Custom Syntax)

<!-- @mid:p-21te53 -->
Extend Markdown with attribute syntax (like Pandoc/Kramdown).

<!-- @mid:code-p6ud45 -->
```markdown
---
title: My Document
---

# My Document

{.align-center .font-inter .size-18}
The quick brown fox [jumps over]{.bold .color-red} the lazy dog.

{.align-justify}
Here's another paragraph.
```

<!-- @mid:p-6451wi -->
**Pros:**

<!-- @mid:list-7xux68 -->
- Stays in Markdown paradigm
- Attributes are inline with content
- Used by Pandoc, Hugo, Jekyll
- Readable

<!-- @mid:p-9zwtrb -->
**Cons:**

<!-- @mid:list-wid6h5 -->
- Non-standard Markdown
- Limited expressiveness (can't do `color: #ff3366`)
- Requires custom parser
- Other tools won't understand

<!-- @mid:p-jza0fb -->
**Verdict:**** ⚠️ ****Elegant but limited and non-standard**

---

<!-- @mid:h-o5rbax -->
## 5. Recommendation: Hybrid Markdown+Sidecar

<!-- @mid:p-hcz17q -->
**After analyzing all options, I recommend ****Option C (Sidecar) with improvements****:**

<!-- @mid:h-y9scae -->
### The Approach

<!-- @mid:code-pxldhy -->
```
workspace/
├── documents/
│   ├── essay.md                    # Clean Markdown (content)
│   └── essay.md.midlight           # Formatting & metadata (JSON)
├── .midlight/
│   ├── images/
│   │   └── abc123.png              # Extracted images
│   └── config.json                 # Workspace settings
```

<!-- @mid:h-l1yob5 -->
### Why This Approach?

<!-- @mid:list-chfq8v -->
1. **Markdown stays portable**: Open `essay.md` in any editor, GitHub, Obsidian
2. **Rich formatting preserved**: `.midlight` file has everything
3. **Images optimized**: Not embedded, deduplicated by hash
4. **Version control friendly**: Markdown diffs are meaningful
5. **Graceful degradation**: Without `.midlight`, content still readable
6. **Forward compatible**: Can add features without breaking format

<!-- @mid:h-a7y4jl -->
### Solving the Position Problem

<!-- @mid:p-56o9ia -->
**Instead of character positions (fragile), use ****content addressing****:**

<!-- @mid:code-f9bpkc -->
```json
{
  "spans": [
    {
      "anchor": { "text": "jumps over", "occurrence": 1, "context": "fox jumps over the" },
      "marks": { "bold": true, "color": "#ff0000" }
    }
  ]
}
```

<!-- @mid:p-3ac7gc -->
**Or use ****block IDs**** that Tiptap can generate:**

<!-- @mid:code-wiln81 -->
```markdown
The quick brown fox jumps over the lazy dog.
<!-- mid:p-a1b2c3 -->
```

<!-- @mid:p-jh5mlg -->
The comment is invisible to renderers but lets us anchor formatting.

---

<!-- @mid:h-1lw13k -->
## 6. Implementation Specification

<!-- @mid:h-t2bjp5 -->
### `6.1 File Format: ``.midlight`` Sidecar`

<!-- @mid:code-q91tb1 -->
```typescript
interface MidlightDocument {
  version: 1;

  // Document-level settings
  document: {
    title?: string;
    author?: string;
    created?: string;           // ISO 8601
    modified?: string;
    defaultFont?: string;       // e.g., "Inter"
    defaultSize?: string;       // e.g., "14px"
    defaultColor?: string;      // e.g., "#1a1a1a"
    lineSpacing?: number;       // e.g., 1.5
    paragraphSpacing?: string;  // e.g., "12px"
    pageSize?: 'A4' | 'Letter' | 'Legal' | 'Custom';
    pageMargins?: {
      top: string;
      right: string;
      bottom: string;
      left: string;
    };
    pageOrientation?: 'portrait' | 'landscape';
  };

  // Block-level formatting (keyed by block ID)
  blocks: {
    [blockId: string]: {
      type?: 'paragraph' | 'heading' | 'list' | 'quote' | 'code';
      align?: 'left' | 'center' | 'right' | 'justify';
      indent?: number;
      spacing?: { before?: string; after?: string };
      // Heading-specific
      level?: 1 | 2 | 3 | 4 | 5 | 6;
      // List-specific
      listStyle?: 'bullet' | 'number' | 'checkbox';
    };
  };

  // Inline formatting (spans within blocks)
  spans: {
    [blockId: string]: Array<{
      start: number;            // Character offset within block
      end: number;
      marks: SpanMark[];
    }>;
  };

  // Image references
  images: {
    [imageId: string]: {
      src: string;              // Path relative to .midlight/images/
      originalName?: string;
      width?: number;
      height?: number;
      align?: 'left' | 'center' | 'right' | 'left-wrap' | 'right-wrap';
      caption?: string;
      alt?: string;
    };
  };

  // Comments/annotations (future)
  comments?: {
    [commentId: string]: {
      blockId: string;
      start: number;
      end: number;
      author: string;
      text: string;
      created: string;
      resolved?: boolean;
    };
  };
}

type SpanMark =
  | { type: 'bold' }
  | { type: 'italic' }
  | { type: 'underline' }
  | { type: 'strike' }
  | { type: 'code' }
  | { type: 'color'; value: string }
  | { type: 'highlight'; value: string }
  | { type: 'fontSize'; value: string }
  | { type: 'fontFamily'; value: string }
  | { type: 'link'; href: string; title?: string }
  | { type: 'superscript' }
  | { type: 'subscript' };
```

<!-- @mid:h-s3rw2w -->
### 6.2 Markdown with Block IDs

<!-- @mid:p-4gc48u -->
To anchor formatting, we inject invisible block IDs:

<!-- @mid:code-ydjuec -->
```markdown
# My Document

The quick brown fox jumps over the lazy dog.

Here's another paragraph with some text.
```

<!-- @mid:p-aaxhq5 -->
**Rules:**

<!-- @mid:list-upq65i -->
- IDs are HTML comments (invisible to renderers)
- Format: `<!-- @mid:{type}-{id} -->`
- Generated automatically, never shown to user
- If missing, regenerated on open

<!-- @mid:h-tmi66w -->
### 6.3 Image Handling

<!-- @mid:p-d131c8 -->
**On paste/drop:**

<!-- @mid:list-f44wrb -->
1. Hash image content (SHA-256, first 16 chars)
2. Save to `.midlight/images/{hash}.{ext}`
3. Add reference to `.midlight` sidecar
4. Insert placeholder in Markdown: `![caption](@img:abc123)`

<!-- @mid:p-5wytq1 -->
**Custom image syntax:**

<!-- @mid:code-4e805g -->
```markdown
![@img:abc123]
```

<!-- @mid:p-473cw0 -->
This is non-standard but:

<!-- @mid:list-ddb8f5 -->
- Degrades to showing `@img:abc123` (tells user there's an image)
- Easy to find and replace
- Doesn't break Markdown parsing

<!-- @mid:p-59zh6r -->
**Alternative (more compatible):**

<!-- @mid:code-o3x0f8 -->
```markdown
![A brown fox](.midlight/images/abc123.png)
```

<!-- @mid:p-5koqa5 -->
This works in GitHub/Obsidian if files are together.

<!-- @mid:h-gr3oro -->
### 6.4 Save Flow

<!-- @mid:code-lncz65 -->
```
┌─────────────────┐
│  Tiptap Editor  │
│  (JSON State)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│  Extract Plain  │────►│   essay.md      │
│  Markdown       │     │  (clean text)   │
└─────────────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│  Extract Format │────►│ essay.md.midlight│
│  Metadata       │     │  (JSON)         │
└─────────────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│  Extract Images │────►│ .midlight/images/│
│  (if new)       │     │  abc123.png     │
└─────────────────┘     └─────────────────┘
```

<!-- @mid:h-uyvbh6 -->
### 6.5 Load Flow

<!-- @mid:code-mef09b -->
```
┌─────────────────┐     ┌─────────────────┐
│   essay.md      │     │ essay.md.midlight│
│  (content)      │     │  (formatting)   │
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     ▼
         ┌─────────────────────┐
         │   Merge Content +   │
         │   Formatting        │
         └──────────┬──────────┘
                    ▼
         ┌─────────────────────┐
         │   Build Tiptap      │
         │   JSON Document     │
         └──────────┬──────────┘
                    ▼
         ┌─────────────────────┐
         │   Load into Editor  │
         └─────────────────────┘
```

<!-- @mid:h-i7l8rn -->
### 6.6 Graceful Degradation

<!-- @mid:p-f494uc -->
**Scenario 1: User opens `.md` in another editor**

<!-- @mid:list-zrkpau -->
- They see clean Markdown with block ID comments
- Comments are invisible in preview
- Content is fully readable and editable
- If they save, block IDs might shift (we handle on re-import)

<!-- @mid:p-ojr9gj -->
**Scenario 2: `.midlight` file is missing**

<!-- @mid:list-688823 -->
- Open Markdown as plain content
- No custom formatting applied
- Document defaults from workspace config
- On first save, create new `.midlight` file

<!-- @mid:p-879fc4 -->
**Scenario 3: Block IDs mismatch**

<!-- @mid:list-f8o5i4 -->
- Re-scan Markdown content
- Attempt to match blocks by content similarity
- Orphaned formatting is discarded
- User sees "Some formatting may have been lost" warning

---

<!-- @mid:h-nxnsie -->
## 7. Migration & Compatibility

<!-- @mid:h-rfp7cq -->
### 7.1 Migrating Current Files

<!-- @mid:p-6lpp4n -->
Current files use inline HTML. Migration process:

<!-- @mid:code-7udpj8 -->
```typescript
async function migrateToSidecar(filePath: string): Promise<void> {
  const content = await readFile(filePath);

  // Parse HTML-embedded Markdown
  const { cleanMarkdown, extractedFormatting, extractedImages } =
    parseHybridMarkdown(content);

  // Write clean Markdown with block IDs
  await writeFile(filePath, cleanMarkdown);

  // Write sidecar
  await writeFile(`${filePath}.midlight`, JSON.stringify(extractedFormatting));

  // Extract and save images
  for (const img of extractedImages) {
    await saveImage(img.data, img.hash);
  }
}
```

<!-- @mid:h-979p3e -->
### 7.2 Import from Other Formats

<!-- @mid:p-olscjs -->
**From DOCX:**

<!-- @mid:list-hy5c7e -->
- Use existing Mammoth import
- Extract images to `.midlight/images/`
- Generate block IDs
- Create `.midlight` sidecar with formatting

<!-- @mid:p-aobmp3 -->
**From HTML:**

<!-- @mid:list-mq189e -->
- Parse HTML structure
- Convert to Markdown + sidecar
- Preserve inline styles as span marks

<!-- @mid:p-4qabve -->
**From Notion Export:**

<!-- @mid:list-3fbnzh -->
- Parse Markdown export
- Limited formatting recovery (Notion strips most)
- Images already external (good)

<!-- @mid:h-lh1ows -->
### 7.3 Export to Other Formats

<!-- @mid:p-h9qyf8 -->
**To DOCX:**

<!-- @mid:list-0oe013 -->
- Merge Markdown + sidecar
- Apply formatting during conversion
- Embed images from `.midlight/images/`
- (Already implemented, needs sidecar awareness)

<!-- @mid:p-itrnwr -->
**To PDF:**

<!-- @mid:list-sqkq4n -->
- Render in Electron with full formatting
- Use `printToPDF` (already implemented)

<!-- @mid:p-uhn8z1 -->
**To Plain Markdown:**

<!-- @mid:list-wcdmzt -->
- Export just the `.md` file
- Strip block ID comments
- User warned: "Formatting will not be preserved"

<!-- @mid:p-hk8clp -->
**To HTML:**

<!-- @mid:list-ookwwl -->
- Render Tiptap state to HTML
- Inline all styles
- Embed or link images

---

<!-- @mid:h-sf3zqa -->
## 8. Version Control Integration

<!-- @mid:h-0cggou -->
### 8.1 What Gets Versioned

<!-- @mid:p-bdz8lh -->
With the sidecar approach:

<!-- @mid:p-5czpe4 -->
`| Component | Versioned? | Why |
|-----------|------------|-----|
| ``essay.md`` | ✓ | Content changes tracked |
| ``essay.md.midlight`` | ✓ | Formatting changes tracked |
| ``.midlight/images/*`` | ✓ | Media changes tracked |`

<!-- @mid:h-jk0moi -->
### 8.2 Efficient Diffing

<!-- @mid:p-z840i3 -->
**Markdown diff**** (clean, meaningful):**

<!-- @mid:code-tzxg3a -->
```diff
  # My Document

- The quick brown fox jumps over the lazy dog.
+ The quick brown fox leaps over the lazy dog.
```

<!-- @mid:p-izhxtj -->
**Sidecar diff**** (formatting changes isolated):**

<!-- @mid:code-8ezq6a -->
```diff
  "blocks": {
    "p-002": {
-     "align": "left"
+     "align": "center"
    }
  }
```

<!-- @mid:h-73q4b9 -->
### 8.3 Content-Addressable Images

<!-- @mid:p-y9h67c -->
Images stored by hash means:

<!-- @mid:list-95n1ce -->
- Same image used twice → stored once
- Unchanged images don't inflate versions
- Easy deduplication in sync

<!-- @mid:h-qa7ppq -->
### 8.4 Merge Conflicts

<!-- @mid:p-c8kqxr -->
**Markdown conflict****: Standard text merge
****Sidecar conflict****: JSON merge (more complex)**

<!-- @mid:p-2gkqvd -->
Strategy for sidecar:

<!-- @mid:list-mx3g1l -->
- Block-level merge (each block independent)
- Span-level: last writer wins (or prompt user)
- Document settings: last writer wins

---

<!-- @mid:h-oyeimg -->
## 9. Decision Matrix

<!-- @mid:h-vktrbk -->
### Option Comparison

<!-- @mid:p-rcga47 -->
| Factor | Inline HTML | YAML Only | Sidecar | Pure JSON | Attributes |
|--------|-------------|-----------|---------|-----------|------------|
| MD Readability | ❌ Poor | ⚠️ OK | ✅ Clean | ❌ None | ⚠️ OK |
| Format Fidelity | ⚠️ Limited | ❌ Poor | ✅ Full | ✅ Full | ⚠️ Limited |
| Other Editor Compat | ⚠️ Partial | ✅ Good | ✅ Good | ❌ None | ⚠️ Partial |
| Version Control | ❌ Noisy | ✅ Good | ✅ Great | ⚠️ OK | ✅ Good |
| Image Handling | ❌ Bloated | ❌ Same | ✅ Optimal | ✅ Optimal | ❌ Same |
| Doc-Level Settings | ❌ None | ✅ Yes | ✅ Yes | ✅ Yes | ⚠️ Limited |
| Implementation | ✅ Done | ⚠️ Medium | ⚠️ Medium | ⚠️ Medium | ⚠️ Medium |
| Future-Proof | ❌ Limited | ⚠️ OK | ✅ Great | ✅ Great | ⚠️ Limited |

<!-- @mid:h-ga6lwk -->
### Recommendation Summary

<!-- @mid:p-dm5oua -->
**For Midlight, implement the Sidecar approach (Option C) because:**

<!-- @mid:list-2k5dwc -->
1. **Maintains Markdown Promise**: Users' content is always accessible
2. **Full Word Processor Parity**: JSON sidecar can store anything
3. **Optimal for Version Control**: Clean diffs, efficient storage
4. **Graceful Degradation**: Works without sidecar (just loses formatting)
5. **Future-Ready**: Easy to extend, sync, collaborate

<!-- @mid:h-qbvuph -->
### Implementation Priority

<!-- @mid:list-frgj8o -->
1. **Phase 1**: Document-level settings in sidecar
2. **Phase 2**: Block-level formatting (alignment, spacing)
3. **Phase 3**: Span-level formatting (colors, fonts)
4. **Phase 4**: Image extraction and management
5. **Phase 5**: Migration from current inline HTML format

---

<!-- @mid:h-fi5zm7 -->
## Appendix A: Example Complete Document

<!-- @mid:h-2sbe8u -->
### essay.md

<!-- @mid:code-buyciu -->
```markdown
# The Art of Writing

Writing is both a craft and an art form. It requires practice, patience, and a willingness to revise.

## Key Principles

The most important aspects of good writing are:

- Clarity of thought
- Economy of words
- Authentic voice

![@img:typewriter]

As Stephen King wrote: "The road to hell is paved with adverbs."
```

<!-- @mid:h-m5th5x -->
### essay.md.midlight

<!-- @mid:code-1vvc5t -->
```json
{
  "version": 1,
  "document": {
    "title": "The Art of Writing",
    "author": "Jane Doe",
    "created": "2024-01-15T10:30:00Z",
    "modified": "2024-01-15T14:22:00Z",
    "defaultFont": "Merriweather",
    "defaultSize": "16px",
    "lineSpacing": 1.6,
    "pageSize": "A4",
    "pageMargins": {
      "top": "1in",
      "right": "1.25in",
      "bottom": "1in",
      "left": "1.25in"
    }
  },
  "blocks": {
    "h-001": { "align": "center" },
    "p-002": { "align": "justify", "spacing": { "after": "1em" } },
    "p-004": { "indent": 1 },
    "q-007": { "align": "center", "fontStyle": "italic" }
  },
  "spans": {
    "p-002": [
      { "start": 0, "end": 7, "marks": [{ "type": "bold" }] },
      { "start": 45, "end": 53, "marks": [{ "type": "italic" }] }
    ],
    "q-007": [
      { "start": 3, "end": 15, "marks": [{ "type": "bold" }, { "type": "color", "value": "#2563eb" }] }
    ]
  },
  "images": {
    "typewriter": {
      "src": "abc123def456.jpg",
      "originalName": "vintage-typewriter.jpg",
      "width": 600,
      "height": 400,
      "align": "center",
      "caption": "A vintage typewriter, symbol of the writing craft"
    }
  }
}
```

---

<!-- @mid:h-5wlo3z -->
## Appendix B: References

<!-- @mid:list-o3vkig -->
- Markdown Guide - Hacks
- Obsidian Metadata
- MDX Specification
- Pandoc Markdown Extensions
- Notion Export Limitations

---

<!-- @mid:p-uhpwfr -->
*Document created: 2025-12-05**
**Status: Architecture decision needed before implementation*