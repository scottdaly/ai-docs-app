<!-- @mid:h-vlno8n -->
# Markdown Storage Strategy: Achieving Word Processor Parity

<!-- @mid:p-jbkyor -->
A critical analysis of how to store rich document features while maintaining Markdown as the backbone, and whether this is the right architectural choice.

---

<!-- @mid:h-3cvmsg -->
## Table of Contents

<!-- @mid:list-xgc2au -->
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

<!-- @mid:h-yq5kzw -->
## 1. The Fundamental Tension

<!-- @mid:h-mw587z -->
### What Markdown Does Well

<!-- @mid:p-8lugzr -->
**Markdown was designed for ****semantic simplicity****:**

<!-- @mid:code-s5lq2x -->
```markdown
# Heading           → "This is important"
**bold**            → "This is emphasized"
- item              → "This is a list"
[link](url)         → "This points somewhere"
```

<!-- @mid:p-6kg3sk -->
**It deliberately ****avoids**** visual formatting because:**

<!-- @mid:list-1rgjcc -->
- Content should be portable across renderers
- Presentation should be separate from content
- Files should be human-readable

<!-- @mid:h-6p3i89 -->
### What Word Processors Expect

<!-- @mid:p-6ooem5 -->
**Users expect ****visual formatting****:**

<!-- @mid:p-qyilkx -->
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

<!-- @mid:h-nrqhwc -->
### The Core Question

<!-- @mid:bq-b8xndh -->
> **Can we achieve word processor feature parity while keeping Markdown as "the backbone"?**

<!-- @mid:p-z59wdu -->
**Short answer****: Yes, but Markdown becomes the ****content backbone****, not the ****format backbone****. We need additional storage for visual formatting.**

---

<!-- @mid:h-3mu6hg -->
## 2. Current Implementation Analysis

<!-- @mid:h-xcr8l9 -->
### How We Currently Store Rich Formatting

<!-- @mid:p-0n8bqu -->
**````File````****````: ````****````src/utils/markdown.ts````**

<!-- @mid:p-5yyl60 -->
**We use ****inline HTML within Markdown**** for features Markdown doesn't support:**

<!-- @mid:code-fdznu4 -->
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

<!-- @mid:h-4xs458 -->
### Problems with Current Approach

<!-- @mid:h-rrkceg -->
#### **1. ****Bloated Files**

<!-- @mid:code-2ru74n -->
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

<!-- @mid:p-6yldoi -->
A paragraph that would be 50 characters becomes 400+ characters.

<!-- @mid:p-pfni5j -->
***#### 2. ******Lost Readability********************
The file is no longer "human-readable Markdown"—it's HTML soup:*****************

<!-- @mid:code-vq0rei -->
```markdown
<p style="text-align: justify"><span style="font-family: 'Inter'; font-size: 14px; color: #1a1a1a">Lorem ipsum dolor sit amet, <span style="font-weight: bold; color: #ff0000">consectetur</span> adipiscing elit.</span></p>
```

<!-- @mid:h-aocmu9 -->
#### **3. ****Renderer Incompatibility**

<!-- @mid:list-pqmzpt -->
- GitHub won't render `style` attributes (security)
- Many Markdown viewers strip HTML
- Obsidian shows raw HTML
- Static site generators may sanitize

<!-- @mid:p-2xx47g -->
***#### 4. ******Diff Noise********************
Version control becomes useless:*****************

<!-- @mid:code-cgxjm2 -->
```diff
- <span style="font-family: 'Inter'; font-size: 14px">Hello</span>
+ <span style="font-family: 'Inter'; font-size: 16px">Hello</span>
```

<!-- @mid:p-wi89ah -->
User changed font size, but it looks like the whole line changed.

<!-- @mid:p-m3x6uk -->
***#### 5. ******No Document-Level Settings********************
Where do we store:*****************

<!-- @mid:list-g3i7oq -->
- Default font for the document?
- Page margins?
- Line spacing?
- Theme preferences?

<!-- @mid:p-rtjwty -->
**Currently: ****Nowhere****. Every paragraph carries its own styles.**

<!-- @mid:p-vc06pw -->
***#### 6. ******Image Problems********************
Base64 images embedded in Markdown:*****************

<!-- @mid:list-6qa3e0 -->
- 1MB image = 1.37MB in base64
- Every version stores the full image
- Files become multi-megabyte

---

