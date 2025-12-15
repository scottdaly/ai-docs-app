import { RiCloseLine, RiAddLine, RiFolderOpenLine, RiArrowLeftSLine, RiArrowRightSLine } from '@remixicon/react';
import { useFileSystem } from '../store/useFileSystem';
import { useState, useRef, useEffect, useCallback } from 'react';
import { FileNode } from '../shared/types';

export function TabBar() {
  const { openFiles, activeFilePath, selectFile, closeFile, createFile, openFile, renameFile, rootDir } = useFileSystem();
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Check scroll state
  const updateScrollState = useCallback(() => {
    const container = scrollContainerRef.current;
    if (container) {
      setCanScrollLeft(container.scrollLeft > 0);
      setCanScrollRight(container.scrollLeft < container.scrollWidth - container.clientWidth - 1);
    }
  }, []);

  // Update scroll state on mount, resize, and when tabs change
  useEffect(() => {
    updateScrollState();
    const container = scrollContainerRef.current;
    if (container) {
      container.addEventListener('scroll', updateScrollState);
      const resizeObserver = new ResizeObserver(updateScrollState);
      resizeObserver.observe(container);
      return () => {
        container.removeEventListener('scroll', updateScrollState);
        resizeObserver.disconnect();
      };
    }
  }, [updateScrollState, openFiles.length]);

  // Scroll active tab into view when it changes
  useEffect(() => {
    if (activeFilePath && scrollContainerRef.current) {
      const activeTab = scrollContainerRef.current.querySelector(`[data-tab-path="${CSS.escape(activeFilePath)}"]`);
      if (activeTab) {
        activeTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }
    }
  }, [activeFilePath]);

  const scrollLeft = () => {
    scrollContainerRef.current?.scrollBy({ left: -200, behavior: 'smooth' });
  };

  const scrollRight = () => {
    scrollContainerRef.current?.scrollBy({ left: 200, behavior: 'smooth' });
  };

  useEffect(() => {
    if (renamingPath && inputRef.current) {
      inputRef.current.focus();
      // Select all text (extension is already stripped)
      inputRef.current.select();
    }
  }, [renamingPath]);

  const handleCreateDocument = async () => {
    if (!rootDir) return;

    const emptyDoc = {
      type: 'doc' as const,
      content: [{ type: 'paragraph', content: [] }],
    };

    // Create file with triggerRename=true to auto-enter rename mode in sidebar
    await createFile('Untitled', emptyDoc, undefined, true);
  };

  const handleOpenFile = async () => {
    const filePath = await window.electronAPI.selectFile();
    if (filePath && filePath.endsWith('.md')) {
      const name = filePath.split(/[\\/]/).pop() || 'Untitled';
      await openFile({ name, path: filePath, type: 'file' });
    }
  };

  const handleDoubleClick = (file: FileNode) => {
    // Only allow renaming for editable files (native/compatible markdown)
    if (file.category === 'native' || file.category === 'compatible') {
      // Strip .md extension for rename input
      const nameWithoutExt = file.name.toLowerCase().endsWith('.md')
        ? file.name.slice(0, -3)
        : file.name;
      setRenameValue(nameWithoutExt);
      setRenamingPath(file.path);
    }
  };

  const handleRenameSubmit = async () => {
    if (renamingPath && renameValue.trim()) {
      await renameFile(renamingPath, renameValue.trim());
    }
    setRenamingPath(null);
    setRenameValue('');
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRenameSubmit();
    } else if (e.key === 'Escape') {
      setRenamingPath(null);
      setRenameValue('');
    }
  };

  if (openFiles.length === 0 && !rootDir) return null;

  const showScrollButtons = canScrollLeft || canScrollRight;

  return (
    <div className="flex w-full h-9 items-center bg-secondary border-b px-2 overflow-visible">
      {/* Scrollable tabs container */}
      <div className="relative flex-1 min-w-0 flex items-center">
        {/* Left fade indicator */}
        {canScrollLeft && (
          <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-secondary to-transparent pointer-events-none z-10" />
        )}
        {/* Right fade indicator */}
        {canScrollRight && (
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-secondary to-transparent pointer-events-none z-10" />
        )}
        <div
          ref={scrollContainerRef}
          className="flex overflow-x-auto overflow-y-visible scrollbar-hide items-end pb-0.5"
        >
        {openFiles.map((file, index) => {
              const isActive = file.path === activeFilePath;
              const isRenaming = renamingPath === file.path;

              // Hide .md extension for markdown files in tab display
              const displayName = file.name.toLowerCase().endsWith('.md')
                ? file.name.slice(0, -3)
                : file.name;

              // Check if we should show a divider before this tab
              // Show divider if: not first tab, current tab is not active, previous tab is not active
              const prevFile = index > 0 ? openFiles[index - 1] : null;
              const isPrevActive = prevFile?.path === activeFilePath;
              const showDivider = index > 0 && !isActive && !isPrevActive;

              return (
                <div key={file.path} className="flex items-center">
                  {/* Divider between inactive tabs */}
                  {showDivider && (
                    <div className="w-px h-4 bg-muted-foreground/30" />
                  )}
                  <div
                    data-tab-path={file.path}
                    onClick={() => !isRenaming && selectFile(file.path)}
                    onDoubleClick={() => handleDoubleClick(file)}
                    title={displayName}
                    className={`
                      relative flex items-center min-w-[120px] max-w-[200px] px-3 text-sm select-none cursor-pointer group transition-all
                      h-8 rounded-md ${isActive
                        ? 'bg-background text-foreground font-medium shadow-md'
                        : 'text-muted-foreground hover:bg-white/10'
                      }
                    `}
                  >

              {isRenaming ? (

                <input

                  ref={inputRef}

                  type="text"

                  value={renameValue}

                  onChange={(e) => setRenameValue(e.target.value)}

                  onBlur={handleRenameSubmit}

                  onKeyDown={handleRenameKeyDown}

                  onClick={(e) => e.stopPropagation()}

                  className="flex-1 min-w-0 bg-background border rounded px-1 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"

                />

              ) : (

                <span className="truncate flex-1">{displayName}</span>

              )}

              <button

                onClick={(e) => {

                  e.stopPropagation();

                  closeFile(file.path);

                }}

                className={`

                  ml-2 p-0.5 rounded-full hover:bg-muted-foreground/20 text-muted-foreground hover:text-foreground

                  opacity-0 group-hover:opacity-100 transition-opacity

                  ${isActive ? 'opacity-100' : ''}

                `}

              >

                <RiCloseLine size={13} />

              </button>

                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Scroll arrows - both on the right */}
      {showScrollButtons && (
        <div className="flex items-center flex-shrink-0 h-full">
          <button
            onClick={scrollLeft}
            disabled={!canScrollLeft}
            className={`p-1 rounded transition-colors ${
              canScrollLeft
                ? 'text-muted-foreground hover:text-foreground hover:bg-white/10'
                : 'text-muted-foreground/30 cursor-default'
            }`}
          >
            <RiArrowLeftSLine size={16} />
          </button>
          <button
            onClick={scrollRight}
            disabled={!canScrollRight}
            className={`p-1 rounded transition-colors ${
              canScrollRight
                ? 'text-muted-foreground hover:text-foreground hover:bg-white/10'
                : 'text-muted-foreground/30 cursor-default'
            }`}
          >
            <RiArrowRightSLine size={16} />
          </button>
        </div>
      )}

      {rootDir && (
        <div className="flex items-center ml-1 flex-shrink-0 h-full">
          {/* Divider before + button */}
          <div className="w-px h-4 bg-muted-foreground/30 mr-1" />
          <button
            onClick={handleCreateDocument}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
            title="New Document"
          >
            <RiAddLine size={16} />
          </button>
          {/* Divider between + and folder buttons */}
          <div className="w-px h-4 bg-muted-foreground/30 mx-0.5" />
          <button
            onClick={handleOpenFile}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
            title="Open File"
          >
            <RiFolderOpenLine size={16} />
          </button>
        </div>
      )}
    </div>
  );

  }
