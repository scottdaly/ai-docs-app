import { Editor } from '@tiptap/react';
import {
  Bold,
  Image as ImageIcon,
  Minus,
  History,
  Bookmark,
  GitBranch,
  Sparkles,
  MoreVertical,
} from 'lucide-react';
import { BlockTypeDropdown } from './BlockTypeDropdown';
import { FontFamilyDropdown } from './FontFamilyDropdown';
import { FontSizeDropdown } from './FontSizeDropdown';
import { ColorPickerDropdown } from './ColorPickerDropdown';
import { HighlightPickerDropdown } from './HighlightPickerDropdown';
import { TextStyleDropdown } from './TextStyleDropdown';
import { AlignmentDropdown } from './AlignmentDropdown';
import { useHistoryStore } from '../store/useHistoryStore';
import { useDraftStore } from '../store/useDraftStore';
import { useFileSystem } from '../store/useFileSystem';
import { useRef, useState, useEffect, useCallback, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { RightSidebarMode } from './RightSidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

interface EditorToolbarProps {
  editor: Editor | null;
  rightPanelMode: RightSidebarMode;
  onSetRightPanelMode: (mode: RightSidebarMode) => void;
}

interface ToolbarItem {
  id: string;
  render: () => ReactNode;
  isDivider?: boolean;
}

export function EditorToolbar({ editor, rightPanelMode, onSetRightPanelMode }: EditorToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const itemsContainerRef = useRef<HTMLDivElement>(null);
  const { createBookmark } = useHistoryStore();
  const { activeDraft } = useDraftStore();
  const { rootDir, activeFilePath } = useFileSystem();
  const [isCreatingBookmark, setIsCreatingBookmark] = useState(false);
  const [isSavingBookmark, setIsSavingBookmark] = useState(false);
  const [bookmarkName, setBookmarkName] = useState('');
  const [overflowIndex, setOverflowIndex] = useState<number>(-1);
  const lastOverflowIndexRef = useRef<number>(-1);
  const itemWidthsRef = useRef<number[]>([]);
  const isInitializedRef = useRef(false);

  const handleCreateBookmark = async () => {
    if (!editor || !rootDir || !activeFilePath || !bookmarkName.trim() || isSavingBookmark) return;

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

  const toggle = useCallback((callback: () => void) => {
    if (!editor) return;
    callback();
    editor.view.focus();
  }, [editor]);

  const addImage = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    if (!editor) return;
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
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [editor]);

  // Calculate overflow on resize - with hysteresis to prevent flashing
  const calculateOverflow = useCallback(() => {
    if (!toolbarRef.current || !itemsContainerRef.current) return;

    const toolbar = toolbarRef.current;
    const container = itemsContainerRef.current;
    const items = container.children;

    // Cache item widths on first calculation (when all items are visible)
    if (!isInitializedRef.current || itemWidthsRef.current.length === 0) {
      const widths: number[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i] as HTMLElement;
        widths.push(item.offsetWidth + 4); // Include gap
      }
      if (widths.length > 0 && widths.some(w => w > 4)) {
        itemWidthsRef.current = widths;
        isInitializedRef.current = true;
      }
    }

    // Get the available width (toolbar width minus right-side controls and overflow button)
    const toolbarWidth = toolbar.clientWidth;
    const rightControlsWidth = 180; // Approximate width for right-side controls
    const overflowButtonWidth = 36; // Width of overflow button
    const hysteresis = 20; // Extra buffer to prevent oscillation

    // Use different available width based on current state
    const currentlyOverflowing = lastOverflowIndexRef.current !== -1;
    const availableWidth = toolbarWidth - rightControlsWidth - (currentlyOverflowing ? overflowButtonWidth : 0) - 16;

    // Use cached widths for calculation
    const widths = itemWidthsRef.current;
    if (widths.length === 0) return;

    let currentWidth = 0;
    let newOverflowIndex = -1;

    for (let i = 0; i < widths.length; i++) {
      currentWidth += widths[i];

      // Add hysteresis: if currently overflowing, require more space to un-overflow
      const threshold = currentlyOverflowing ? availableWidth + hysteresis : availableWidth;

      if (currentWidth > threshold && newOverflowIndex === -1) {
        newOverflowIndex = i;
        break;
      }
    }

    // Only update if the index actually changed
    if (newOverflowIndex !== lastOverflowIndexRef.current) {
      lastOverflowIndexRef.current = newOverflowIndex;
      setOverflowIndex(newOverflowIndex);
    }
  }, []);

  useEffect(() => {
    // Initial calculation after a short delay to ensure DOM is ready
    const initialTimeout = setTimeout(() => {
      calculateOverflow();
    }, 50);

    let resizeTimeout: ReturnType<typeof setTimeout>;
    const resizeObserver = new ResizeObserver(() => {
      // Debounce resize calculations
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        calculateOverflow();
      }, 16); // ~60fps
    });

    if (toolbarRef.current) {
      resizeObserver.observe(toolbarRef.current);
    }

    return () => {
      clearTimeout(initialTimeout);
      clearTimeout(resizeTimeout);
      resizeObserver.disconnect();
    };
  }, [calculateOverflow]);

  if (!editor) {
    return null;
  }

  // Define toolbar items
  const toolbarItems: ToolbarItem[] = [
    {
      id: 'blockType',
      render: () => <BlockTypeDropdown editor={editor} />,
    },
    {
      id: 'fontFamily',
      render: () => <FontFamilyDropdown editor={editor} />,
    },
    {
      id: 'fontSize',
      render: () => <FontSizeDropdown editor={editor} />,
    },
    {
      id: 'divider1',
      render: () => <div className="w-px h-4 bg-border mx-2" />,
      isDivider: true,
    },
    {
      id: 'bold',
      render: () => (
        <button
          onClick={() => toggle(() => editor.chain().focus().toggleBold().run())}
          disabled={!editor.can().chain().focus().toggleBold().run()}
          className={`p-1.5 rounded hover:bg-accent hover:text-accent-foreground transition-colors ${
            editor.isActive('bold') ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
          }`}
          title="Bold (Ctrl+B)"
        >
          <Bold size={16} />
        </button>
      ),
    },
    {
      id: 'textStyle',
      render: () => <TextStyleDropdown editor={editor} />,
    },
    {
      id: 'divider2',
      render: () => <div className="w-px h-4 bg-border mx-2" />,
      isDivider: true,
    },
    {
      id: 'textColor',
      render: () => <ColorPickerDropdown editor={editor} />,
    },
    {
      id: 'highlight',
      render: () => <HighlightPickerDropdown editor={editor} />,
    },
    {
      id: 'divider3',
      render: () => <div className="w-px h-4 bg-border mx-2" />,
      isDivider: true,
    },
    {
      id: 'alignment',
      render: () => <AlignmentDropdown editor={editor} />,
    },
    {
      id: 'divider4',
      render: () => <div className="w-px h-4 bg-border mx-2" />,
      isDivider: true,
    },
    {
      id: 'image',
      render: () => (
        <button
          onClick={addImage}
          className="p-1.5 rounded hover:bg-accent hover:text-accent-foreground transition-colors text-muted-foreground"
          title="Insert Image"
        >
          <ImageIcon size={16} />
        </button>
      ),
    },
    {
      id: 'horizontalRule',
      render: () => (
        <button
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          className="p-1.5 rounded hover:bg-accent hover:text-accent-foreground transition-colors text-muted-foreground"
          title="Insert Horizontal Rule"
        >
          <Minus size={16} />
        </button>
      ),
    },
  ];

  // Split items into visible and overflow
  const visibleItems = overflowIndex === -1 ? toolbarItems : toolbarItems.slice(0, overflowIndex);
  const overflowItems = overflowIndex === -1 ? [] : toolbarItems.slice(overflowIndex);

  // Filter out leading/trailing dividers from overflow and don't show dividers at boundaries
  const filteredVisibleItems = visibleItems.filter((item, index) => {
    if (!item.isDivider) return true;
    // Don't show divider if it's the last visible item
    if (index === visibleItems.length - 1) return false;
    return true;
  });

  return (
    <div ref={toolbarRef} className="border-b bg-background p-1 flex items-center gap-1 flex-nowrap">
      {/* Main toolbar items */}
      <div ref={itemsContainerRef} className="flex items-center gap-1">
        {filteredVisibleItems.map((item) => (
          <div key={item.id} className="shrink-0">
            {item.render()}
          </div>
        ))}
      </div>

      {/* Overflow menu */}
      {overflowItems.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="p-1.5 rounded hover:bg-accent hover:text-accent-foreground transition-colors text-muted-foreground shrink-0"
              title="More options"
            >
              <MoreVertical size={16} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="p-1 overflow-visible">
            <div className="flex items-center gap-1 flex-wrap max-w-[300px]">
              {overflowItems.map((item) => {
                if (item.isDivider) {
                  return <div key={item.id} className="w-px h-4 bg-border mx-1" />;
                }
                return (
                  <div key={item.id} className="shrink-0">
                    {item.render()}
                  </div>
                );
              })}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept="image/*"
      />

      {/* Spacer to push right controls */}
      <div className="flex-1 min-w-0" />

      {/* Right-side controls (always visible) */}
      <div className="flex items-center gap-1 shrink-0">
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
    </div>
  );
}
