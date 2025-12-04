import { Document, Packer, Paragraph } from 'docx';
import { createParagraph, createHeading } from './docx-helpers/paragraph-processors';
import { tiptapAlignToDocx } from './docx-helpers/converters';
import { processTextNodes } from './docx-helpers/text-processors';
import { createImageParagraph } from './docx-helpers/image-processors';
import { TiptapNode } from './docx-helpers/types';

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
          // Simple flat list handling for MVP (defer nested lists)
          // Process each list item and preserve formatting
          for (const listItem of node.content || []) {
            for (const listItemContent of listItem.content || []) {
              if (listItemContent.type === 'paragraph') {
                children.push(new Paragraph({
                  bullet: { level: 0 },
                  alignment: tiptapAlignToDocx(listItemContent.attrs?.textAlign),
                  children: processTextNodes(listItemContent.content || []),
                }));
              }
            }
          }
          break;

        case 'orderedList':
          // Simple flat list handling for MVP (defer nested lists)
          // Process each list item and preserve formatting
          for (const listItem of node.content || []) {
            for (const listItemContent of listItem.content || []) {
              if (listItemContent.type === 'paragraph') {
                children.push(new Paragraph({
                  numbering: { reference: 'default-numbering', level: 0 },
                  alignment: tiptapAlignToDocx(listItemContent.attrs?.textAlign),
                  children: processTextNodes(listItemContent.content || []),
                }));
              }
            }
          }
          break;

        case 'image':
          // Process image nodes - convert base64 to embedded image
          children.push(createImageParagraph(node));
          break;

        default:
          console.warn(`Unknown node type: ${node.type}`);
          children.push(new Paragraph({ text: '' }));
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
    // Add numbering configuration for ordered lists
    numbering: {
      config: [
        {
          reference: 'default-numbering',
          levels: [
            {
              level: 0,
              format: 'decimal',
              text: '%1.',
              alignment: 'start',
            },
          ],
        },
      ],
    },
  });

  return Packer.toBuffer(doc);
}
