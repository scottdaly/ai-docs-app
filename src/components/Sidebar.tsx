import { ChevronRight, ChevronDown, Settings, Plus } from 'lucide-react';
import { MidlightFileIcon } from './icons/MidlightFileIcon';
import { ImportableFileIcon } from './icons/ImportableFileIcon';
import { FolderIcon } from './icons/FolderIcon';
import { useFileSystem } from '../store/useFileSystem';
import { useSettingsStore } from '../store/useSettingsStore';
import { useClipboardStore } from '../store/useClipboardStore';
import { useState, useRef, useEffect, useCallback } from 'react';
import { FileNode } from '../shared/types';
import { FileContextMenu } from './FileContextMenu';
import { UndoConfirmDialog } from './UndoConfirmDialog';
import { ImportConfirmDialog } from './ImportConfirmDialog';
import { getFileIcon, getFileIconClass, getFileOpacityClass } from '../utils/fileIcons';
import { htmlToTiptapJson } from '../utils/htmlToTiptap';

// Helper to flatten the file tree into an ordered list of paths
function flattenFileTree(nodes: FileNode[], expandedPaths: Set<string>): string[] {
  const result: string[] = [];
  for (const node of nodes) {
    result.push(node.path);
    if (node.type === 'directory' && expandedPaths.has(node.path) && node.children) {
      result.push(...flattenFileTree(node.children, expandedPaths));
    }
  }
  return result;
}

interface FileTreeItemProps {
  node: FileNode;
  level?: number;
  onCreateInFolder?: (folderPath: string) => void;
  selectedPaths: Set<string>;
  onSelect: (path: string, shiftKey: boolean, metaKey: boolean) => void;
  onExpandedChange?: (path: string, isExpanded: boolean) => void;
  expandedPaths: Set<string>;
  onClearSelection: () => void;
  onImportableClick?: (node: FileNode) => void;
}

