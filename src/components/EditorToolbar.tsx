import { Editor } from '@tiptap/react';
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  Underline as UnderlineIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Image as ImageIcon,
  Minus,
  History,
  Bookmark,
  GitBranch,
  Sparkles,
} from 'lucide-react';
import { BlockTypeDropdown } from './BlockTypeDropdown';
import { FontFamilyDropdown } from './FontFamilyDropdown';
import { FontSizeDropdown } from './FontSizeDropdown';
import { ColorPickerDropdown } from './ColorPickerDropdown';
import { HighlightPickerDropdown } from './HighlightPickerDropdown';
import { useHistoryStore } from '../store/useHistoryStore';
import { useDraftStore } from '../store/useDraftStore';
import { useFileSystem } from '../store/useFileSystem';
import { useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { RightSidebarMode } from './RightSidebar';

interface EditorToolbarProps {
  editor: Editor | null;
  rightPanelMode: RightSidebarMode;
  onSetRightPanelMode: (mode: RightSidebarMode) => void;
}

export function EditorToolbar({ editor, rightPanelMode, onSetRightPanelMode }: EditorToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { createBookmark } = useHistoryStore();
  const { activeDraft } = useDraftStore();
  const { rootDir, activeFilePath } = useFileSystem();
  const [isCreatingBookmark, setIsCreatingBookmark] = useState(false);
  const [isSavingBookmark, setIsSavingBookmark] = useState(false);
  const [bookmarkName, setBookmarkName] = useState('');

  if (!editor) {
    return null;
  }

  const handleCreateBookmark = async () => {
    if (!rootDir || !activeFilePath || !bookmarkName.trim() || isSavingBookmark) return;

    setIsSavingBookmark(true);
    try {
      const json = editor.getJSON();
      const success = await createBookmark(rootDir, activeFilePath, json, bookmarkName.trim());

      if (success) {
        setBookmarkName('');
        setIsCreatingBookmark(false);
      }
    } finally {
      setIsSavingBookmark(false);
    }
  };

  const toggle = (callback: () => void) => {
      callback();
      editor.view.focus();
  };

  const setAlignment = (align: 'left' | 'center' | 'right' | 'justify') => {
    if (editor.isActive('image')) {
      const current = editor.getAttributes('image').align || 'center-break';
      const isWrapped = current.includes('wrap');
      
      let newAlign = '';
      
      if (align === 'center') {
        newAlign = 'center-break'; // Center is always break
      } else if (align === 'left') {
        newAlign = isWrapped ? 'left-wrap' : 'left-break';
      } else if (align === 'right') {
        newAlign = isWrapped ? 'right-wrap' : 'right-break';
      } else {
        // Justify - ignore for images or default to center
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

  const addImage = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (readerEvent) => {
        const base64 = readerEvent.target?.result;
        if (typeof base64 === 'string') {
          editor.chain().focus().setImage({ src: base64 }).run();
        }
      };
      reader.readAsDataURL(file);
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
        fileInputRef.current.value = '';
    }
  };

  return (
    <div className="border-b bg-background p-1 flex items-center gap-1 flex-wrap">
      <BlockTypeDropdown editor={editor} />
      <FontFamilyDropdown editor={editor} />
      <FontSizeDropdown editor={editor} />

      <div className="w-px h-4 bg-border mx-2" />

      {/* Text Formatting */}
      <button
        onClick={() => toggle(() => editor.chain().focus().toggleBold().run())}
        disabled={!editor.can().chain().focus().toggleBold().run()}
        className={`p-1.5 rounded hover:bg-accent hover:text-accent-foreground transition-colors ${
          editor.isActive('bold') ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
        }`}
        title="Bold"
      >
        <Bold size={16} />
      </button>
      <button
        onClick={() => toggle(() => editor.chain().focus().toggleItalic().run())}
        disabled={!editor.can().chain().focus().toggleItalic().run()}
        className={`p-1.5 rounded hover:bg-accent hover:text-accent-foreground transition-colors ${
          editor.isActive('italic') ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
        }`}
        title="Italic"
      >
        <Italic size={16} />
      </button>
      <button
        onClick={() => toggle(() => editor.chain().focus().toggleStrike().run())}
        disabled={!editor.can().chain().focus().toggleStrike().run()}
        className={`p-1.5 rounded hover:bg-accent hover:text-accent-foreground transition-colors ${
          editor.isActive('strike') ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
        }`}
        title="Strikethrough"
      >
        <Strikethrough size={16} />
      </button>
      <button
        onClick={() => toggle(() => editor.chain().focus().toggleCode().run())}
        disabled={!editor.can().chain().focus().toggleCode().run()}
        className={`p-1.5 rounded hover:bg-accent hover:text-accent-foreground transition-colors ${
          editor.isActive('code') ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
        }`}
        title="Inline Code"
      >
        <Code size={16} />
      </button>
      <button
        onClick={() => toggle(() => editor.chain().focus().toggleUnderline().run())}
        disabled={!editor.can().chain().focus().toggleUnderline().run()}
        className={`p-1.5 rounded hover:bg-accent hover:text-accent-foreground transition-colors ${
          editor.isActive('underline') ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
        }`}
        title="Underline (Ctrl+U)"
      >
        <UnderlineIcon size={16} />
      </button>

      <div className="w-px h-4 bg-border mx-2" />

      {/* Text Color & Highlighting */}
      <ColorPickerDropdown editor={editor} />
      <HighlightPickerDropdown editor={editor} />

      <div className="w-px h-4 bg-border mx-2" />

      {/* Alignment */}
      <button
        onClick={() => setAlignment('left')}
        className={`p-1.5 rounded hover:bg-accent hover:text-accent-foreground transition-colors ${
          isAlignActive('left') ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
        }`}
        title="Align Left"
      >
        <AlignLeft size={16} />
      </button>
      <button
        onClick={() => setAlignment('center')}
        className={`p-1.5 rounded hover:bg-accent hover:text-accent-foreground transition-colors ${
          isAlignActive('center') ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
        }`}
        title="Align Center"
      >
        <AlignCenter size={16} />
      </button>
      <button
        onClick={() => setAlignment('right')}
        className={`p-1.5 rounded hover:bg-accent hover:text-accent-foreground transition-colors ${
          isAlignActive('right') ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
        }`}
        title="Align Right"
      >
        <AlignRight size={16} />
      </button>
      <button
        onClick={() => toggle(() => editor.chain().focus().setTextAlign('justify').run())}
        className={`p-1.5 rounded hover:bg-accent hover:text-accent-foreground transition-colors ${
          editor.isActive({ textAlign: 'justify' }) ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
        }`}
        title="Justify"
      >
        <AlignJustify size={16} />
      </button>

      <div className="w-px h-4 bg-border mx-2" />

      {/* Media & Insert */}
      <button
        onClick={addImage}
        className="p-1.5 rounded hover:bg-accent hover:text-accent-foreground transition-colors text-muted-foreground"
        title="Insert Image"
      >
        <ImageIcon size={16} />
      </button>
      <button
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
        className="p-1.5 rounded hover:bg-accent hover:text-accent-foreground transition-colors text-muted-foreground"
        title="Insert Horizontal Rule"
      >
        <Minus size={16} />
      </button>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="image/*"
      />

      {/* Spacer to push history controls to the right */}
      <div className="flex-1" />

      {/* Bookmark creation */}
      {isCreatingBookmark ? (
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={bookmarkName}
            onChange={(e) => setBookmarkName(e.target.value.slice(0, 50))}
            placeholder="Bookmark name..."
            className="text-xs px-2 py-1 border rounded bg-background w-32"
            maxLength={50}
            autoFocus
            disabled={isSavingBookmark}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateBookmark();
              if (e.key === 'Escape') {
                setIsCreatingBookmark(false);
                setBookmarkName('');
              }
            }}
          />
          <button
            onClick={handleCreateBookmark}
            disabled={!bookmarkName.trim() || isSavingBookmark}
            className="text-xs px-2 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1"
          >
            {isSavingBookmark ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                Saving...
              </>
            ) : (
              'Save'
            )}
          </button>
          <button
            onClick={() => {
              setIsCreatingBookmark(false);
              setBookmarkName('');
            }}
            className="text-xs px-2 py-1 border rounded hover:bg-muted"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setIsCreatingBookmark(true)}
          className="p-1.5 rounded hover:bg-accent hover:text-accent-foreground transition-colors text-muted-foreground"
          title="Create Bookmark"
        >
          <Bookmark size={16} />
        </button>
      )}

      <div className="w-px h-4 bg-border mx-1" />

      {/* History toggle */}
      <button
        onClick={() => onSetRightPanelMode(rightPanelMode === 'history' ? null : 'history')}
        className={`p-1.5 rounded hover:bg-accent hover:text-accent-foreground transition-colors ${
          rightPanelMode === 'history' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
        }`}
        title="Version History"
      >
        <History size={16} />
      </button>

      {/* Drafts toggle */}
      <button
        onClick={() => onSetRightPanelMode(rightPanelMode === 'drafts' ? null : 'drafts')}
        className={`p-1.5 rounded hover:bg-accent hover:text-accent-foreground transition-colors ${
          rightPanelMode === 'drafts' || activeDraft ? 'bg-purple-500/20 text-purple-600' : 'text-muted-foreground'
        }`}
        title={activeDraft ? `Editing draft: ${activeDraft.name}` : 'Drafts'}
      >
        <GitBranch size={16} />
      </button>

      {/* AI Assistant toggle */}
      <div className="w-px h-4 bg-border mx-1" />
      <button
        onClick={() => onSetRightPanelMode(rightPanelMode === 'ai' ? null : 'ai')}
        className={`p-1.5 rounded hover:bg-accent hover:text-accent-foreground transition-colors ${
          rightPanelMode === 'ai' ? 'bg-primary/20 text-primary' : 'text-muted-foreground'
        }`}
        title="AI Assistant"
      >
        <Sparkles size={16} />
      </button>
    </div>
  );
}