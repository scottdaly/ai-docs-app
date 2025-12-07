/**
 * Convert HTML to Tiptap JSON document.
 * Used for DOCX import which returns HTML from mammoth.
 */

interface TiptapMark {
  type: string;
  attrs?: Record<string, any>;
}

interface TiptapNode {
  type: string;
  attrs?: Record<string, any>;
  content?: TiptapNode[];
  text?: string;
  marks?: TiptapMark[];
}

interface TiptapDocument {
  type: 'doc';
  content: TiptapNode[];
}

export function htmlToTiptapJson(html: string): TiptapDocument {
  // Use DOMParser to parse HTML
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const content: TiptapNode[] = [];

  for (const child of Array.from(doc.body.children)) {
    const node = convertElement(child);
    if (node) {
      content.push(node);
    }
  }

  // If body has no block elements but has text, wrap in paragraph
  if (content.length === 0 && doc.body.textContent?.trim()) {
    content.push({
      type: 'paragraph',
      content: convertInlineContent(doc.body),
    });
  }

  return {
    type: 'doc',
    content: content.length > 0 ? content : [{ type: 'paragraph', content: [] }],
  };
}

function convertElement(element: Element): TiptapNode | null {
  const tagName = element.tagName.toLowerCase();

  switch (tagName) {
    case 'p':
      return {
        type: 'paragraph',
        content: convertInlineContent(element),
      };

    case 'h1':
    case 'h2':
    case 'h3':
    case 'h4':
    case 'h5':
    case 'h6':
      return {
        type: 'heading',
        attrs: { level: parseInt(tagName[1]) },
        content: convertInlineContent(element),
      };

    case 'ul':
      return {
        type: 'bulletList',
        content: Array.from(element.children)
          .filter(child => child.tagName.toLowerCase() === 'li')
          .map(li => convertListItem(li)),
      };

    case 'ol':
      return {
        type: 'orderedList',
        content: Array.from(element.children)
          .filter(child => child.tagName.toLowerCase() === 'li')
          .map(li => convertListItem(li)),
      };

    case 'li':
      return convertListItem(element);

    case 'blockquote':
      return {
        type: 'blockquote',
        content: convertBlockContent(element),
      };

    case 'pre': {
      // Code block
      const codeEl = element.querySelector('code');
      const text = codeEl?.textContent || element.textContent || '';
      const language = codeEl?.className?.match(/language-(\w+)/)?.[1] || '';
      return {
        type: 'codeBlock',
        attrs: { language },
        content: text ? [{ type: 'text', text }] : [],
      };
    }

    case 'hr':
      return { type: 'horizontalRule' };

    case 'img':
      return {
        type: 'image',
        attrs: {
          src: element.getAttribute('src') || '',
          alt: element.getAttribute('alt') || '',
          title: element.getAttribute('title') || undefined,
        },
      };

    case 'br':
      return { type: 'hardBreak' };

    case 'div':
    case 'section':
    case 'article':
    case 'main':
    case 'header':
    case 'footer':
      // Container elements - convert their content
      const divContent = convertBlockContent(element);
      if (divContent.length === 1) {
        return divContent[0];
      }
      // Return as a paragraph if it only contains inline content
      if (divContent.length === 0 && element.textContent?.trim()) {
        return {
          type: 'paragraph',
          content: convertInlineContent(element),
        };
      }
      // For multiple block children, return the first one
      // (Tiptap doesn't have a generic container node)
      return divContent[0] || null;

    case 'table':
      // Tables are not supported in basic Tiptap, convert to text
      return {
        type: 'paragraph',
        content: [{ type: 'text', text: element.textContent || '' }],
      };

    default:
      // Unknown block element - try to get text content as paragraph
      if (element.textContent?.trim()) {
        return {
          type: 'paragraph',
          content: convertInlineContent(element),
        };
      }
      return null;
  }
}

function convertListItem(element: Element): TiptapNode {
  // Check if list item contains nested lists
  const nestedLists = element.querySelectorAll(':scope > ul, :scope > ol');

  if (nestedLists.length > 0) {
    // Has nested content
    const content: TiptapNode[] = [];

    // First add any text content as a paragraph
    const textContent = Array.from(element.childNodes)
      .filter(node =>
        node.nodeType === Node.TEXT_NODE ||
        (node.nodeType === Node.ELEMENT_NODE &&
          !['ul', 'ol'].includes((node as Element).tagName.toLowerCase()))
      );

    if (textContent.length > 0) {
      const tempDiv = document.createElement('div');
      textContent.forEach(node => tempDiv.appendChild(node.cloneNode(true)));
      content.push({
        type: 'paragraph',
        content: convertInlineContent(tempDiv),
      });
    }

    // Then add nested lists
    nestedLists.forEach(list => {
      const converted = convertElement(list);
      if (converted) {
        content.push(converted);
      }
    });

    return {
      type: 'listItem',
      content: content.length > 0 ? content : [{ type: 'paragraph', content: [] }],
    };
  }

  // Simple list item
  return {
    type: 'listItem',
    content: [{
      type: 'paragraph',
      content: convertInlineContent(element),
    }],
  };
}

