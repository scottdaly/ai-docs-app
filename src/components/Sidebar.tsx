import { RiArrowRightSLine, RiArrowDownSLine, RiSettings3Line, RiAddLine } from '@remixicon/react';
import { MidlightFileIcon } from './icons/MidlightFileIcon';
import { ImportableFileIcon } from './icons/ImportableFileIcon';
import { FolderIcon } from './icons/FolderIcon';
import { useFileSystem } from '../store/useFileSystem';
import { useSettingsStore } from '../store/useSettingsStore';
import { useClipboardStore } from '../store/useClipboardStore';
import { usePreferences } from '../store/usePreferences';
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
  showUnsupportedFiles: boolean;
  pendingRenamePath?: string | null;
  onPendingRenameHandled?: () => void;
}

function FileTreeItem({ node, level = 0, onCreateInFolder, selectedPaths, onSelect, onExpandedChange, expandedPaths, onClearSelection, onImportableClick, showUnsupportedFiles, pendingRenamePath, onPendingRenameHandled }: FileTreeItemProps) {
  const isOpen = expandedPaths.has(node.path);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(node.name);
  const [renameError, setRenameError] = useState<string | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const isRenamingRef = useRef(false); // Track renaming state synchronously
  const justStartedRenamingRef = useRef(false); // Ignore blurs right after starting rename
  const { loadSubDirectory, openFile, activeFilePath, renameFile, rootDir, loadDir, files } = useFileSystem();
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
          // Select all text (extension is already stripped)
          renameInputRef.current.select();
          initialFocusDoneRef.current = true;
          // NOTE: Don't clear justStartedRenamingRef here - clear it on first user interaction
        }
      }, 50);
      return () => clearTimeout(timeoutId);
    } else if (!isRenaming) {
      initialFocusDoneRef.current = false;
      justStartedRenamingRef.current = false;
    }
  }, [isRenaming]);

  // Auto-enter rename mode when this is the pending rename target
  useEffect(() => {
    if (pendingRenamePath === node.path && !isRenaming) {
      isRenamingRef.current = true;
      // Strip .md extension for files when showing rename input
      const nameWithoutExt = node.type === 'file' && node.name.toLowerCase().endsWith('.md')
        ? node.name.slice(0, -3)
        : node.name;
      setRenameValue(nameWithoutExt);
      setIsRenaming(true);
      onPendingRenameHandled?.();
    }
  }, [pendingRenamePath, node.path, isRenaming, node.name, node.type, onPendingRenameHandled]);

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
            // Don't open unsupported files
            if (node.category === 'unsupported') {
                return;
            }
            // For importable files (docx, rtf, html, pdf), show import dialog instead
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
    justStartedRenamingRef.current = true; // Ignore blurs until focus is established
    // Strip .md extension for files when showing rename input
    const nameWithoutExt = node.type === 'file' && node.name.toLowerCase().endsWith('.md')
      ? node.name.slice(0, -3)
      : node.name;
    setRenameValue(nameWithoutExt);
    setIsRenaming(true);
  };

  // Helper to find sibling files in the same directory
  const getSiblingNames = useCallback((): Set<string> => {
    const parentPath = node.path.substring(0, node.path.lastIndexOf('/'));
    const siblingNames = new Set<string>();

    // Find the parent directory in the file tree
    const findSiblings = (nodes: FileNode[], targetParentPath: string): FileNode[] | null => {
      // Check if we're at root level
      if (targetParentPath === rootDir) {
        return nodes;
      }

      for (const n of nodes) {
        if (n.path === targetParentPath && n.children) {
          return n.children;
        }
        if (n.children) {
          const found = findSiblings(n.children, targetParentPath);
          if (found) return found;
        }
      }
      return null;
    };

    const siblings = parentPath === rootDir ? files : findSiblings(files, parentPath);
    if (siblings) {
      siblings.forEach(s => {
        if (s.path !== node.path) {
          siblingNames.add(s.name.toLowerCase());
        }
      });
    }

    return siblingNames;
  }, [node.path, files, rootDir]);

  const handleRenameSubmit = async () => {
    if (!isRenamingRef.current) return; // Already submitted

    const trimmedValue = renameValue.trim();
    const isMarkdownFile = node.type === 'file' && node.name.toLowerCase().endsWith('.md');

    // Get original extension for non-markdown files
    const originalExt = node.type === 'file' && !isMarkdownFile
      ? (node.name.includes('.') ? node.name.slice(node.name.lastIndexOf('.')) : '')
      : '';

    // Get the original name without extension for comparison
    const originalNameWithoutExt = isMarkdownFile
      ? node.name.slice(0, -3)
      : (originalExt ? node.name.slice(0, -originalExt.length) : node.name);

    // If empty or unchanged, just close the rename input (keep original name)
    if (!trimmedValue || trimmedValue === originalNameWithoutExt) {
      isRenamingRef.current = false;
      setIsRenaming(false);
      setRenameError(null);
      return;
    }

    // Determine final name with proper extension
    let finalName: string;
    if (isMarkdownFile) {
      // For markdown files, ensure .md extension
      finalName = trimmedValue.toLowerCase().endsWith('.md') ? trimmedValue : `${trimmedValue}.md`;
    } else if (originalExt) {
      // For other files with extensions, preserve original extension if user didn't provide one
      const hasExtension = trimmedValue.includes('.');
      finalName = hasExtension ? trimmedValue : `${trimmedValue}${originalExt}`;
    } else {
      // For files without extensions, use as-is
      finalName = trimmedValue;
    }

    // Check for naming conflicts (case-insensitive)
    const siblingNames = getSiblingNames();
    if (siblingNames.has(finalName.toLowerCase())) {
      setRenameError('A file with this name already exists');
      // Keep input open so user can fix it
      return;
    }

    isRenamingRef.current = false;
    setRenameError(null);
    await renameFile(node.path, finalName);
    setIsRenaming(false);
  };

  // Check if a name would conflict with siblings
  const hasNamingConflict = useCallback((name: string): boolean => {
    const isMarkdownFile = node.type === 'file' && node.name.toLowerCase().endsWith('.md');

    // Get original extension for non-markdown files
    const originalExt = node.type === 'file' && !isMarkdownFile
      ? (node.name.includes('.') ? node.name.slice(node.name.lastIndexOf('.')) : '')
      : '';

    // Determine final name with proper extension
    let finalName: string;
    if (isMarkdownFile) {
      finalName = name.toLowerCase().endsWith('.md') ? name : `${name}.md`;
    } else if (originalExt) {
      const hasExtension = name.includes('.');
      finalName = hasExtension ? name : `${name}${originalExt}`;
    } else {
      finalName = name;
    }

    const siblingNames = getSiblingNames();
    return siblingNames.has(finalName.toLowerCase());
  }, [node.type, node.name, getSiblingNames]);

  const handleBlur = (e: React.FocusEvent) => {
    // Ignore blurs that happen right after starting rename (context menu closing)
    // and refocus the input since blur already moved focus elsewhere
    if (justStartedRenamingRef.current) {
      setTimeout(() => {
        if (renameInputRef.current && isRenamingRef.current) {
          renameInputRef.current.focus();
        }
      }, 0);
      return;
    }

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
        const trimmedValue = renameValue.trim();

        // Get the original name without extension for comparison
        const originalNameWithoutExt = node.type === 'file' && node.name.toLowerCase().endsWith('.md')
          ? node.name.slice(0, -3)
          : node.name;

        // If there's a conflict on blur, just revert to original name
        if (trimmedValue && trimmedValue !== originalNameWithoutExt && hasNamingConflict(trimmedValue)) {
          isRenamingRef.current = false;
          setIsRenaming(false);
          setRenameError(null);
          setRenameValue(originalNameWithoutExt);
          return;
        }

        handleRenameSubmit();
      }
    }, 100);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    // User is interacting, clear the "just started" protection
    justStartedRenamingRef.current = false;

    if (e.key === 'Enter') {
      handleRenameSubmit();
    } else if (e.key === 'Escape') {
      isRenamingRef.current = false;
      setIsRenaming(false);
      setRenameError(null);
      // Reset to name without extension
      const nameWithoutExt = node.type === 'file' && node.name.toLowerCase().endsWith('.md')
        ? node.name.slice(0, -3)
        : node.name;
      setRenameValue(nameWithoutExt);
    }
  };

  const handleRenameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // User is interacting, clear the "just started" protection
    justStartedRenamingRef.current = false;
    setRenameValue(e.target.value);
    // Clear error when user starts typing
    if (renameError) {
      setRenameError(null);
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
              isOpen ? <RiArrowDownSLine size={14} /> : <RiArrowRightSLine size={14} />
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
        <div className="flex-1 min-w-0 relative">
          <input
            ref={renameInputRef}
            type="text"
            value={renameValue}
            onChange={handleRenameChange}
            onBlur={handleBlur}
            onKeyDown={handleRenameKeyDown}
            onClick={(e) => e.stopPropagation()}
            className={`w-full bg-background border rounded px-1 py-0.5 text-sm focus:outline-none focus:ring-1 ${
              renameError
                ? 'border-destructive focus:ring-destructive'
                : 'border-border focus:ring-primary'
            }`}
            title={renameError || undefined}
          />
          {renameError && (
            <div className="absolute left-0 top-full mt-1 px-2 py-1 text-xs bg-destructive text-destructive-foreground rounded shadow-lg z-50 whitespace-nowrap">
              {renameError}
            </div>
          )}
        </div>
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
          {node.children
            .filter((child) => showUnsupportedFiles || child.type === 'directory' || child.category !== 'unsupported')
            .map((child) => (
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
              showUnsupportedFiles={showUnsupportedFiles}
              pendingRenamePath={pendingRenamePath}
              onPendingRenameHandled={onPendingRenameHandled}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const { files, rootDir, loadDir, loadSubDirectory, createFile, closeFile, pendingRenamePath, clearPendingRenamePath } = useFileSystem();
  const { openSettings } = useSettingsStore();
  const { paths: clipboardPaths, operation: clipboardOperation, copy, cut, clear: clearClipboard, pushUndo, popUndo, peekUndo, canUndo } = useClipboardStore();
  const { showUnsupportedFiles } = usePreferences();

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
      const lowerPath = importingFile.path.toLowerCase();

      // Handle DOCX files
      if (lowerPath.endsWith('.docx')) {
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
      } else if (lowerPath.endsWith('.pdf')) {
        // PDF import not yet supported
        setIsImporting(false);
        setImportError('PDF import is not yet supported. Coming soon!');
      } else {
        // For other importable types (rtf, html, odt), show a message
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

  // Create a new document and trigger inline rename
  const handleCreateDocument = useCallback(async (folderPath?: string) => {
    const emptyDoc = {
      type: 'doc' as const,
      content: [{ type: 'paragraph', content: [] }],
    };

    // Create file with triggerRename=true to auto-enter rename mode
    await createFile('Untitled', emptyDoc, folderPath, true);

    // If creating in a folder, expand it to show the new file
    if (folderPath && !expandedPaths.has(folderPath)) {
      await loadSubDirectory(folderPath);
      setExpandedPaths(prev => new Set([...prev, folderPath]));
    }
  }, [createFile, expandedPaths, loadSubDirectory]);

  // Handler for creating in a specific folder (from context menu)
  const handleCreateInFolder = useCallback((folderPath: string) => {
    handleCreateDocument(folderPath);
  }, [handleCreateDocument]);

  return (
    <div className="w-64 h-full flex-shrink-0 border-r border-border">
      <div className="flex flex-col h-full bg-background overflow-hidden">
        <div className="p-3 flex items-center gap-2">
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
               onClick={() => handleCreateDocument()}
               className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
               title="New Document"
             >
               <RiAddLine size={14} />
             </button>
           )}
        </div>

        <div
          ref={fileTreeRef}
          className="flex-1 overflow-auto py-2 focus:outline-none"
          onClick={handleBackgroundClick}
          onKeyDown={handleFileTreeKeyDown}
          tabIndex={0}
        >
          {files
            .filter((file) => showUnsupportedFiles || file.type === 'directory' || file.category !== 'unsupported')
            .map((file) => (
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
              showUnsupportedFiles={showUnsupportedFiles}
              pendingRenamePath={pendingRenamePath}
              onPendingRenameHandled={clearPendingRenamePath}
            />
          ))}
          {files.length === 0 && rootDir && (
              <div className="text-center text-muted-foreground text-xs mt-4">
                Empty folder
                <br />
                <button
                  onClick={() => handleCreateDocument()}
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
              <RiSettings3Line size={18} />
              <span>Settings</span>
          </button>
        </div>
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
