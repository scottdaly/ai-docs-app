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
  Image as ImageIcon
} from 'lucide-react';
import { BlockTypeDropdown } from './BlockTypeDropdown';
import { FontFamilyDropdown } from './FontFamilyDropdown';
import { FontSizeDropdown } from './FontSizeDropdown';
import { ColorPickerDropdown } from './ColorPickerDropdown';
import { HighlightPickerDropdown } from './HighlightPickerDropdown';
import { useRef } from 'react';

interface EditorToolbarProps {
  editor: Editor | null;
}

export function EditorToolbar({ editor }: EditorToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!editor) {
    return null;
  }

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
    <div className="border-b bg-muted/30 p-1 flex items-center gap-1 flex-wrap">
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

      {/* Media */}
      <button
        onClick={addImage}
        className="p-1.5 rounded hover:bg-accent hover:text-accent-foreground transition-colors text-muted-foreground"
        title="Insert Image"
      >
        <ImageIcon size={16} />
      </button>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="image/*"
      />
    </div>
  );
}