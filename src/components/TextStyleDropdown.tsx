import { Editor } from '@tiptap/react';
import { RiItalic, RiUnderline, RiStrikethrough, RiCodeLine, RiSubscript, RiSuperscript, RiFormatClear, RiArrowDownSLine } from '@remixicon/react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

interface TextStyleDropdownProps {
  editor: Editor;
}

const platform = typeof window !== 'undefined' && window.electronAPI?.platform || 'darwin';
const isMac = platform === 'darwin';

// Platform-aware modifier key
const mod = isMac ? '⌘' : 'Ctrl+';
const shift = isMac ? '⇧' : 'Shift+';

export function TextStyleDropdown({ editor }: TextStyleDropdownProps) {
  const toggle = (callback: () => void) => {
    callback();
    editor.view.focus();
  };

  const clearFormatting = () => {
    editor.chain().focus().unsetAllMarks().run();
  };

  // Check if any text style is active
  const hasActiveStyle =
    editor.isActive('italic') ||
    editor.isActive('underline') ||
    editor.isActive('strike') ||
    editor.isActive('code') ||
    editor.isActive('subscript') ||
    editor.isActive('superscript');

  // Determine which icon to show (first active style, or default to Italic)
  const getActiveIcon = () => {
    if (editor.isActive('italic')) return <RiItalic size={16} />;
    if (editor.isActive('underline')) return <RiUnderline size={16} />;
    if (editor.isActive('strike')) return <RiStrikethrough size={16} />;
    if (editor.isActive('code')) return <RiCodeLine size={16} />;
    if (editor.isActive('subscript')) return <RiSubscript size={16} />;
    if (editor.isActive('superscript')) return <RiSuperscript size={16} />;
    return <RiItalic size={16} />;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={`p-1.5 rounded hover:bg-accent hover:text-accent-foreground transition-colors flex items-center gap-0.5 ${
            hasActiveStyle ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
          }`}
          title="Text Styles"
        >
          {getActiveIcon()}
          <RiArrowDownSLine size={12} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuItem
          onClick={() => toggle(() => editor.chain().focus().toggleItalic().run())}
          disabled={!editor.can().chain().focus().toggleItalic().run()}
          className={editor.isActive('italic') ? 'bg-accent' : ''}
        >
          <RiItalic size={16} className="mr-2 shrink-0" />
          <span className="flex-1">Italic</span>
          <DropdownMenuShortcut>{mod}I</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => toggle(() => editor.chain().focus().toggleUnderline().run())}
          disabled={!editor.can().chain().focus().toggleUnderline().run()}
          className={editor.isActive('underline') ? 'bg-accent' : ''}
        >
          <RiUnderline size={16} className="mr-2 shrink-0" />
          <span className="flex-1">Underline</span>
          <DropdownMenuShortcut>{mod}U</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => toggle(() => editor.chain().focus().toggleStrike().run())}
          disabled={!editor.can().chain().focus().toggleStrike().run()}
          className={editor.isActive('strike') ? 'bg-accent' : ''}
        >
          <RiStrikethrough size={16} className="mr-2 shrink-0" />
          <span className="flex-1">Strikethrough</span>
          <DropdownMenuShortcut>{mod}{shift}S</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => toggle(() => editor.chain().focus().toggleCode().run())}
          disabled={!editor.can().chain().focus().toggleCode().run()}
          className={editor.isActive('code') ? 'bg-accent' : ''}
        >
          <RiCodeLine size={16} className="mr-2 shrink-0" />
          <span className="flex-1">Code</span>
          <DropdownMenuShortcut>{mod}E</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => toggle(() => editor.chain().focus().toggleSubscript().run())}
          disabled={!editor.can().chain().focus().toggleSubscript().run()}
          className={editor.isActive('subscript') ? 'bg-accent' : ''}
        >
          <RiSubscript size={16} className="mr-2 shrink-0" />
          <span className="flex-1">Subscript</span>
          <DropdownMenuShortcut>{mod},</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => toggle(() => editor.chain().focus().toggleSuperscript().run())}
          disabled={!editor.can().chain().focus().toggleSuperscript().run()}
          className={editor.isActive('superscript') ? 'bg-accent' : ''}
        >
          <RiSuperscript size={16} className="mr-2 shrink-0" />
          <span className="flex-1">Superscript</span>
          <DropdownMenuShortcut>{mod}.</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={clearFormatting}>
          <RiFormatClear size={16} className="mr-2 shrink-0" />
          <span className="flex-1">Clear formatting</span>
          <DropdownMenuShortcut>{mod}\</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