<!-- @mid:h-m409mq -->
## 3. Feature Storage Requirements

<!-- @mid:h-zyvx8d -->
### Complete Feature Inventory

<!-- @mid:p-ehturz -->
Let's catalog everything a word processor user expects:

<!-- @mid:p-ltj1ms -->
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

<!-- @mid:p-8tc07g -->
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

<!-- @mid:p-s01mnc -->
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

<!-- @mid:p-ckwa9r -->
#### Media & Objects
| Feature | Storage Need | Current Support |
|---------|--------------|-----------------|
| Images | URL or embedded | ⚠️ Base64 inline |
| Image size | Per-image attrs | ⚠️ Data attributes |
| Image alignment | Per-image attrs | ⚠️ Data attributes |
| Image caption | Per-image | ❌ None |
| Tables | GFM or HTML | ⚠️ Limited |
| Embeds (video, etc.) | URL reference | ❌ None |

<!-- @mid:p-ylv2e7 -->
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

<!-- @mid:h-6fbb7y -->
## 4. Storage Architecture Options

<!-- @mid:h-ooz1bt -->
### Option A: Pure Markdown + Inline HTML (Current)

<!-- @mid:p-lqqws7 -->
`Keep everything in one ``.md`` file with HTML for rich features.`

<!-- @mid:code-up3cj6 -->
```markdown
---
title: My Document
---

# Heading

<p style="text-align: center; font-family: Inter; font-size: 18px">
Styled paragraph content here.
</p>
```

<!-- @mid:p-u9p8kd -->
**Pros:**

<!-- @mid:list-73e4d2 -->
- Single file
- "It's still Markdown"
- No format change needed

<!-- @mid:p-aha2f1 -->
**Cons:**

<!-- @mid:list-gq9vkl -->
- Bloated, unreadable files
- No document-level settings
- Base64 images explode file size
- Diff/version control useless
- Other Markdown tools won't render correctly

<!-- @mid:p-og6p3u -->
**Verdict:**** ❌ ****Not viable for word processor parity**

---

<!-- @mid:h-o9oue2 -->
### Option B: Markdown + YAML Frontmatter

<!-- @mid:p-0jllng -->
Use YAML frontmatter for document settings, keep inline HTML for span formatting.

<!-- @mid:code-c14sio -->
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

<!-- @mid:p-g97jg3 -->
**Pros:**

<!-- @mid:list-bgpirf -->
- Document settings have a home
- Standard format (Obsidian, Jekyll, etc.)
- Still one file

<!-- @mid:p-gx5nw5 -->
**Cons:**

<!-- @mid:list-wf9260 -->
- Inline HTML still bloats content
- No solution for images
- Frontmatter can't handle complex structures (per-paragraph styles)
- Still unreadable with heavy formatting

<!-- @mid:p-lrb0s8 -->
**Verdict:**** ⚠️ ****Partial solution—good for document metadata, not formatting**

---

<!-- @mid:h-s3ryot -->
### Option C: Markdown + Sidecar JSON

<!-- @mid:p-x5yszx -->
Store content in Markdown, formatting/metadata in a companion file.

<!-- @mid:code-gtav9b -->
```
document.md           # Pure, clean Markdown
document.md.midlight  # Formatting, settings, media references
```

<!-- @mid:p-m3hozr -->
**document.md:**

<!-- @mid:code-o8p1ar -->
```markdown
# My Document

The quick brown fox jumps over the lazy dog.

Here's another paragraph with some important text.
```

<!-- @mid:p-wjgzc9 -->
**document.md.midlight:**

<!-- @mid:code-w7154k -->
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

<!-- @mid:p-9bhu96 -->
**Pros:**

<!-- @mid:list-xuarw1 -->
- Markdown stays clean and portable
- All formatting centralized and structured
- Images stored separately (efficient)
- Easy to diff/version control
- Could open `.md` in any editor (basic viewing)

<!-- @mid:p-zgex8d -->
**Cons:**

<!-- @mid:list-r3zlsg -->
- Two files per document
- Sync complexity (what if one changes?)
- Position tracking (`start: 45`) fragile
- Midlight-specific format
- Learning curve for users who look at files

<!-- @mid:p-u611gn -->
**Verdict:**** ⚠️ ****Good separation, but position-based spans are fragile**

---

<!-- @mid:h-vm89rw -->
### Option D: Tiptap JSON as Primary Format

