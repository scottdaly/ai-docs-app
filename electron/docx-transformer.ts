import { Document, Packer, Paragraph, BorderStyle } from 'docx';
import { createParagraph, createHeading } from './docx-helpers/paragraph-processors';
import { createImageParagraph } from './docx-helpers/image-processors';
import { processBulletList, processOrderedList } from './docx-helpers/list-processors';

export async function createDocx(content: any) {
  const children: Paragraph[] = [];

  // Process each node in the document
  for (const node of content.content || []) {
    try {
      switch (node.type) {
        case 'paragraph':
          children.push(createParagraph(node));
          break;

        case 'heading':
          children.push(createHeading(node));
          break;

        case 'bulletList':
          children.push(...processBulletList(node));
          break;

        case 'orderedList':
          children.push(...processOrderedList(node, 0, 'default-numbering'));
          break;

        case 'image':
          // Process image nodes - convert base64 to embedded image
          children.push(createImageParagraph(node));
          break;

        case 'horizontalRule':
          // Create a paragraph with a bottom border to simulate a horizontal rule
          children.push(new Paragraph({
            border: {
              bottom: {
                color: '999999',
                space: 1,
                style: BorderStyle.SINGLE,
                size: 6, // 0.75pt line
              },
            },
            spacing: {
              before: 200,
              after: 200,
            },
          }));
          break;

        default:
          // Skip unknown node types silently
          break;
      }
    } catch (error) {
      console.error(`Error processing node type ${node.type}:`, error);
      // Continue processing other nodes instead of failing completely
      children.push(new Paragraph({ text: '' }));
    }
  }

  const doc = new Document({
    sections: [{
      properties: {},
      children: children,
    }],
    // Numbering configuration for ordered lists with nested level support (0-8)
    // Pattern: decimal → lowerLetter → lowerRoman (repeating)
    // Each level has increasing indentation (720 twips = 0.5 inch per level)
    numbering: {
      config: [
        {
          reference: 'default-numbering',
          levels: [
            { level: 0, format: 'decimal', text: '%1.', alignment: 'start', style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
            { level: 1, format: 'lowerLetter', text: '%2.', alignment: 'start', style: { paragraph: { indent: { left: 1440, hanging: 360 } } } },
            { level: 2, format: 'lowerRoman', text: '%3.', alignment: 'start', style: { paragraph: { indent: { left: 2160, hanging: 360 } } } },
            { level: 3, format: 'decimal', text: '%4.', alignment: 'start', style: { paragraph: { indent: { left: 2880, hanging: 360 } } } },
            { level: 4, format: 'lowerLetter', text: '%5.', alignment: 'start', style: { paragraph: { indent: { left: 3600, hanging: 360 } } } },
            { level: 5, format: 'lowerRoman', text: '%6.', alignment: 'start', style: { paragraph: { indent: { left: 4320, hanging: 360 } } } },
            { level: 6, format: 'decimal', text: '%7.', alignment: 'start', style: { paragraph: { indent: { left: 5040, hanging: 360 } } } },
            { level: 7, format: 'lowerLetter', text: '%8.', alignment: 'start', style: { paragraph: { indent: { left: 5760, hanging: 360 } } } },
            { level: 8, format: 'lowerRoman', text: '%9.', alignment: 'start', style: { paragraph: { indent: { left: 6480, hanging: 360 } } } },
          ],
        },
      ],
    },
  });

  return Packer.toBuffer(doc);
}
