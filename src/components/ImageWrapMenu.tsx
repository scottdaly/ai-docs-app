import { Editor } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react';
import { WrapText, AlignJustify, Crop } from 'lucide-react';

interface ImageWrapMenuProps {
  editor: Editor;
}

export function ImageWrapMenu({ editor }: ImageWrapMenuProps) {
  const currentAlign = editor.getAttributes('image').align || 'center-break';
  const isWrapped = currentAlign.includes('wrap');
  const isCropping = editor.getAttributes('image').isCropping;

  const setWrap = (wrap: boolean) => {
    let newAlign = currentAlign;
    
    // If enabling wrap
    if (wrap) {
      if (currentAlign.startsWith('left')) newAlign = 'left-wrap';
      else if (currentAlign.startsWith('right')) newAlign = 'right-wrap';
      else newAlign = 'left-wrap'; // Default to left wrap if current is center
    } 
    // If disabling wrap (break)
    else {
      if (currentAlign.startsWith('left')) newAlign = 'left-break';
      else if (currentAlign.startsWith('right')) newAlign = 'right-break';
      else newAlign = 'center-break'; // Default to center break
    }

    editor.chain().focus().updateAttributes('image', { align: newAlign }).run();
  };

  const toggleCrop = () => {
      editor.chain().focus().setMeta('addToHistory', false).updateAttributes('image', { isCropping: !isCropping }).run();
  };

  return (
    <BubbleMenu
      editor={editor}
      tippyOptions={{
        duration: 100,
        placement: 'auto',
        maxWidth: 'none'
      }}
      shouldShow={({ editor }) => editor.isActive('image')}
      className={`flex gap-1 p-1 rounded-lg border bg-popover shadow-md ${isCropping ? 'hidden' : ''}`}
    >
      <button
        onClick={() => setWrap(false)}
        className={`p-1.5 rounded hover:bg-accent hover:text-accent-foreground transition-colors ${
          !isWrapped ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
        }`}
        title="In Line (Break Text)"
      >
        <AlignJustify size={16} />
      </button>
      <button
        onClick={() => setWrap(true)}
        className={`p-1.5 rounded hover:bg-accent hover:text-accent-foreground transition-colors ${
          isWrapped ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
        }`}
        title="Wrap Text"
      >
        <WrapText size={16} />
      </button>
      <div className="w-px h-4 bg-border mx-1 self-center" />
      <button
        onClick={toggleCrop}
        className="p-1.5 rounded hover:bg-accent hover:text-accent-foreground transition-colors text-muted-foreground"
        title="Crop Image"
      >
        <Crop size={16} />
      </button>
    </BubbleMenu>
  );
}
