import { Editor } from '@tiptap/react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from './ui/dropdown-menu';
import { 
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  WrapText 
} from 'lucide-react';

interface ImageAlignmentDropdownProps {
  editor: Editor;
}

export function ImageAlignmentDropdown({ editor }: ImageAlignmentDropdownProps) {
  const currentAlign = editor.getAttributes('image').align || 'center-break';

  const setAlign = (align: string) => {
    editor.chain().focus().updateAttributes('image', { align }).run();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="p-1.5 rounded hover:bg-accent hover:text-accent-foreground transition-colors text-muted-foreground outline-none">
         <div className="flex items-center gap-1">
            {/* Show icon based on current state */}
            {(currentAlign === 'left-wrap' || currentAlign === 'left-break') && <AlignLeft size={16} />}
            {(currentAlign === 'center-break') && <AlignCenter size={16} />}
            {(currentAlign === 'right-wrap' || currentAlign === 'right-break') && <AlignRight size={16} />}
         </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>Image Alignment</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <DropdownMenuItem onClick={() => setAlign('left-wrap')} className="flex items-center gap-2">
          <WrapText size={14} className="text-muted-foreground" />
          <span>Left (Wrap Text)</span>
          {currentAlign === 'left-wrap' && <span className="ml-auto text-xs">✓</span>}
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => setAlign('left-break')} className="flex items-center gap-2">
           <AlignLeft size={14} className="text-muted-foreground" />
           <span>Left (No Wrap)</span>
           {currentAlign === 'left-break' && <span className="ml-auto text-xs">✓</span>}
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => setAlign('center-break')} className="flex items-center gap-2">
           <AlignCenter size={14} className="text-muted-foreground" />
           <span>Center</span>
           {currentAlign === 'center-break' && <span className="ml-auto text-xs">✓</span>}
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => setAlign('right-break')} className="flex items-center gap-2">
           <AlignRight size={14} className="text-muted-foreground" />
           <span>Right (No Wrap)</span>
           {currentAlign === 'right-break' && <span className="ml-auto text-xs">✓</span>}
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => setAlign('right-wrap')} className="flex items-center gap-2">
           <WrapText size={14} className="text-muted-foreground rotate-180" />
           <span>Right (Wrap Text)</span>
           {currentAlign === 'right-wrap' && <span className="ml-auto text-xs">✓</span>}
        </DropdownMenuItem>

      </DropdownMenuContent>
    </DropdownMenu>
  );
}
