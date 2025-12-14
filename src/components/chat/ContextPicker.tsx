import { useState, useEffect, useRef, useMemo } from 'react';
import { File, Search } from 'lucide-react';
import { useFileSystem } from '../../store/useFileSystem';
import { FileNode } from '../../shared/types';

interface ContextPickerProps {
  search: string;
  onSelect: (file: { path: string; name: string }) => void;
  onClose: () => void;
}

// Flatten file tree into a list of files
function flattenFiles(nodes: FileNode[]): Array<{ path: string; name: string; displayName?: string }> {
  const result: Array<{ path: string; name: string; displayName?: string }> = [];

  const traverse = (items: FileNode[]) => {
    for (const item of items) {
      if (item.type === 'file' && item.category !== 'unsupported') {
        result.push({
          path: item.path,
          name: item.name,
          displayName: item.displayName,
        });
      }
      if (item.children) {
        traverse(item.children);
      }
    }
  };

  traverse(nodes);
  return result;
}

export function ContextPicker({ search, onSelect, onClose }: ContextPickerProps) {
  const { files } = useFileSystem();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Flatten and filter files
  const filteredFiles = useMemo(() => {
    const allFiles = flattenFiles(files);
    if (!search) return allFiles.slice(0, 20); // Limit initial display

    const searchLower = search.toLowerCase();
    return allFiles
      .filter((file) => {
        const name = (file.displayName || file.name).toLowerCase();
        const path = file.path.toLowerCase();
        return name.includes(searchLower) || path.includes(searchLower);
      })
      .slice(0, 20);
  }, [files, search]);

  // Reset selection when search changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, filteredFiles.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredFiles[selectedIndex]) {
            onSelect(filteredFiles[selectedIndex]);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredFiles, selectedIndex, onSelect, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  // Get relative path for display
  const getRelativePath = (fullPath: string) => {
    const parts = fullPath.split('/');
    // Show last 2-3 path segments
    if (parts.length > 3) {
      return '.../' + parts.slice(-3).join('/');
    }
    return fullPath;
  };

  if (files.length === 0) {
    return (
      <div className="absolute bottom-full left-0 right-0 mb-1 bg-popover border border-border rounded-lg shadow-lg p-4 text-center text-sm text-muted-foreground">
        No files in workspace
      </div>
    );
  }

  if (filteredFiles.length === 0) {
    return (
      <div className="absolute bottom-full left-0 right-0 mb-1 bg-popover border border-border rounded-lg shadow-lg p-4 text-center text-sm text-muted-foreground">
        <Search size={16} className="inline mr-2 opacity-50" />
        No files matching "{search}"
      </div>
    );
  }

  return (
    <div className="absolute bottom-full left-0 right-0 mb-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
      <div className="px-3 py-2 border-b border-border bg-muted/30">
        <span className="text-xs text-muted-foreground">
          Add file context ({filteredFiles.length} file{filteredFiles.length !== 1 ? 's' : ''})
        </span>
      </div>
      <div ref={listRef} className="max-h-[200px] overflow-y-auto">
        {filteredFiles.map((file, index) => (
          <button
            key={file.path}
            className={`w-full px-3 py-2 flex items-center gap-2 text-left text-sm transition-colors ${
              index === selectedIndex
                ? 'bg-accent text-accent-foreground'
                : 'hover:bg-muted/50'
            }`}
            onClick={() => onSelect(file)}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <File size={14} className="text-muted-foreground flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="truncate font-medium">
                {file.displayName || file.name}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {getRelativePath(file.path)}
              </div>
            </div>
          </button>
        ))}
      </div>
      <div className="px-3 py-1.5 border-t border-border bg-muted/30 text-xs text-muted-foreground">
        <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">↑↓</kbd> navigate
        <span className="mx-2">·</span>
        <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">↵</kbd> select
        <span className="mx-2">·</span>
        <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">esc</kbd> cancel
      </div>
    </div>
  );
}
