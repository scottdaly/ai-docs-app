import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { DocumentSerializer } from './documentSerializer';
import { DocumentDeserializer } from './documentDeserializer';
import { ImageManager } from './imageManager';
import { createEmptySidecar } from './types';

describe('DocumentSerializer', () => {
  let testDir: string;
  let imageManager: ImageManager;
  let serializer: DocumentSerializer;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'serializer-test-'));
    imageManager = new ImageManager(testDir);
    await imageManager.init();
    serializer = new DocumentSerializer(imageManager);
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('serialize', () => {
    it('should serialize a simple paragraph', async () => {
      const json = {
        type: 'doc' as const,
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Hello, World!' }],
          },
        ],
      };

      const result = await serializer.serialize(json);

      expect(result.markdown).toContain('Hello, World!');
      expect(result.markdown).toMatch(/<!-- @mid:p-[a-z0-9]+ -->/);
      expect(result.sidecar.version).toBe(1);
    });

    it('should serialize headings with correct level', async () => {
      const json = {
        type: 'doc' as const,
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: 'Title' }],
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: 'Subtitle' }],
          },
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'Section' }],
          },
        ],
      };

      const result = await serializer.serialize(json);

      expect(result.markdown).toContain('# Title');
      expect(result.markdown).toContain('## Subtitle');
      expect(result.markdown).toContain('### Section');
    });

    it('should serialize bold text with markdown syntax', async () => {
      const json = {
        type: 'doc' as const,
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'This is ' },
              { type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
              { type: 'text', text: ' text.' },
            ],
          },
        ],
      };

      const result = await serializer.serialize(json);

      expect(result.markdown).toContain('**bold**');
    });

    it('should serialize italic text with markdown syntax', async () => {
      const json = {
        type: 'doc' as const,
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'This is ' },
              { type: 'text', text: 'italic', marks: [{ type: 'italic' }] },
              { type: 'text', text: ' text.' },
            ],
          },
        ],
      };

      const result = await serializer.serialize(json);

      expect(result.markdown).toContain('*italic*');
    });

    it('should serialize bold italic text', async () => {
      const json = {
        type: 'doc' as const,
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'bold italic',
                marks: [{ type: 'bold' }, { type: 'italic' }],
              },
            ],
          },
        ],
      };

      const result = await serializer.serialize(json);

      expect(result.markdown).toContain('***bold italic***');
    });

    it('should serialize inline code', async () => {
      const json = {
        type: 'doc' as const,
        content: [
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Use ' },
              { type: 'text', text: 'console.log()', marks: [{ type: 'code' }] },
              { type: 'text', text: ' for debugging.' },
            ],
          },
        ],
      };

      const result = await serializer.serialize(json);

      expect(result.markdown).toContain('`console.log()`');
    });

    it('should serialize bullet lists', async () => {
      const json = {
        type: 'doc' as const,
        content: [
          {
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [
                  { type: 'paragraph', content: [{ type: 'text', text: 'Item 1' }] },
                ],
              },
              {
                type: 'listItem',
                content: [
                  { type: 'paragraph', content: [{ type: 'text', text: 'Item 2' }] },
                ],
              },
            ],
          },
        ],
      };

      const result = await serializer.serialize(json);

      expect(result.markdown).toContain('- Item 1');
      expect(result.markdown).toContain('- Item 2');
    });

    it('should serialize ordered lists', async () => {
      const json = {
        type: 'doc' as const,
        content: [
          {
            type: 'orderedList',
            content: [
              {
                type: 'listItem',
                content: [
                  { type: 'paragraph', content: [{ type: 'text', text: 'First' }] },
                ],
              },
              {
                type: 'listItem',
                content: [
                  { type: 'paragraph', content: [{ type: 'text', text: 'Second' }] },
                ],
              },
            ],
          },
        ],
      };

      const result = await serializer.serialize(json);

      expect(result.markdown).toContain('1. First');
      expect(result.markdown).toContain('2. Second');
    });

    it('should serialize blockquotes', async () => {
      const json = {
        type: 'doc' as const,
        content: [
          {
            type: 'blockquote',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'A wise quote.' }],
              },
            ],
          },
        ],
      };

      const result = await serializer.serialize(json);

      expect(result.markdown).toContain('> A wise quote.');
    });

    it('should serialize code blocks', async () => {
      const json = {
        type: 'doc' as const,
        content: [
          {
            type: 'codeBlock',
            attrs: { language: 'javascript' },
            content: [{ type: 'text', text: 'const x = 1;' }],
          },
        ],
      };

      const result = await serializer.serialize(json);

      expect(result.markdown).toContain('```javascript');
      expect(result.markdown).toContain('const x = 1;');
      expect(result.markdown).toContain('```');
    });

    it('should serialize horizontal rules', async () => {
      const json = {
        type: 'doc' as const,
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Before' }] },
          { type: 'horizontalRule' },
          { type: 'paragraph', content: [{ type: 'text', text: 'After' }] },
        ],
      };

      const result = await serializer.serialize(json);

      expect(result.markdown).toContain('---');
    });

    it('should store text alignment in sidecar', async () => {
      const json = {
        type: 'doc' as const,
        content: [
          {
            type: 'paragraph',
            attrs: { textAlign: 'center' },
            content: [{ type: 'text', text: 'Centered text' }],
          },
        ],
      };

      const result = await serializer.serialize(json);

      // Should have block formatting in sidecar
      const blockIds = Object.keys(result.sidecar.blocks);
      expect(blockIds.length).toBe(1);
      expect(result.sidecar.blocks[blockIds[0]].align).toBe('center');
    });

    it('should store color marks in sidecar spans', async () => {
      const json = {
        type: 'doc' as const,
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'colored text',
                marks: [{ type: 'textStyle', attrs: { color: '#ff0000' } }],
              },
            ],
          },
        ],
      };

      const result = await serializer.serialize(json);

      // Should have span formatting in sidecar
      const spanKeys = Object.keys(result.sidecar.spans);
      expect(spanKeys.length).toBe(1);

      const spans = result.sidecar.spans[spanKeys[0]];
      expect(spans.length).toBe(1);
      expect(spans[0].marks).toContainEqual({ type: 'color', value: '#ff0000' });
    });

    it('should update word count in metadata', async () => {
      const json = {
        type: 'doc' as const,
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'One two three four five' }],
          },
        ],
      };

      const result = await serializer.serialize(json);

      expect(result.sidecar.meta.wordCount).toBe(5);
    });

    it('should extract title from first heading', async () => {
      const json = {
        type: 'doc' as const,
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: 'My Document Title' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Some content.' }],
          },
        ],
      };

      const result = await serializer.serialize(json);

      expect(result.sidecar.meta.title).toBe('My Document Title');
    });

    it('should preserve existing sidecar metadata', async () => {
      const existingSidecar = createEmptySidecar();
      existingSidecar.meta.author = 'Test Author';
      existingSidecar.meta.tags = ['tag1', 'tag2'];

      const json = {
        type: 'doc' as const,
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Content' }],
          },
        ],
      };

      const result = await serializer.serialize(json, existingSidecar);

      expect(result.sidecar.meta.author).toBe('Test Author');
      expect(result.sidecar.meta.tags).toEqual(['tag1', 'tag2']);
    });
  });
});