function FileTreeItem({ node, level = 0, onCreateInFolder, selectedPaths, onSelect, onExpandedChange, expandedPaths, onClearSelection, onImportableClick }: FileTreeItemProps) {
  const isOpen = expandedPaths.has(node.path);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(node.name);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const isRenamingRef = useRef(false); // Track renaming state synchronously
  const { loadSubDirectory, openFile, activeFilePath, renameFile, rootDir, loadDir } = useFileSystem();
  const paddingLeft = `${level * 12 + 12}px`;

  const isActive = activeFilePath === node.path;
  const isSelected = selectedPaths.has(node.path);

  // Focus input when renaming starts - use timeout to wait for context menu to close
  // Only run when isRenaming becomes true, not on every renameValue change
  const initialFocusDoneRef = useRef(false);

  useEffect(() => {
    if (isRenaming && !initialFocusDoneRef.current) {
      // Small delay to ensure context menu has closed and input is rendered
      const timeoutId = setTimeout(() => {
        if (renameInputRef.current && isRenamingRef.current) {
          renameInputRef.current.focus();
          // Select the name without extension for files
          if (node.type === 'file') {
            const nameWithoutExt = node.name.replace(/\.[^.]+$/, '');
            renameInputRef.current.setSelectionRange(0, nameWithoutExt.length);
          } else {
            renameInputRef.current.select();
          }
          initialFocusDoneRef.current = true;
        }
      }, 50);
      return () => clearTimeout(timeoutId);
    } else if (!isRenaming) {
      initialFocusDoneRef.current = false;
    }
  }, [isRenaming, node.type, node.name]);

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    // Use ref for synchronous check since state updates are async
    if (isRenaming || isRenamingRef.current) return;

    // Handle selection with shift/meta keys
    onSelect(node.path, e.shiftKey, e.metaKey || e.ctrlKey);

    if (node.type === 'directory') {
        if (!isOpen && !node.children) {
            await loadSubDirectory(node.path);
        }
        onExpandedChange?.(node.path, !isOpen);
    } else {
        // Only open file on single click without modifier keys
        if (!e.shiftKey && !e.metaKey && !e.ctrlKey) {
            // For importable files (docx, rtf, html), show import dialog instead
            if (node.category === 'importable' && onImportableClick) {
                onImportableClick(node);
            } else {
                await openFile(node);
            }
        }
    }
  };

  const handleRename = () => {
    isRenamingRef.current = true;
    setRenameValue(node.name);
    setIsRenaming(true);
  };

  const handleRenameSubmit = async () => {
    if (!isRenamingRef.current) return; // Already submitted
    isRenamingRef.current = false;

    if (renameValue.trim() && renameValue !== node.name) {
      await renameFile(node.path, renameValue.trim());
    }
    setIsRenaming(false);
  };

  const handleBlur = (e: React.FocusEvent) => {
    // Check if focus is moving to the parent container (happens when context menu closes)
    // In that case, we should refocus the input instead of submitting
    const relatedTarget = e.relatedTarget as HTMLElement | null;
    if (relatedTarget && e.currentTarget.parentElement?.contains(relatedTarget)) {
      // Refocus the input after a short delay
      setTimeout(() => {
        if (isRenamingRef.current && renameInputRef.current) {
          renameInputRef.current.focus();
        }
      }, 10);
      return;
    }

    // Small delay to allow click events to process first
    setTimeout(() => {
      if (isRenamingRef.current) {
        handleRenameSubmit();
      }
    }, 100);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRenameSubmit();
    } else if (e.key === 'Escape') {
      isRenamingRef.current = false;
      setIsRenaming(false);
      setRenameValue(node.name);
    }
  };

  const handleNewDocument = () => {
    if (onCreateInFolder) {
      onCreateInFolder(node.path);
    }
  };

  const handleNewFolder = async () => {
    const folderName = 'New Folder';
    const result = await window.electronAPI.folderCreate(node.path, folderName);
    if (result.success && rootDir) {
      await loadDir(rootDir);
      // Expand this folder to show the new one
      if (!isOpen) {
        await loadSubDirectory(node.path);
        onExpandedChange?.(node.path, true);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'F2' && !isRenaming) {
      e.preventDefault();
      handleRename();
    } else if (e.key === 'Delete' && !isRenaming) {
      e.preventDefault();
      window.electronAPI.fileTrash(node.path).then(() => {
        if (rootDir) loadDir(rootDir);
      });
    }
  };

  // Get the appropriate icon for this file type
  const FileIconComponent = getFileIcon(node.category);
  const iconClass = node.type === 'directory'
    ? ''
    : getFileIconClass(node.category, isActive);
  const opacityClass = node.type === 'file' ? getFileOpacityClass(node.category) : '';

  // Use displayName for native files, otherwise use full name
  const displayText = node.displayName || node.name;

  const itemContent = (
    <div
      className={`flex items-center py-1 px-2 cursor-pointer text-sm select-none ${opacityClass} ${
        isSelected
          ? 'text-foreground'
          : isActive
            ? 'bg-accent text-accent-foreground'
            : 'text-foreground/90 hover:bg-accent/50'
      }`}
      style={{
        paddingLeft,
        backgroundColor: isSelected ? 'hsl(var(--browser-selection))' : undefined
      }}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <span className={`mr-1 ${isActive ? 'text-accent-foreground/70' : 'text-foreground/50'}`}>
          {node.type === 'directory' ? (
              isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />
          ) : <span className="w-3.5 inline-block" />}
      </span>
      <span className={`mr-2 ${iconClass}`}>
        {node.type === 'directory' ? (
          <FolderIcon size={16} />
        ) : node.category === 'native' ? (
          <MidlightFileIcon size={16} />
        ) : node.category === 'importable' ? (
          <ImportableFileIcon size={16} />
        ) : (
          <FileIconComponent size={16} />
        )}
      </span>
      {isRenaming ? (
        <input
          ref={renameInputRef}
          type="text"
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleRenameKeyDown}
          onClick={(e) => e.stopPropagation()}
          className="flex-1 min-w-0 bg-background border rounded px-1 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        />
      ) : (
        <span className="truncate">{displayText}</span>
      )}
    </div>
  );

  return (
    <div>
      <FileContextMenu
        node={node}
        onRename={handleRename}
        onNewDocument={node.type === 'directory' ? handleNewDocument : undefined}
        onNewFolder={node.type === 'directory' ? handleNewFolder : undefined}
        selectedPaths={selectedPaths}
        onClearSelection={onClearSelection}
      >
        {itemContent}
      </FileContextMenu>
      {isOpen && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeItem
              key={child.path}
              node={child}
              level={level + 1}
              onCreateInFolder={onCreateInFolder}
              selectedPaths={selectedPaths}
              onSelect={onSelect}
              onExpandedChange={onExpandedChange}
              expandedPaths={expandedPaths}
              onClearSelection={onClearSelection}
              onImportableClick={onImportableClick}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const { files, rootDir, loadDir, loadSubDirectory, createFile, closeFile } = useFileSystem();
  const { openSettings } = useSettingsStore();
  const { paths: clipboardPaths, operation: clipboardOperation, copy, cut, clear: clearClipboard, pushUndo, popUndo, peekUndo, canUndo } = useClipboardStore();
  const [isCreating, setIsCreating] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [createInFolder, setCreateInFolder] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Undo confirmation dialog state
  const [undoDialogOpen, setUndoDialogOpen] = useState(false);
  const [pendingUndo, setPendingUndo] = useState<{
    type: 'copy' | 'move' | 'delete';
    sources: string[];
    destinations: string[];
  } | null>(null);
  const fileTreeRef = useRef<HTMLDivElement>(null);

  // Import dialog state
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importingFile, setImportingFile] = useState<FileNode | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Multi-select state
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const lastSelectedPathRef = useRef<string | null>(null);

  // Clear selection when workspace changes
  useEffect(() => {
    setSelectedPaths(new Set());
    setExpandedPaths(new Set());
    lastSelectedPathRef.current = null;
  }, [rootDir]);

  useEffect(() => {
    if (isCreating && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isCreating]);

  // Reload children of expanded folders when files change
  // This ensures expanded folders get fresh data after operations like paste/delete
  // Note: loadDir now preserves old children to prevent flash, but we still need
  // to reload to get any new/changed files
  const filesRefreshKeyRef = useRef<string>('');
  const isReloadingRef = useRef(false);
  useEffect(() => {
    // Track a refresh key based on top-level file paths to detect real refreshes
    const currentKey = files.map(f => f.path).join('|');
    const prevKey = filesRefreshKeyRef.current;

    // Skip if this is the same key (no actual change to top-level files)
    // or if we're already reloading (to prevent loops from loadSubDirectory updates)
    if (currentKey === prevKey || isReloadingRef.current) return;

    filesRefreshKeyRef.current = currentKey;

    // Only reload if this isn't the initial mount and we have expanded folders
    if (prevKey === '' || expandedPaths.size === 0) return;

    const reloadExpandedFolders = async () => {
      isReloadingRef.current = true;

      for (const expandedPath of expandedPaths) {
        // Check if this folder exists in the current files
        const findNode = (nodes: FileNode[], targetPath: string): FileNode | null => {
          for (const node of nodes) {
            if (node.path === targetPath) return node;
            if (node.children) {
              const found = findNode(node.children, targetPath);
              if (found) return found;
            }
          }
          return null;
        };

        const node = findNode(files, expandedPath);
        if (node && node.type === 'directory') {
          await loadSubDirectory(expandedPath);
        }
      }

      isReloadingRef.current = false;
    };

    reloadExpandedFolders();
  }, [files, expandedPaths, loadSubDirectory]);

  // Handle expanded state changes
  const handleExpandedChange = useCallback((path: string, isExpanded: boolean) => {
    setExpandedPaths(prev => {
      const next = new Set(prev);
      if (isExpanded) {
        next.add(path);
      } else {
        next.delete(path);
      }
      return next;
    });
  }, []);

  // Handle importable file click
  const handleImportableClick = useCallback((node: FileNode) => {
    setImportingFile(node);
    setImportError(null);
    setImportDialogOpen(true);
  }, []);

  // Handle import confirmation
  const handleImportConfirm = useCallback(async () => {
    if (!importingFile || !rootDir) return;

    setIsImporting(true);
    setImportError(null);

    try {
      // Currently only supporting .docx files
      if (importingFile.path.toLowerCase().endsWith('.docx')) {
        const result = await window.electronAPI.importDocxFromPath(importingFile.path);

        if (result.success && result.html && result.filename) {
          // Convert HTML to Tiptap JSON
          const tiptapDoc = htmlToTiptapJson(result.html);

          // Create a new .md file with the converted content
          const newFilePath = await createFile(result.filename, tiptapDoc);

          if (newFilePath) {
            // Refresh the file list
            await loadDir(rootDir);
          }

          // Success - close the dialog
          setIsImporting(false);
          setImportDialogOpen(false);
          setImportingFile(null);
        } else {
          // Show error in dialog
          setIsImporting(false);
          setImportError(result.error || 'Unknown error');
        }
      } else {
        // For other importable types (rtf, html), show a message
        setIsImporting(false);
        setImportError('Import not yet supported for this file type');
      }
    } catch (error) {
      console.error('Failed to import file:', error);
      setIsImporting(false);
      setImportError(String(error));
    }
  }, [importingFile, rootDir, createFile, loadDir]);

  // Handle selection with shift/meta key support
  const handleSelect = useCallback((path: string, shiftKey: boolean, metaKey: boolean) => {
    if (shiftKey && lastSelectedPathRef.current) {
      // Shift-click: select range
      const flatList = flattenFileTree(files, expandedPaths);
      const lastIndex = flatList.indexOf(lastSelectedPathRef.current);
      const currentIndex = flatList.indexOf(path);

      if (lastIndex !== -1 && currentIndex !== -1) {
        const start = Math.min(lastIndex, currentIndex);
        const end = Math.max(lastIndex, currentIndex);
        const range = flatList.slice(start, end + 1);

        setSelectedPaths(prev => {
          const next = new Set(prev);
          range.forEach(p => next.add(p));
          return next;
        });
      }
    } else if (metaKey) {
      // Cmd/Ctrl-click: toggle selection
      setSelectedPaths(prev => {
        const next = new Set(prev);
        if (next.has(path)) {
          next.delete(path);
        } else {
          next.add(path);
        }
        return next;
      });
      lastSelectedPathRef.current = path;
    } else {
      // Regular click: single selection
      setSelectedPaths(new Set([path]));
      lastSelectedPathRef.current = path;
    }
  }, [files, expandedPaths]);

  // Clear selection when clicking outside
  const handleBackgroundClick = useCallback(() => {
    setSelectedPaths(new Set());
    lastSelectedPathRef.current = null;
  }, []);

  // Helper to find node in file tree
  const findNode = useCallback((nodes: FileNode[], targetPath: string): FileNode | null => {
    for (const node of nodes) {
      if (node.path === targetPath) return node;
      if (node.children) {
        const found = findNode(node.children, targetPath);
        if (found) return found;
      }
    }
    return null;
  }, []);

  // Execute undo operation after confirmation
  const executeUndo = useCallback(async () => {
    if (!pendingUndo || !rootDir) return;

    // Pop the operation from the stack
    popUndo();

    if (pendingUndo.type === 'copy') {
      // Undo copy: delete the copied files
      for (const dest of pendingUndo.destinations) {
        await window.electronAPI.fileTrash(dest);
        closeFile(dest);
      }
    } else if (pendingUndo.type === 'move') {
      // Undo move: move files back to original locations
      for (let i = 0; i < pendingUndo.destinations.length; i++) {
        const dest = pendingUndo.destinations[i];
        const source = pendingUndo.sources[i];
        const sourceDir = source.substring(0, source.lastIndexOf('/'));
        await window.electronAPI.fileMoveTo([dest], sourceDir);
      }
    }
    // Note: delete undo is not supported (would need to restore from trash)

    await loadDir(rootDir);
    setPendingUndo(null);
    setUndoDialogOpen(false);
  }, [pendingUndo, rootDir, popUndo, closeFile, loadDir]);

  // Handle keyboard shortcuts for file operations
  const handleFileTreeKeyDown = useCallback(async (e: React.KeyboardEvent) => {
    const isMeta = e.metaKey || e.ctrlKey;

    // Undo - works even without selection
    if (isMeta && e.key === 'z') {
      e.preventDefault();
      if (!canUndo() || !rootDir) return;

      // Peek at the undo stack without modifying it
      const op = peekUndo();
      if (!op) return;

      // Show confirmation dialog
      setPendingUndo({ type: op.type, sources: op.sources, destinations: op.destinations });
      setUndoDialogOpen(true);
      return;
    }

    // Other shortcuts require selection
    if (selectedPaths.size === 0) return;

    if (isMeta && e.key === 'c') {
      // Copy
      e.preventDefault();
      copy(Array.from(selectedPaths));
    } else if (isMeta && e.key === 'x') {
      // Cut
      e.preventDefault();
      cut(Array.from(selectedPaths));
    } else if (isMeta && e.key === 'v') {
      // Paste
      e.preventDefault();
      if (clipboardPaths.length === 0 || !clipboardOperation || !rootDir) return;

      // Determine destination - use first selected path
      const firstSelected = Array.from(selectedPaths)[0];
      const targetNode = findNode(files, firstSelected);
      if (!targetNode) return;

      // If target is a folder, paste into it; otherwise paste into its parent
      const destDir = targetNode.type === 'directory'
        ? targetNode.path
        : targetNode.path.substring(0, targetNode.path.lastIndexOf('/'));

      if (clipboardOperation === 'copy') {
        const result = await window.electronAPI.fileCopyTo(clipboardPaths, destDir);
        if (result.success && result.results) {
          // Track for undo
          pushUndo({
            type: 'copy',
            sources: clipboardPaths,
            destinations: result.results.map(r => r.dest),
          });
          await loadDir(rootDir);
        }
      } else if (clipboardOperation === 'cut') {
        const result = await window.electronAPI.fileMoveTo(clipboardPaths, destDir);
        if (result.success && result.results) {
          // Track for undo
          pushUndo({
            type: 'move',
            sources: clipboardPaths,
            destinations: result.results.map(r => r.dest),
          });
          clipboardPaths.forEach(p => closeFile(p));
          clearClipboard();
          await loadDir(rootDir);
        }
      }
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      // Delete selected files
      e.preventDefault();
      if (!rootDir) return;

      const deletedPaths: string[] = [];
      for (const path of selectedPaths) {
        const result = await window.electronAPI.fileTrash(path);
        if (result.success) {
          closeFile(path);
          deletedPaths.push(path);
        }
      }

      // Track for undo (though restore from trash is not implemented)
      if (deletedPaths.length > 0) {
        pushUndo({
          type: 'delete',
          sources: deletedPaths,
          destinations: [],
        });
      }

      setSelectedPaths(new Set());
      await loadDir(rootDir);
    }
  }, [selectedPaths, clipboardPaths, clipboardOperation, rootDir, files, copy, cut, clearClipboard, closeFile, loadDir, findNode, canUndo, peekUndo, pushUndo]);

  const handleOpenFolder = async () => {
    const path = await window.electronAPI.selectDirectory();
    if (path) {
      await loadDir(path);
    }
  };

  const handleCreateDocument = async () => {
    if (!newFileName.trim()) {
      setIsCreating(false);
      setCreateInFolder(null);
      return;
    }

    const emptyDoc = {
      type: 'doc' as const,
      content: [{ type: 'paragraph', content: [] }],
    };

    // If creating in a specific folder, build the full path
    if (createInFolder && rootDir) {
      const separator = rootDir.includes('\\') ? '\\' : '/';
      const fileName = newFileName.trim().endsWith('.md') ? newFileName.trim() : `${newFileName.trim()}.md`;
      const filePath = `${createInFolder}${separator}${fileName}`;

      try {
        await window.electronAPI.workspaceSaveDocument(rootDir, filePath, emptyDoc, 'create');
        await loadDir(rootDir);
      } catch (error) {
        console.error('Failed to create file:', error);
      }
    } else {
      await createFile(newFileName.trim(), emptyDoc);
    }

    setNewFileName('');
    setIsCreating(false);
    setCreateInFolder(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreateDocument();
    } else if (e.key === 'Escape') {
      setNewFileName('');
      setIsCreating(false);
      setCreateInFolder(null);
    }
  };

  const handleCreateInFolder = (folderPath: string) => {
    setCreateInFolder(folderPath);
    setIsCreating(true);
  };

  return (
    <div className="w-64 border-r bg-muted/10 flex flex-col h-full">
      <div className="p-3 border-b flex items-center gap-2">
         <button
           onClick={handleOpenFolder}
           className="text-xs font-medium hover:bg-accent px-2 py-1 rounded flex-1 text-left truncate flex items-center gap-2"
           title={rootDir || "Select a folder"}
         >
           <FolderIcon size={16} className="shrink-0" />
           <span className="truncate">{rootDir ? rootDir.split('/').pop() : 'Open Workspace...'}</span>
         </button>
         {rootDir && (
           <button
             onClick={() => {
               setCreateInFolder(null);
               setIsCreating(true);
             }}
             className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
             title="New Document"
           >
             <Plus size={14} />
           </button>
         )}
      </div>

      {/* New file input */}
      {isCreating && (
        <div className="px-3 py-2 border-b">
          {createInFolder && (
            <div className="text-xs text-muted-foreground mb-1 truncate">
              In: {createInFolder.split(/[/\\]/).pop()}
            </div>
          )}
          <input
            ref={inputRef}
            type="text"
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleCreateDocument}
            placeholder="Document name..."
            className="w-full text-sm px-2 py-1 border rounded bg-background focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      )}

      <div
        ref={fileTreeRef}
        className="flex-1 overflow-auto py-2 focus:outline-none"
        onClick={handleBackgroundClick}
        onKeyDown={handleFileTreeKeyDown}
        tabIndex={0}
      >
        {files.map((file) => (
          <FileTreeItem
            key={file.path}
            node={file}
            onCreateInFolder={handleCreateInFolder}
            selectedPaths={selectedPaths}
            onSelect={handleSelect}
            onExpandedChange={handleExpandedChange}
            expandedPaths={expandedPaths}
            onClearSelection={handleBackgroundClick}
            onImportableClick={handleImportableClick}
          />
        ))}
        {files.length === 0 && rootDir && !isCreating && (
            <div className="text-center text-muted-foreground text-xs mt-4">
              Empty folder
              <br />
              <button
                onClick={() => setIsCreating(true)}
                className="mt-2 text-primary hover:underline"
              >
                Create a document
              </button>
            </div>
        )}
      </div>
      <div className="p-2 border-t">
        <button
            onClick={() => openSettings()}
            className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 px-2 py-1.5 rounded w-full transition-colors"
        >
            <Settings size={14} />
            <span>Settings</span>
        </button>
      </div>

      {/* Undo confirmation dialog */}
      <UndoConfirmDialog
        open={undoDialogOpen}
        onOpenChange={(open) => {
          setUndoDialogOpen(open);
          if (!open) {
            setPendingUndo(null);
            // Refocus file tree so keyboard shortcuts work again
            setTimeout(() => fileTreeRef.current?.focus(), 0);
          }
        }}
        onConfirm={executeUndo}
        fileName={pendingUndo?.destinations[0]?.split('/').pop() || ''}
        operationType={pendingUndo?.type || 'copy'}
      />

      {/* Import confirmation dialog */}
      <ImportConfirmDialog
        open={importDialogOpen}
        onOpenChange={(open) => {
          if (!isImporting) {
            setImportDialogOpen(open);
            if (!open) {
              setImportingFile(null);
              setImportError(null);
            }
          }
        }}
        onConfirm={handleImportConfirm}
        fileName={importingFile?.name || ''}
        isImporting={isImporting}
        error={importError}
      />
    </div>
  );
}
