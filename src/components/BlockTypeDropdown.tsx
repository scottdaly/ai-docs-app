import { ChevronDown, List, ListOrdered, Code2, Quote, Type } from 'lucide-react';
import { Editor } from '@tiptap/react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

interface BlockTypeDropdownProps {
  editor: Editor;
}

const platform = typeof window !== 'undefined' && window.electronAPI?.platform || 'darwin';
const isMac = platform === 'darwin';

// Platform-aware modifier key
const mod = isMac ? '⌘' : 'Ctrl+';
const alt = isMac ? '⌥' : 'Alt+';

// Default font sizes for different block types (in px)
// These now align with standard Word sizes when exported (px * 0.75 = pt)
const DEFAULT_SIZES: Record<string, number> = {
  paragraph: 16,  // 16px = 12pt in Word (standard body text)
  h1: 32,        // 32px = 24pt in Word
  h2: 24,        // 24px = 18pt in Word
  h3: 20,        // 20px = 15pt in Word
  h4: 18,        // 18px = 13.5pt in Word
  h5: 16,        // 16px = 12pt in Word (same as paragraph but bold)
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
  else if (editor.isActive('heading', { level: 4 })) currentType = 'h4';
  else if (editor.isActive('heading', { level: 5 })) currentType = 'h5';

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

// Icon components for heading levels
const H1Icon = () => (
  <span className="text-xs font-bold flex items-baseline">
    H<sub className="text-[8px]">1</sub>
  </span>
);

const H2Icon = () => (
  <span className="text-xs font-bold flex items-baseline">
    H<sub className="text-[8px]">2</sub>
  </span>
);

const H3Icon = () => (
  <span className="text-xs font-bold flex items-baseline">
    H<sub className="text-[8px]">3</sub>
  </span>
);

const H4Icon = () => (
  <span className="text-xs font-bold flex items-baseline">
    H<sub className="text-[8px]">4</sub>
  </span>
);

const H5Icon = () => (
  <span className="text-xs font-bold flex items-baseline">
    H<sub className="text-[8px]">5</sub>
  </span>
);

const TtIcon = () => (
  <span className="text-sm font-medium">Tt</span>
);

export function BlockTypeDropdown({ editor }: BlockTypeDropdownProps) {
  const setParagraph = () => {
    const scaledSize = getScaledFontSize(editor, 'paragraph');
    const chain = editor.chain().focus();
    if (scaledSize) {
      chain.setFontSize(scaledSize);
    }
    chain.setParagraph().run();
  };

  const setHeading = (level: 1 | 2 | 3 | 4 | 5) => {
    const scaledSize = getScaledFontSize(editor, `h${level}`);
    const chain = editor.chain().focus();
    if (scaledSize) {
      chain.setFontSize(scaledSize);
    } else {
      chain.unsetFontSize();
    }
    chain.toggleHeading({ level }).run();
  };

  // Determine which icon to show based on current block type
  const getActiveIcon = () => {
    if (editor.isActive('heading', { level: 1 })) return <H1Icon />;
    if (editor.isActive('heading', { level: 2 })) return <H2Icon />;
    if (editor.isActive('heading', { level: 3 })) return <H3Icon />;
    if (editor.isActive('heading', { level: 4 })) return <H4Icon />;
    if (editor.isActive('heading', { level: 5 })) return <H5Icon />;
    if (editor.isActive('bulletList')) return <List size={16} />;
    if (editor.isActive('orderedList')) return <ListOrdered size={16} />;
    if (editor.isActive('codeBlock')) return <Code2 size={16} />;
    if (editor.isActive('blockquote')) return <Quote size={16} />;
    return <TtIcon />;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="p-1.5 rounded hover:bg-accent hover:text-accent-foreground transition-colors flex items-center gap-0.5 text-muted-foreground"
          title="Text Style"
        >
          <div className="w-4 h-4 flex items-center justify-center">
            {getActiveIcon()}
          </div>
          <ChevronDown size={12} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        <DropdownMenuItem
          onClick={setParagraph}
          className={editor.isActive('paragraph') && !editor.isActive('bulletList') && !editor.isActive('orderedList') && !editor.isActive('codeBlock') && !editor.isActive('blockquote') ? 'bg-accent' : ''}
        >
          <Type size={16} className="mr-2 shrink-0" />
          <span className="flex-1">Normal text</span>
          <DropdownMenuShortcut>{mod}{alt}0</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setHeading(1)}
          className={editor.isActive('heading', { level: 1 }) ? 'bg-accent' : ''}
        >
          <span className="mr-2 shrink-0 w-4 text-center font-bold text-xs flex items-baseline justify-center">
            H<sub className="text-[8px]">1</sub>
          </span>
          <span className="flex-1 text-xl font-bold">Heading 1</span>
          <DropdownMenuShortcut>{mod}{alt}1</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setHeading(2)}
          className={editor.isActive('heading', { level: 2 }) ? 'bg-accent' : ''}
        >
          <span className="mr-2 shrink-0 w-4 text-center font-bold text-xs flex items-baseline justify-center">
            H<sub className="text-[8px]">2</sub>
          </span>
          <span className="flex-1 text-lg font-bold">Heading 2</span>
          <DropdownMenuShortcut>{mod}{alt}2</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setHeading(3)}
          className={editor.isActive('heading', { level: 3 }) ? 'bg-accent' : ''}
        >
          <span className="mr-2 shrink-0 w-4 text-center font-bold text-xs flex items-baseline justify-center">
            H<sub className="text-[8px]">3</sub>
          </span>
          <span className="flex-1 text-base font-bold">Heading 3</span>
          <DropdownMenuShortcut>{mod}{alt}3</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setHeading(4)}
          className={editor.isActive('heading', { level: 4 }) ? 'bg-accent' : ''}
        >
          <span className="mr-2 shrink-0 w-4 text-center font-bold text-xs flex items-baseline justify-center">
            H<sub className="text-[8px]">4</sub>
          </span>
          <span className="flex-1 text-sm font-bold">Heading 4</span>
          <DropdownMenuShortcut>{mod}{alt}4</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setHeading(5)}
          className={editor.isActive('heading', { level: 5 }) ? 'bg-accent' : ''}
        >
          <span className="mr-2 shrink-0 w-4 text-center font-bold text-xs flex items-baseline justify-center">
            H<sub className="text-[8px]">5</sub>
          </span>
          <span className="flex-1 text-sm font-semibold">Heading 5</span>
          <DropdownMenuShortcut>{mod}{alt}5</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={editor.isActive('bulletList') ? 'bg-accent' : ''}
        >
          <List size={16} className="mr-2 shrink-0" />
          <span className="flex-1">Bullet list</span>
          <DropdownMenuShortcut>{mod}{alt}8</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={editor.isActive('orderedList') ? 'bg-accent' : ''}
        >
          <ListOrdered size={16} className="mr-2 shrink-0" />
          <span className="flex-1">Numbered list</span>
          <DropdownMenuShortcut>{mod}{alt}7</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={editor.isActive('blockquote') ? 'bg-accent' : ''}
        >
          <Quote size={16} className="mr-2 shrink-0" />
          <span className="flex-1">Quote</span>
          <DropdownMenuShortcut>{mod}{alt}9</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          className={editor.isActive('codeBlock') ? 'bg-accent' : ''}
        >
          <Code2 size={16} className="mr-2 shrink-0" />
          <span className="flex-1">Code block</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