describe('DocumentDeserializer', () => {
  let testDir: string;
  let imageManager: ImageManager;
  let deserializer: DocumentDeserializer;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'deserializer-test-'));
    imageManager = new ImageManager(testDir);
    await imageManager.init();
    deserializer = new DocumentDeserializer(imageManager);
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  describe('deserialize', () => {
    it('should deserialize a simple paragraph', async () => {
      const markdown = '<!-- @mid:p-abc123 -->\nHello, World!';

      const result = await deserializer.deserialize(markdown);

      expect(result.type).toBe('doc');
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('paragraph');
    });

    it('should deserialize headings', async () => {
      const markdown = `<!-- @mid:h-abc123 -->
# Title

<!-- @mid:h-def456 -->
## Subtitle`;

      const result = await deserializer.deserialize(markdown);

      expect(result.content).toHaveLength(2);
      expect(result.content[0].type).toBe('heading');
      expect(result.content[0].attrs?.level).toBe(1);
      expect(result.content[1].type).toBe('heading');
      expect(result.content[1].attrs?.level).toBe(2);
    });

    it('should deserialize bold text', async () => {
      const markdown = '<!-- @mid:p-abc123 -->\nThis is **bold** text.';

      const result = await deserializer.deserialize(markdown);

      const paragraph = result.content[0];
      expect(paragraph.content?.some(node =>
        node.text === 'bold' && node.marks?.some(m => m.type === 'bold')
      )).toBe(true);
    });

    it('should deserialize italic text', async () => {
      const markdown = '<!-- @mid:p-abc123 -->\nThis is *italic* text.';

      const result = await deserializer.deserialize(markdown);

      const paragraph = result.content[0];
      expect(paragraph.content?.some(node =>
        node.text === 'italic' && node.marks?.some(m => m.type === 'italic')
      )).toBe(true);
    });

    it('should deserialize inline code', async () => {
      const markdown = '<!-- @mid:p-abc123 -->\nUse `console.log()` for debugging.';

      const result = await deserializer.deserialize(markdown);

      const paragraph = result.content[0];
      expect(paragraph.content?.some(node =>
        node.text === 'console.log()' && node.marks?.some(m => m.type === 'code')
      )).toBe(true);
    });

    it('should deserialize bullet lists', async () => {
      const markdown = `<!-- @mid:list-abc123 -->
- Item 1
- Item 2
- Item 3`;

      const result = await deserializer.deserialize(markdown);

      expect(result.content[0].type).toBe('bulletList');
      expect(result.content[0].content).toHaveLength(3);
    });

    it('should deserialize ordered lists', async () => {
      const markdown = `<!-- @mid:list-abc123 -->
1. First
2. Second
3. Third`;

      const result = await deserializer.deserialize(markdown);

      expect(result.content[0].type).toBe('orderedList');
      expect(result.content[0].content).toHaveLength(3);
    });

    it('should deserialize code blocks', async () => {
      const markdown = `<!-- @mid:code-abc123 -->
\`\`\`javascript
const x = 1;
const y = 2;
\`\`\``;

      const result = await deserializer.deserialize(markdown);

      expect(result.content[0].type).toBe('codeBlock');
      expect(result.content[0].attrs?.language).toBe('javascript');
    });

    it('should deserialize blockquotes', async () => {
      const markdown = `<!-- @mid:bq-abc123 -->
> This is a quote.
> It spans multiple lines.`;

      const result = await deserializer.deserialize(markdown);

      expect(result.content[0].type).toBe('blockquote');
    });

    it('should deserialize horizontal rules', async () => {
      const markdown = `<!-- @mid:p-abc123 -->
Before

---

<!-- @mid:p-def456 -->
After`;

      const result = await deserializer.deserialize(markdown);

      expect(result.content.some(node => node.type === 'horizontalRule')).toBe(true);
    });

    it('should apply text alignment from sidecar', async () => {
      const markdown = '<!-- @mid:p-abc123 -->\nCentered text';
      const sidecar = createEmptySidecar();
      sidecar.blocks['p-abc123'] = { align: 'center' };

      const result = await deserializer.deserialize(markdown, sidecar);

      expect(result.content[0].attrs?.textAlign).toBe('center');
    });

    it('should return empty paragraph for empty input', async () => {
      const result = await deserializer.deserialize('');

      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('paragraph');
    });

    it('should handle markdown without block IDs', async () => {
      const markdown = `# Title

Regular paragraph text.

- List item`;

      const result = await deserializer.deserialize(markdown);

      expect(result.content.length).toBeGreaterThan(0);
    });
  });
});