function convertBlockContent(element: Element): TiptapNode[] {
  const nodes: TiptapNode[] = [];

  for (const child of Array.from(element.children)) {
    const node = convertElement(child);
    if (node) {
      nodes.push(node);
    }
  }

  return nodes;
}

function convertInlineContent(element: Element | Node): TiptapNode[] {
  const nodes: TiptapNode[] = [];

  for (const child of Array.from(element.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent;
      if (text) {
        nodes.push({ type: 'text', text });
      }
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as Element;
      const tagName = el.tagName.toLowerCase();

      // Check for inline elements
      if (isInlineElement(tagName)) {
        const inlineNodes = convertInlineElement(el);
        nodes.push(...inlineNodes);
      } else if (tagName === 'br') {
        nodes.push({ type: 'hardBreak' });
      } else {
        // Block element inside inline context - extract text
        const text = el.textContent;
        if (text) {
          nodes.push({ type: 'text', text });
        }
      }
    }
  }

  return nodes;
}

function isInlineElement(tagName: string): boolean {
  return [
    'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'del',
    'code', 'a', 'span', 'mark', 'sup', 'sub', 'small'
  ].includes(tagName);
}

function convertInlineElement(element: Element): TiptapNode[] {
  const tagName = element.tagName.toLowerCase();
  const marks: TiptapMark[] = [];

  // Collect marks based on tag
  switch (tagName) {
    case 'strong':
    case 'b':
      marks.push({ type: 'bold' });
      break;
    case 'em':
    case 'i':
      marks.push({ type: 'italic' });
      break;
    case 'u':
      marks.push({ type: 'underline' });
      break;
    case 's':
    case 'strike':
    case 'del':
      marks.push({ type: 'strike' });
      break;
    case 'code':
      marks.push({ type: 'code' });
      break;
    case 'a':
      marks.push({
        type: 'link',
        attrs: {
          href: element.getAttribute('href') || '',
          target: element.getAttribute('target') || undefined,
        },
      });
      break;
    case 'mark':
      marks.push({
        type: 'highlight',
        attrs: {
          color: (element as HTMLElement).style.backgroundColor || 'yellow',
        },
      });
      break;
    case 'sup':
      marks.push({ type: 'superscript' });
      break;
    case 'sub':
      marks.push({ type: 'subscript' });
      break;
    case 'span': {
      // Check for style-based marks
      const style = (element as HTMLElement).style;
      if (style.color) {
        marks.push({ type: 'textColor', attrs: { color: style.color } });
      }
      if (style.backgroundColor) {
        marks.push({ type: 'textHighlight', attrs: { color: style.backgroundColor } });
      }
      if (style.fontFamily) {
        marks.push({ type: 'textStyle', attrs: { fontFamily: style.fontFamily } });
      }
      break;
    }
  }

  // Process children
  const childNodes: TiptapNode[] = [];

  for (const child of Array.from(element.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent;
      if (text) {
        childNodes.push({
          type: 'text',
          text,
          marks: marks.length > 0 ? [...marks] : undefined,
        });
      }
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const childEl = child as Element;
      if (isInlineElement(childEl.tagName.toLowerCase())) {
        // Nested inline element - recursively convert and merge marks
        const nestedNodes = convertInlineElement(childEl);
        for (const node of nestedNodes) {
          if (node.type === 'text' && marks.length > 0) {
            // Merge marks
            node.marks = [...(node.marks || []), ...marks];
          }
          childNodes.push(node);
        }
      } else if (childEl.tagName.toLowerCase() === 'br') {
        childNodes.push({ type: 'hardBreak' });
      } else {
        // Unknown element - extract text
        const text = childEl.textContent;
        if (text) {
          childNodes.push({
            type: 'text',
            text,
            marks: marks.length > 0 ? [...marks] : undefined,
          });
        }
      }
    }
  }

  // If element has no children but has text, create text node
  if (childNodes.length === 0 && element.textContent) {
    return [{
      type: 'text',
      text: element.textContent,
      marks: marks.length > 0 ? marks : undefined,
    }];
  }

  return childNodes;
}

/**
 * Create an empty Tiptap document
 */
export function createEmptyTiptapDocument(): TiptapDocument {
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: [] }],
  };
}
