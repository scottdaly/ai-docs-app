import { FileNode } from '../shared/types';
import { useFileSystem } from '../store/useFileSystem';
import { useClipboardStore } from '../store/useClipboardStore';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuTrigger,
} from './ui/context-menu';
import {
  FileText,
  FolderPlus,
  Pencil,
  Copy,
  Trash2,
  FolderOpen,
  Clipboard,
  ClipboardPaste,
  Scissors,
  Code,
} from 'lucide-react';

interface FileContextMenuProps {
  node: FileNode;
  children: React.ReactNode;
  onRename: () => void;
  onNewDocument?: () => void;
  onNewFolder?: () => void;
  selectedPaths?: Set<string>;
  onClearSelection?: () => void;
}

export function FileContextMenu({
  node,
  children,
  onRename,
  onNewDocument,
  onNewFolder,
  selectedPaths,
  onClearSelection,
}: FileContextMenuProps) {
  const { openFile, closeFile, loadDir, rootDir, reopenFileAs, openFiles } = useFileSystem();
  const { paths: clipboardPaths, operation: clipboardOperation, copy, cut, clear: clearClipboard, pushUndo } = useClipboardStore();

  const isFile = node.type === 'file';
  const isFolder = node.type === 'directory';
  const isSvg = isFile && node.path.toLowerCase().endsWith('.svg');

  // Check if multiple items are selected AND current node is in the selection
  const hasMultipleSelection = selectedPaths && selectedPaths.size > 1 && selectedPaths.has(node.path);
  const selectionCount = selectedPaths?.size || 0;

  // Check if clipboard has items to paste
  const canPaste = clipboardPaths.length > 0 && clipboardOperation !== null;

  const handleOpen = async () => {
    if (isFile) {
      await openFile(node);
    }
  };

  const handleOpenAsCode = async () => {
    if (!isFile) return;

    // Check if file is already open
    const alreadyOpen = openFiles.find(f => f.path === node.path);

    if (alreadyOpen) {
      // Use reopenFileAs to update the category and reload content
      await reopenFileAs(node.path, 'compatible');
    } else {
      // Open the file as text/code by passing a modified node
      await openFile({ ...node, category: 'compatible' });
    }
  };

  const handleDuplicate = async () => {
    if (!isFile) return;
    const result = await window.electronAPI.fileDuplicate(node.path);
    if (result.success && rootDir) {
      // Refresh the file tree
      await loadDir(rootDir);
    }
  };

  const handleTrash = async () => {
    const result = await window.electronAPI.fileTrash(node.path);
    if (result.success) {
      // Close the file if it was open
      if (isFile) {
        closeFile(node.path);
      }
      // Refresh the file tree
      if (rootDir) {
        await loadDir(rootDir);
      }
    }
  };

  const handleBulkDuplicate = async () => {
    if (!selectedPaths || selectedPaths.size === 0) return;

    // Only duplicate files, not folders
    const pathsToDuplicate = Array.from(selectedPaths);
    let anySuccess = false;

    for (const path of pathsToDuplicate) {
      // Skip directories - check if path doesn't end with common file extensions
      const result = await window.electronAPI.fileDuplicate(path);
      if (result.success) {
        anySuccess = true;
      }
    }

    // Clear selection and refresh
    if (anySuccess) {
      onClearSelection?.();
      if (rootDir) {
        await loadDir(rootDir);
      }
    }
  };

  const handleBulkTrash = async () => {
    if (!selectedPaths || selectedPaths.size === 0) return;

    // Delete all selected items
    const pathsToDelete = Array.from(selectedPaths);
    let anySuccess = false;

    for (const path of pathsToDelete) {
      const result = await window.electronAPI.fileTrash(path);
      if (result.success) {
        anySuccess = true;
        // Close the file if it was open (check by extension if it's a file)
        if (!path.endsWith('/')) {
          closeFile(path);
        }
      }
    }

    // Clear selection and refresh
    if (anySuccess) {
      onClearSelection?.();
      if (rootDir) {
        await loadDir(rootDir);
      }
    }
  };

  const handleRevealInFinder = async () => {
    await window.electronAPI.fileRevealInFinder(node.path);
  };

  const handleCopyPath = async () => {
    await window.electronAPI.fileCopyPath(node.path);
  };

  // Copy single item to clipboard
  const handleCopy = () => {
    copy([node.path]);
  };

  // Cut single item to clipboard
  const handleCut = () => {
    cut([node.path]);
  };

  // Copy multiple selected items to clipboard
  const handleBulkCopy = () => {
    if (selectedPaths && selectedPaths.size > 0) {
      copy(Array.from(selectedPaths));
    }
  };

  // Cut multiple selected items to clipboard
  const handleBulkCut = () => {
    if (selectedPaths && selectedPaths.size > 0) {
      cut(Array.from(selectedPaths));
    }
  };

  // Paste items from clipboard
  const handlePaste = async () => {
    if (!canPaste || !rootDir) return;

    // Determine destination directory
    const destDir = isFolder ? node.path : node.path.substring(0, node.path.lastIndexOf('/'));

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
        // Close any files that were moved
        clipboardPaths.forEach(p => closeFile(p));
        // Clear clipboard after successful cut
        clearClipboard();
        await loadDir(rootDir);
      }
    }
  };

  // Show bulk menu when multiple items are selected
  if (hasMultipleSelection) {
    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent className="w-56">
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            {selectionCount} items selected
          </div>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={handleBulkCopy}>
            <Copy className="mr-2 h-4 w-4" />
            Copy {selectionCount} Items
            <ContextMenuShortcut>⌘C</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onClick={handleBulkCut}>
            <Scissors className="mr-2 h-4 w-4" />
            Cut {selectionCount} Items
            <ContextMenuShortcut>⌘X</ContextMenuShortcut>
          </ContextMenuItem>
          <ContextMenuItem onClick={handleBulkDuplicate}>
            <Copy className="mr-2 h-4 w-4" />
            Duplicate {selectionCount} Items
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={handleBulkTrash}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete {selectionCount} Items
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
    );
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        {isFile && (
          <>
            <ContextMenuItem onClick={handleOpen}>
              <FileText className="mr-2 h-4 w-4" />
              Open
              <ContextMenuShortcut>Enter</ContextMenuShortcut>
            </ContextMenuItem>
            {isSvg && (
              <ContextMenuItem onClick={handleOpenAsCode}>
                <Code className="mr-2 h-4 w-4" />
                Open as Code
              </ContextMenuItem>
            )}
            <ContextMenuSeparator />
          </>
        )}

        {isFolder && (
          <>
            {onNewDocument && (
              <ContextMenuItem onClick={onNewDocument}>
                <FileText className="mr-2 h-4 w-4" />
                New Document
              </ContextMenuItem>
            )}
            {onNewFolder && (
              <ContextMenuItem onClick={onNewFolder}>
                <FolderPlus className="mr-2 h-4 w-4" />
                New Folder
              </ContextMenuItem>
            )}
            {(onNewDocument || onNewFolder) && <ContextMenuSeparator />}
          </>
        )}

        <ContextMenuItem onClick={handleCopy}>
          <Copy className="mr-2 h-4 w-4" />
          Copy
          <ContextMenuShortcut>⌘C</ContextMenuShortcut>
        </ContextMenuItem>

        <ContextMenuItem onClick={handleCut}>
          <Scissors className="mr-2 h-4 w-4" />
          Cut
          <ContextMenuShortcut>⌘X</ContextMenuShortcut>
        </ContextMenuItem>

        {canPaste && (
          <ContextMenuItem onClick={handlePaste}>
            <ClipboardPaste className="mr-2 h-4 w-4" />
            Paste
            <ContextMenuShortcut>⌘V</ContextMenuShortcut>
          </ContextMenuItem>
        )}

        <ContextMenuSeparator />

        <ContextMenuItem onClick={onRename}>
          <Pencil className="mr-2 h-4 w-4" />
          Rename
          <ContextMenuShortcut>F2</ContextMenuShortcut>
        </ContextMenuItem>

        {isFile && (
          <ContextMenuItem onClick={handleDuplicate}>
            <Copy className="mr-2 h-4 w-4" />
            Duplicate
          </ContextMenuItem>
        )}

        <ContextMenuSeparator />

        <ContextMenuItem onClick={handleCopyPath}>
          <Clipboard className="mr-2 h-4 w-4" />
          Copy Path
        </ContextMenuItem>

        <ContextMenuItem onClick={handleRevealInFinder}>
          <FolderOpen className="mr-2 h-4 w-4" />
          Reveal in Finder
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem
          onClick={handleTrash}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
          <ContextMenuShortcut>Del</ContextMenuShortcut>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
