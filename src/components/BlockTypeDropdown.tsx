import { ChevronDown, Check } from 'lucide-react';
import { Editor } from '@tiptap/react';
import { useState, useRef, useEffect } from 'react';

interface BlockTypeDropdownProps {
  editor: Editor;
}

// Default font sizes for different block types (in px)
// These now align with standard Word sizes when exported (px * 0.75 = pt)
const DEFAULT_SIZES: Record<string, number> = {
  paragraph: 16,  // 16px = 12pt in Word (standard body text)
  h1: 32,        // 32px = 24pt in Word
  h2: 24,        // 24px = 18pt in Word
  h3: 20,        // 20px = 15pt in Word
};

const getScaledFontSize = (editor: Editor, targetType: string): string | null => {
  const currentFontSize = editor.getAttributes('textStyle').fontSize;

  // If no custom fontSize is set, return null (let it use default)
  if (!currentFontSize) {
    return null;
  }

  // Extract current size in px
  const match = currentFontSize.match(/^(\d+)px$/);
  if (!match) {
    return null;
  }

  const currentSize = parseInt(match[1]);

  // Determine current block type
  let currentType = 'paragraph';
  if (editor.isActive('heading', { level: 1 })) currentType = 'h1';
  else if (editor.isActive('heading', { level: 2 })) currentType = 'h2';
  else if (editor.isActive('heading', { level: 3 })) currentType = 'h3';

  // Calculate scaled size
  const currentDefault = DEFAULT_SIZES[currentType];
  const targetDefault = DEFAULT_SIZES[targetType];

  if (currentDefault && targetDefault) {
    const ratio = targetDefault / currentDefault;
    const scaledSize = Math.round(currentSize * ratio);
    return `${scaledSize}px`;
  }

  return currentFontSize;
};

const BLOCK_TYPES = [
  {
    label: 'Paragraph',
    value: 'paragraph',
    command: (editor: Editor) => {
      const scaledSize = getScaledFontSize(editor, 'paragraph');
      const chain = editor.chain().focus();
      if (scaledSize) {
        chain.setFontSize(scaledSize);
      }
      chain.setParagraph().run();
    },
    isActive: (editor: Editor) => editor.isActive('paragraph')
  },
  {
    label: 'Heading 1',
    value: 'h1',
    command: (editor: Editor) => {
      const scaledSize = getScaledFontSize(editor, 'h1');
      const chain = editor.chain().focus();
      if (scaledSize) {
        chain.setFontSize(scaledSize);
      } else {
        chain.unsetFontSize();
      }
      chain.toggleHeading({ level: 1 }).run();
    },
    isActive: (editor: Editor) => editor.isActive('heading', { level: 1 })
  },
  {
    label: 'Heading 2',
    value: 'h2',
    command: (editor: Editor) => {
      const scaledSize = getScaledFontSize(editor, 'h2');
      const chain = editor.chain().focus();
      if (scaledSize) {
        chain.setFontSize(scaledSize);
      } else {
        chain.unsetFontSize();
      }
      chain.toggleHeading({ level: 2 }).run();
    },
    isActive: (editor: Editor) => editor.isActive('heading', { level: 2 })
  },
  {
    label: 'Heading 3',
    value: 'h3',
    command: (editor: Editor) => {
      const scaledSize = getScaledFontSize(editor, 'h3');
      const chain = editor.chain().focus();
      if (scaledSize) {
        chain.setFontSize(scaledSize);
      } else {
        chain.unsetFontSize();
      }
      chain.toggleHeading({ level: 3 }).run();
    },
    isActive: (editor: Editor) => editor.isActive('heading', { level: 3 })
  },
  { label: 'Bullet List', value: 'bulletList', command: (editor: Editor) => editor.chain().focus().toggleBulletList().run(), isActive: (editor: Editor) => editor.isActive('bulletList') },
  { label: 'Ordered List', value: 'orderedList', command: (editor: Editor) => editor.chain().focus().toggleOrderedList().run(), isActive: (editor: Editor) => editor.isActive('orderedList') },
  { label: 'Code Block', value: 'codeBlock', command: (editor: Editor) => editor.chain().focus().toggleCodeBlock().run(), isActive: (editor: Editor) => editor.isActive('codeBlock') },
  { label: 'Quote', value: 'blockquote', command: (editor: Editor) => editor.chain().focus().toggleBlockquote().run(), isActive: (editor: Editor) => editor.isActive('blockquote') },
];

export function BlockTypeDropdown({ editor }: BlockTypeDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeBlock = BLOCK_TYPES.find(block => block.isActive(editor)) || BLOCK_TYPES[0];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 h-8 px-2 text-sm font-medium rounded hover:bg-accent hover:text-accent-foreground transition-colors min-w-[120px] justify-between"
      >
        <span className="truncate">{activeBlock.label}</span>
        <ChevronDown size={14} className="opacity-50" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-48 bg-popover text-popover-foreground border rounded shadow-md py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
          {BLOCK_TYPES.map((block) => (
            <button
              key={block.value}
              onClick={() => {
                block.command(editor);
                setIsOpen(false);
              }}
              className={`flex items-center w-full px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground text-left ${
                block.isActive(editor) ? 'bg-accent/50' : ''
              }`}
            >
              <span className="flex-1">{block.label}</span>
              {block.isActive(editor) && <Check size={14} className="ml-2 opacity-70" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