describe('Round-trip serialization', () => {
  let testDir: string;
  let imageManager: ImageManager;
  let serializer: DocumentSerializer;
  let deserializer: DocumentDeserializer;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'roundtrip-test-'));
    imageManager = new ImageManager(testDir);
    await imageManager.init();
    serializer = new DocumentSerializer(imageManager);
    deserializer = new DocumentDeserializer(imageManager);
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should preserve content through serialize/deserialize cycle', async () => {
    const originalJson = {
      type: 'doc' as const,
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'My Document' }],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'This is ' },
            { type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
            { type: 'text', text: ' and ' },
            { type: 'text', text: 'italic', marks: [{ type: 'italic' }] },
            { type: 'text', text: ' text.' },
          ],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                { type: 'paragraph', content: [{ type: 'text', text: 'Item 1' }] },
              ],
            },
            {
              type: 'listItem',
              content: [
                { type: 'paragraph', content: [{ type: 'text', text: 'Item 2' }] },
              ],
            },
          ],
        },
      ],
    };

    // Serialize to markdown + sidecar
    const { markdown, sidecar } = await serializer.serialize(originalJson);

    // Deserialize back to JSON
    const resultJson = await deserializer.deserialize(markdown, sidecar);

    // Verify structure is preserved
    expect(resultJson.content).toHaveLength(3);
    expect(resultJson.content[0].type).toBe('heading');
    expect(resultJson.content[1].type).toBe('paragraph');
    expect(resultJson.content[2].type).toBe('bulletList');

    // Verify heading content
    expect(resultJson.content[0].content?.[0].text).toBe('My Document');

    // Verify list items
    expect(resultJson.content[2].content).toHaveLength(2);
  });

  it('should preserve formatting marks through round-trip', async () => {
    const originalJson = {
      type: 'doc' as const,
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'bold', marks: [{ type: 'bold' }] },
          ],
        },
      ],
    };

    const { markdown, sidecar } = await serializer.serialize(originalJson);
    const resultJson = await deserializer.deserialize(markdown, sidecar);

    const textNode = resultJson.content[0].content?.[0];
    expect(textNode?.marks?.some(m => m.type === 'bold')).toBe(true);
  });
});

