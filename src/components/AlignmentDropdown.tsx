import { Editor } from '@tiptap/react';
import { RiAlignLeft, RiAlignCenter, RiAlignRight, RiAlignJustify, RiArrowDownSLine } from '@remixicon/react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

interface AlignmentDropdownProps {
  editor: Editor;
}

const platform = typeof window !== 'undefined' && window.electronAPI?.platform || 'darwin';
const isMac = platform === 'darwin';

// Platform-aware modifier key
const mod = isMac ? '⌘' : 'Ctrl+';
const shift = isMac ? '⇧' : 'Shift+';

export function AlignmentDropdown({ editor }: AlignmentDropdownProps) {
  const setAlignment = (align: 'left' | 'center' | 'right' | 'justify') => {
    if (editor.isActive('image')) {
      const current = editor.getAttributes('image').align || 'center-break';
      const isWrapped = current.includes('wrap');

      let newAlign = '';

      if (align === 'center') {
        newAlign = 'center-break';
      } else if (align === 'left') {
        newAlign = isWrapped ? 'left-wrap' : 'left-break';
      } else if (align === 'right') {
        newAlign = isWrapped ? 'right-wrap' : 'right-break';
      } else {
        return;
      }

      editor.chain().focus().updateAttributes('image', { align: newAlign }).run();
    } else {
      editor.chain().focus().setTextAlign(align).run();
    }
  };

  const isAlignActive = (align: string) => {
    if (editor.isActive('image')) {
      const current = editor.getAttributes('image').align || 'center-break';
      return current.startsWith(align);
    }
    return editor.isActive({ textAlign: align });
  };

  // Determine which icon to show based on current alignment
  const getActiveIcon = () => {
    if (isAlignActive('center')) return <RiAlignCenter size={16} />;
    if (isAlignActive('right')) return <RiAlignRight size={16} />;
    if (isAlignActive('justify')) return <RiAlignJustify size={16} />;
    return <RiAlignLeft size={16} />;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="p-1.5 rounded hover:bg-accent hover:text-accent-foreground transition-colors flex items-center gap-0.5 text-muted-foreground"
          title="Text Alignment"
        >
          {getActiveIcon()}
          <RiArrowDownSLine size={12} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuItem
          onClick={() => setAlignment('left')}
          className={isAlignActive('left') ? 'bg-accent' : ''}
        >
          <RiAlignLeft size={16} className="mr-2 shrink-0" />
          <span className="flex-1">Align left</span>
          <DropdownMenuShortcut>{mod}{shift}L</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setAlignment('center')}
          className={isAlignActive('center') ? 'bg-accent' : ''}
        >
          <RiAlignCenter size={16} className="mr-2 shrink-0" />
          <span className="flex-1">Align center</span>
          <DropdownMenuShortcut>{mod}{shift}E</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setAlignment('right')}
          className={isAlignActive('right') ? 'bg-accent' : ''}
        >
          <RiAlignRight size={16} className="mr-2 shrink-0" />
          <span className="flex-1">Align right</span>
          <DropdownMenuShortcut>{mod}{shift}R</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setAlignment('justify')}
          className={isAlignActive('justify') ? 'bg-accent' : ''}
        >
          <RiAlignJustify size={16} className="mr-2 shrink-0" />
          <span className="flex-1">Justify</span>
          <DropdownMenuShortcut>{mod}{shift}J</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
