import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { RiSearchLine, RiFileTextLine, RiImageLine, RiFileLine, RiFolderLine } from '@remixicon/react';
import { useFileSystem } from '../store/useFileSystem';
import { FileNode } from '../shared/types';

interface SearchModalProps {
  open: boolean;
  onClose: () => void;
}

// Flatten file tree to get all files (not folders)
function flattenFiles(nodes: FileNode[]): FileNode[] {
  const result: FileNode[] = [];
  for (const node of nodes) {
    if (node.type === 'file') {
      result.push(node);
    }
    if (node.children) {
      result.push(...flattenFiles(node.children));
    }
  }
  return result;
}

// Get relative path from root
function getRelativePath(fullPath: string, rootDir: string): string {
  if (fullPath.startsWith(rootDir)) {
    return fullPath.slice(rootDir.length + 1); // +1 for the slash
  }
  return fullPath;
}

// Get icon based on file category
function getFileIcon(category: FileNode['category']) {
  switch (category) {
    case 'native':
    case 'compatible':
      return RiFileTextLine;
    case 'viewable':
      return RiImageLine;
    default:
      return RiFileLine;
  }
}

export function SearchModal({ open, onClose }: SearchModalProps) {
  const { files, rootDir, openFile } = useFileSystem();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Flatten and filter files based on query
  const allFiles = useMemo(() => flattenFiles(files), [files]);

  const filteredFiles = useMemo(() => {
    if (!query.trim()) {
      return allFiles.slice(0, 20); // Show first 20 files when no query
    }
    const lowerQuery = query.toLowerCase();
    return allFiles
      .filter(file => file.name.toLowerCase().includes(lowerQuery))
      .slice(0, 20); // Limit to 20 results
  }, [allFiles, query]);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredFiles]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedElement = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      selectedElement?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const handleSelect = useCallback((file: FileNode) => {
    openFile(file);
    onClose();
  }, [openFile, onClose]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filteredFiles.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredFiles[selectedIndex]) {
          handleSelect(filteredFiles[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/50"
      onClick={onClose}
    >
      <div
        className="bg-background border rounded-lg shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b">
          <RiSearchLine size={18} className="text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search files..."
            className="flex-1 bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
          />
        </div>

        {/* Results list */}
        <div ref={listRef} className="max-h-80 overflow-y-auto">
          {filteredFiles.length === 0 ? (
            <div className="px-4 py-8 text-center text-muted-foreground">
              {query ? 'No files found' : 'No files in workspace'}
            </div>
          ) : (
            filteredFiles.map((file, index) => {
              const Icon = getFileIcon(file.category);
              const relativePath = rootDir ? getRelativePath(file.path, rootDir) : file.path;
              const pathParts = relativePath.split(/[/\\]/);
              const fileName = pathParts.pop() || file.name;
              const folderPath = pathParts.join('/');

              return (
                <div
                  key={file.path}
                  data-index={index}
                  onClick={() => handleSelect(file)}
                  className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                    index === selectedIndex
                      ? 'bg-accent text-accent-foreground'
                      : 'hover:bg-muted/50'
                  }`}
                >
                  <Icon size={16} className="shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium">{fileName}</div>
                    {folderPath && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                        <RiFolderLine size={12} />
                        <span>{folderPath}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t text-xs text-muted-foreground flex items-center gap-4">
          <span><kbd className="px-1.5 py-0.5 bg-muted rounded">↑↓</kbd> Navigate</span>
          <span><kbd className="px-1.5 py-0.5 bg-muted rounded">Enter</kbd> Open</span>
          <span><kbd className="px-1.5 py-0.5 bg-muted rounded">Esc</kbd> Close</span>
        </div>
      </div>
    </div>
  );
}