<!-- @mid:p-j90wd2 -->
Abandon Markdown storage; use Tiptap's native JSON.

<!-- @mid:p-0skd1g -->
**document.midlight:**

<!-- @mid:code-ykoha0 -->
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

<!-- @mid:p-wkvf8n -->
**Pros:**

<!-- @mid:list-hxn9ug -->
- Perfect fidelity with editor state
- No conversion loss
- All formatting naturally preserved
- Structured, queryable
- Future-proof for collaboration (CRDTs)

<!-- @mid:p-k2n1ir -->
**Cons:**

<!-- @mid:list-qymcuf -->
- Not human-readable
- Can't open in other editors
- Proprietary format lock-in
- Breaks "Markdown backbone" promise
- Users can't edit files manually

<!-- @mid:p-szhqwh -->
**Verdict:**** ⚠️ ****Maximum fidelity, but abandons Markdown philosophy**

---

<!-- @mid:h-l401an -->
### Option E: Hybrid—Markdown Content + Embedded Formatting Blocks

<!-- @mid:p-exq48x -->
Use Markdown with special code blocks for formatting data.

<!-- @mid:code-vyl69s -->
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

<!-- @mid:p-1u9pz0 -->
**Pros:**

<!-- @mid:list-9v0wa4 -->
- Single file
- Markdown viewers show content (ignore comment)
- All data together
- HTML comment is standard

<!-- @mid:p-g09isd -->
**Cons:**

<!-- @mid:list-itshvw -->
- Fragile text matching for spans
- Comment block is ugly
- Position tracking still problematic
- Complex parsing

<!-- @mid:p-vszwox -->
**Verdict:**** ⚠️ ****Clever hack, but fragile**

---

<!-- @mid:h-ew8og7 -->
### Option F: Markdown + Per-Block Attributes (Custom Syntax)

<!-- @mid:p-in3qds -->
Extend Markdown with attribute syntax (like Pandoc/Kramdown).

<!-- @mid:code-de69jo -->
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

<!-- @mid:p-oxcayb -->
**Pros:**

<!-- @mid:list-8g034s -->
- Stays in Markdown paradigm
- Attributes are inline with content
- Used by Pandoc, Hugo, Jekyll
- Readable

<!-- @mid:p-x5ywxt -->
**Cons:**