describe('Legacy HTML span parsing', () => {
  let testDir: string;
  let deserializer: DocumentDeserializer;

  beforeEach(async () => {
    testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'legacy-test-'));
    deserializer = new DocumentDeserializer(null);
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('should parse HTML span with color style', async () => {
    const markdown = 'This has <span style="color: rgb(120, 71, 131);">colored</span> text.';

    const result = await deserializer.deserialize(markdown);

    const paragraph = result.content[0];
    const coloredNode = paragraph.content?.find(node =>
      node.text === 'colored' && node.marks?.some(m => m.type === 'textStyle' && m.attrs?.color)
    );

    expect(coloredNode).toBeDefined();
    expect(coloredNode?.marks?.find(m => m.type === 'textStyle')?.attrs?.color).toBe('rgb(120, 71, 131)');
  });

  it('should parse HTML span with background color', async () => {
    const markdown = 'This has <span style="background-color: yellow;">highlighted</span> text.';

    const result = await deserializer.deserialize(markdown);

    const paragraph = result.content[0];
    const highlightedNode = paragraph.content?.find(node =>
      node.text === 'highlighted' && node.marks?.some(m => m.type === 'highlight')
    );

    expect(highlightedNode).toBeDefined();
  });

  it('should parse nested HTML spans', async () => {
    const markdown = '<span style="color: red;"><span style="background: yellow;">nested</span></span>';

    const result = await deserializer.deserialize(markdown);

    const paragraph = result.content[0];
    const nestedNode = paragraph.content?.find(node => node.text === 'nested');

    expect(nestedNode).toBeDefined();
    expect(nestedNode?.marks?.some(m => m.type === 'textStyle' && m.attrs?.color)).toBe(true);
    expect(nestedNode?.marks?.some(m => m.type === 'highlight')).toBe(true);
  });

  it('should handle mixed markdown and HTML formatting', async () => {
    const markdown = 'This is **bold** and <span style="color: blue;">colored</span>.';

    const result = await deserializer.deserialize(markdown);

    const paragraph = result.content[0];

    // Check for bold
    const boldNode = paragraph.content?.find(node =>
      node.text === 'bold' && node.marks?.some(m => m.type === 'bold')
    );
    expect(boldNode).toBeDefined();

    // Check for color
    const colorNode = paragraph.content?.find(node =>
      node.text === 'colored' && node.marks?.some(m => m.type === 'textStyle' && m.attrs?.color)
    );
    expect(colorNode).toBeDefined();
  });

  it('should parse ordered lists without breaking them', async () => {
    const markdown = `1. Item one
2. Item two
3. Item three`;

    const result = await deserializer.deserialize(markdown);

    expect(result.content[0].type).toBe('orderedList');
    expect(result.content[0].content).toHaveLength(3);
  });

  it('should parse ordered lists with block ID comment', async () => {
    const markdown = `<!-- @mid:list-abc123 -->
1. Item one
2. Item two
3. Item three`;

    const result = await deserializer.deserialize(markdown);

    expect(result.content[0].type).toBe('orderedList');
    expect(result.content[0].content).toHaveLength(3);
  });

  it('should handle list items with HTML color spans', async () => {
    const markdown = `1. <span style="color: rgb(120, 71, 131);">Colored item</span>
2. Normal item`;

    const result = await deserializer.deserialize(markdown);

    expect(result.content[0].type).toBe('orderedList');
    expect(result.content[0].content).toHaveLength(2);

    // First item should have colored text
    const firstItem = result.content[0].content?.[0];
    const paragraph = firstItem?.content?.[0];
    const coloredNode = paragraph?.content?.find((node: any) =>
      node.marks?.some((m: any) => m.type === 'textStyle' && m.attrs?.color)
    );
    expect(coloredNode).toBeDefined();
  });
});
