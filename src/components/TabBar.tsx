import { X, Plus, FolderOpen } from 'lucide-react';
import { useFileSystem } from '../store/useFileSystem';
import { useState, useRef, useEffect } from 'react';

export function TabBar() {
  const { openFiles, activeFilePath, selectFile, closeFile, createFile, openFile, renameFile, rootDir } = useFileSystem();
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renamingPath && inputRef.current) {
      inputRef.current.focus();
      // Select filename without extension
      const nameWithoutExt = renameValue.replace(/\.md$/, '');
      inputRef.current.setSelectionRange(0, nameWithoutExt.length);
    }
  }, [renamingPath]);

  const handleCreateDocument = async () => {
    if (!rootDir) return;

    const emptyDoc = {
      type: 'doc' as const,
      content: [{ type: 'paragraph', content: [] }],
    };

    await createFile('Untitled', emptyDoc);
  };

  const handleOpenFile = async () => {
    const filePath = await window.electronAPI.selectFile();
    if (filePath && filePath.endsWith('.md')) {
      const name = filePath.split(/[\\/]/).pop() || 'Untitled';
      await openFile({ name, path: filePath, type: 'file' });
    }
  };

  const handleDoubleClick = (file: { name: string; path: string }) => {
    setRenameValue(file.name);
    setRenamingPath(file.path);
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

  return (
    <div className="flex items-center border-b bg-background overflow-x-auto scrollbar-hide">
      {openFiles.map((file) => {
        const isActive = file.path === activeFilePath;
        const isRenaming = renamingPath === file.path;

        return (
          <div
            key={file.path}
            onClick={() => !isRenaming && selectFile(file.path)}
            onDoubleClick={() => handleDoubleClick(file)}
            className={`
              flex items-center min-w-[120px] max-w-[200px] h-9 px-3 border-r text-sm select-none cursor-pointer group
              ${isActive ? 'bg-background text-foreground font-medium' : 'bg-muted/30 text-muted-foreground hover:bg-muted/50'}
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
              <span className="truncate flex-1">{file.name}</span>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeFile(file.path);
              }}
              className={`ml-2 p-0.5 rounded-sm hover:bg-muted-foreground/20 opacity-0 group-hover:opacity-100 ${isActive ? 'opacity-100' : ''}`}
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
      {rootDir && (
        <>
          <button
            onClick={handleCreateDocument}
            className="h-9 px-3 border-r text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            title="New Document"
          >
            <Plus size={14} />
          </button>
          <button
            onClick={handleOpenFile}
            className="h-9 px-3 border-r text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            title="Open File"
          >
            <FolderOpen size={14} />
          </button>
        </>
      )}
    </div>
  );
}