<!-- @mid:list-f3xn8c -->
- Non-standard Markdown
- Limited expressiveness (can't do `color: #ff3366`)
- Requires custom parser
- Other tools won't understand

<!-- @mid:p-97xqcp -->
**Verdict:**** ⚠️ ****Elegant but limited and non-standard**

---

<!-- @mid:h-wdocv1 -->
## 5. Recommendation: Hybrid Markdown+Sidecar

<!-- @mid:p-8zw5k9 -->
**After analyzing all options, I recommend ****Option C (Sidecar) with improvements****:**

<!-- @mid:h-e3cr5u -->
### The Approach

<!-- @mid:code-kzxain -->
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

<!-- @mid:h-5odib6 -->
### Why This Approach?

<!-- @mid:list-h5czyu -->
1. **Markdown stays portable**: Open `essay.md` in any editor, GitHub, Obsidian
2. **Rich formatting preserved**: `.midlight` file has everything
3. **Images optimized**: Not embedded, deduplicated by hash
4. **Version control friendly**: Markdown diffs are meaningful
5. **Graceful degradation**: Without `.midlight`, content still readable
6. **Forward compatible**: Can add features without breaking format

<!-- @mid:h-deda3q -->
### Solving the Position Problem

<!-- @mid:p-1gbxvs -->
**Instead of character positions (fragile), use ****content addressing****:**

<!-- @mid:code-leil46 -->
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

<!-- @mid:p-fvecem -->
**Or use ****block IDs**** that Tiptap can generate:**

<!-- @mid:code-u5c6bg -->
```markdown
The quick brown fox jumps over the lazy dog.
<!-- mid:p-a1b2c3 -->
```

<!-- @mid:p-oydyf0 -->
The comment is invisible to renderers but lets us anchor formatting.

---

<!-- @mid:h-uwdi4y -->
## 6. Implementation Specification

<!-- @mid:h-8zfa0w -->
### `6.1 File Format: ``.midlight`` Sidecar`

<!-- @mid:code-cb9hvd -->
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

<!-- @mid:h-yhuck5 -->
### 6.2 Markdown with Block IDs

<!-- @mid:p-h6p24v -->
To anchor formatting, we inject invisible block IDs:

<!-- @mid:code-nedpd3 -->
```markdown
# My Document

The quick brown fox jumps over the lazy dog.

Here's another paragraph with some text.
```

<!-- @mid:p-gqeghb -->
**Rules:**

<!-- @mid:list-ia0aoy -->
- IDs are HTML comments (invisible to renderers)
- Format: `<!-- @mid:{type}-{id} -->`
- Generated automatically, never shown to user
- If missing, regenerated on open

<!-- @mid:h-b0m3hi -->
### 6.3 Image Handling

<!-- @mid:p-uzfo2u -->
**On paste/drop:**

<!-- @mid:list-sh6t0m -->
1. Hash image content (SHA-256, first 16 chars)
2. Save to `.midlight/images/{hash}.{ext}`
3. Add reference to `.midlight` sidecar
4. Insert placeholder in Markdown: `![caption](@img:abc123)`

<!-- @mid:p-sel9iv -->
**Custom image syntax:**

<!-- @mid:code-gb1arw -->
```markdown
![@img:abc123]
```

<!-- @mid:p-q7l1nx -->
This is non-standard but:

<!-- @mid:list-uc73bh -->
- Degrades to showing `@img:abc123` (tells user there's an image)
- Easy to find and replace
- Doesn't break Markdown parsing

<!-- @mid:p-3z9rpn -->
**Alternative (more compatible):**

<!-- @mid:code-k0p1ik -->
```markdown
![A brown fox](.midlight/images/abc123.png)
```

<!-- @mid:p-lpu1u4 -->
This works in GitHub/Obsidian if files are together.

<!-- @mid:h-9wwy6e -->
### 6.4 Save Flow

<!-- @mid:code-63cr12 -->
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

<!-- @mid:h-016y89 -->
### 6.5 Load Flow

<!-- @mid:code-2z092a -->
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

<!-- @mid:h-la9ikl -->
### 6.6 Graceful Degradation

<!-- @mid:p-0d6jkh -->
**Scenario 1: User opens `.md` in another editor**

<!-- @mid:list-582184 -->
- They see clean Markdown with block ID comments
- Comments are invisible in preview
- Content is fully readable and editable
- If they save, block IDs might shift (we handle on re-import)

<!-- @mid:p-mqwxc3 -->
**Scenario 2: `.midlight` file is missing**

<!-- @mid:list-es8y6s -->
- Open Markdown as plain content
- No custom formatting applied
- Document defaults from workspace config
- On first save, create new `.midlight` file

<!-- @mid:p-ixir25 -->
**Scenario 3: Block IDs mismatch**

<!-- @mid:list-3udrgv -->
- Re-scan Markdown content
- Attempt to match blocks by content similarity
- Orphaned formatting is discarded
- User sees "Some formatting may have been lost" warning

---

<!-- @mid:h-09smft -->
## 7. Migration & Compatibility

<!-- @mid:h-mskc6q -->
### 7.1 Migrating Current Files

<!-- @mid:p-2o6q4x -->
Current files use inline HTML. Migration process:

<!-- @mid:code-kkfyyd -->
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

<!-- @mid:h-1z64jj -->
### 7.2 Import from Other Formats

<!-- @mid:p-gqalrv -->
**From DOCX:**

<!-- @mid:list-thvjpg -->
- Use existing Mammoth import
- Extract images to `.midlight/images/`
- Generate block IDs
- Create `.midlight` sidecar with formatting

<!-- @mid:p-rtvyd4 -->
**From HTML:**

<!-- @mid:list-rkwwqe -->
- Parse HTML structure
- Convert to Markdown + sidecar
- Preserve inline styles as span marks

<!-- @mid:p-im1obw -->
**From Notion Export:**

<!-- @mid:list-6do805 -->
- Parse Markdown export
- Limited formatting recovery (Notion strips most)
- Images already external (good)

<!-- @mid:h-avjn40 -->
### 7.3 Export to Other Formats

<!-- @mid:p-26p7q4 -->
**To DOCX:**

<!-- @mid:list-zfrydy -->
- Merge Markdown + sidecar
- Apply formatting during conversion
- Embed images from `.midlight/images/`
- (Already implemented, needs sidecar awareness)

<!-- @mid:p-uh8bvy -->
**To PDF:**

<!-- @mid:list-e4wwqs -->
- Render in Electron with full formatting
- Use `printToPDF` (already implemented)

<!-- @mid:p-z4dp19 -->
**To Plain Markdown:**

<!-- @mid:list-tsdfs2 -->
- Export just the `.md` file
- Strip block ID comments
- User warned: "Formatting will not be preserved"

<!-- @mid:p-bcl3xr -->
**To HTML:**

<!-- @mid:list-rhecok -->
- Render Tiptap state to HTML
- Inline all styles
- Embed or link images

---

<!-- @mid:h-3wsuip -->
## 8. Version Control Integration

<!-- @mid:h-koaflw -->
### 8.1 What Gets Versioned

<!-- @mid:p-gezbg8 -->
With the sidecar approach:

<!-- @mid:p-gp1g9r -->
`| Component | Versioned? | Why |
|-----------|------------|-----|
| ``essay.md`` | ✓ | Content changes tracked |
| ``essay.md.midlight`` | ✓ | Formatting changes tracked |
| ``.midlight/images/*`` | ✓ | Media changes tracked |`

<!-- @mid:h-40lil4 -->
### 8.2 Efficient Diffing

<!-- @mid:p-rej7ry -->
**Markdown diff**** (clean, meaningful):**

<!-- @mid:code-riurl0 -->
```diff
  # My Document

- The quick brown fox jumps over the lazy dog.
+ The quick brown fox leaps over the lazy dog.
```

<!-- @mid:p-d46u32 -->
**Sidecar diff**** (formatting changes isolated):**

<!-- @mid:code-v9499n -->
```diff
  "blocks": {
    "p-002": {
-     "align": "left"
+     "align": "center"
    }
  }
```

<!-- @mid:h-u2hlde -->
### 8.3 Content-Addressable Images

<!-- @mid:p-dh6qpy -->
Images stored by hash means:

<!-- @mid:list-se7lm6 -->
- Same image used twice → stored once
- Unchanged images don't inflate versions
- Easy deduplication in sync

<!-- @mid:h-9ku580 -->
### 8.4 Merge Conflicts

<!-- @mid:p-wpj03s -->
***Markdown conflict***************************: Standard text merge
*************Sidecar conflict*******: JSON merge (more complex)**********

<!-- @mid:p-8rpgsj -->
Strategy for sidecar:

<!-- @mid:list-ivh6vh -->
- Block-level merge (each block independent)
- Span-level: last writer wins (or prompt user)
- Document settings: last writer wins

---

<!-- @mid:h-h7l9mh -->
## 9. Decision Matrix

<!-- @mid:h-7s9ru7 -->
### Option Comparison

<!-- @mid:p-lhj1nm -->
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

<!-- @mid:h-a16jbx -->
### Recommendation Summary

<!-- @mid:p-srl9yu -->
**For Midlight, implement the Sidecar approach (Option C) because:**

<!-- @mid:list-2h6rw0 -->
1. **Maintains Markdown Promise**: Users' content is always accessible
2. **Full Word Processor Parity**: JSON sidecar can store anything
3. **Optimal for Version Control**: Clean diffs, efficient storage
4. **Graceful Degradation**: Works without sidecar (just loses formatting)
5. **Future-Ready**: Easy to extend, sync, collaborate

<!-- @mid:h-f53643 -->
### Implementation Priority

<!-- @mid:list-acj1dj -->
1. **Phase 1**: Document-level settings in sidecar
2. **Phase 2**: Block-level formatting (alignment, spacing)
3. **Phase 3**: Span-level formatting (colors, fonts)
4. **Phase 4**: Image extraction and management
5. **Phase 5**: Migration from current inline HTML format

---

<!-- @mid:h-30ipgw -->
## Appendix A: Example Complete Document

<!-- @mid:h-0qnkty -->
### essay.md

<!-- @mid:code-d1c9b3 -->
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

<!-- @mid:h-p9fmj1 -->
### essay.md.midlight

<!-- @mid:code-ph3zu5 -->
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

<!-- @mid:h-ugsz7d -->
## Appendix B: References

<!-- @mid:list-nz9umk -->
- Markdown Guide - Hacks
- Obsidian Metadata
- MDX Specification
- Pandoc Markdown Extensions
- Notion Export Limitations

---

<!-- @mid:p-vciab2 -->
*Document created: 2025-12-05*********
******Status: Architecture decision needed before implementation******