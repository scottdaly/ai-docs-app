import TurndownService from 'turndown';
import { marked } from 'marked';

// Configure Turndown for HTML → Markdown conversion
const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
});

// Add custom rule for inline code to prevent escaping
turndownService.addRule('code', {
  filter: 'code',
  replacement: (content) => {
    return `\`${content}\``;
  },
});

// Add custom rule for marks with styles (color, highlight)
turndownService.addRule('styledSpan', {
  filter: (node: HTMLElement) => {
    return (
      node.nodeName === 'SPAN' &&
      !!(node.style.color || node.style.backgroundColor)
    );
  },
  replacement: (content, node: any) => {
    const color = node.style.color;
    const bgColor = node.style.backgroundColor;

    let html = '<span';
    if (color || bgColor) {
      html += ' style="';
      if (color) html += `color: ${color};`;
      if (bgColor) html += `background-color: ${bgColor};`;
      html += '"';
    }
    html += `>${content}</span>`;

    return html;
  },
});

// Add custom rule for mark elements (highlights)
turndownService.addRule('mark', {
  filter: 'mark',
  replacement: (content, node: any) => {
    const bgColor = node.style.backgroundColor;
    if (bgColor) {
      return `<mark style="background-color: ${bgColor}">${content}</mark>`;
    }
    return `<mark>${content}</mark>`;
  },
});

// Add custom rule for underline
turndownService.addRule('underline', {
  filter: 'u',
  replacement: (content) => {
    return `<u>${content}</u>`;
  },
});

/**
 * Convert HTML to Markdown
 */
export function htmlToMarkdown(html: string): string {
  return turndownService.turndown(html);
}

/**
 * Convert Markdown to HTML
 */
export function markdownToHtml(markdown: string): string {
  return marked.parse(markdown, {
    gfm: true,
    breaks: false,
  }) as string;
}
