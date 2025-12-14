import { useEditor, EditorContent, Editor as TiptapEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import FontFamily from '@tiptap/extension-font-family';
import { TextStyle } from '@tiptap/extension-text-style';
import { FontSize } from './extensions/FontSize';
import { ResizableImage } from './extensions/ResizableImage';
import { TextColor } from './extensions/TextColor';
import { TextHighlight } from './extensions/TextHighlight';
import { CustomCode } from './extensions/CustomCode';
import { Underline } from './extensions/Underline';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { ClickableHorizontalRule } from './extensions/ClickableHorizontalRule';
import { useEffect, useRef, useImperativeHandle, forwardRef, useState, useCallback } from 'react';
import { useFileSystem } from '../store/useFileSystem';
import { usePreferences } from '../store/usePreferences';
import { useAIStore } from '../store/useAIStore';
import { useAuthStore } from '../store/useAuthStore';
import { ImageWrapMenu } from './ImageWrapMenu';
import { RecoveryPrompt } from './RecoveryPrompt';
import { ExternalChangeDialog } from './ExternalChangeDialog';
import { InlineEditPrompt } from './InlineEditPrompt';
import { InlineDiffView } from './InlineDiffView';
import { useVersionStore } from '../store/useVersionStore';
import { PaginatedEditorView } from './PaginatedEditorView';
import { PAGE_HEIGHT, PAGE_GAP, PAGE_BREAKS_UPDATED_EVENT, PageBreak } from './extensions/PageSplitting';
import { toast } from '../store/useToastStore';

interface EditorProps {
  onEditorReady?: (editor: TiptapEditor | null) => void;
}

export interface EditorHandle {
  restoreContent: (content: any) => void;
  getCurrentContent: () => any;
}

export const Editor = forwardRef<EditorHandle, EditorProps>(function Editor(
  { onEditorReady },
  ref
) {
  const {
    activeFilePath,
    rootDir,
    editorContent,
    saveFile,
    setIsDirty,
    hasRecovery,
    recoveryTime,
    loadFromRecovery,
    discardRecovery,
    externalChange,
    setExternalChange,
    reloadFromDisk,
    keepCurrentVersion,
    closeFile,
  } = useFileSystem();
  const { loadVersions } = useVersionStore();
  const { pageMode } = usePreferences();
  const { isAuthenticated } = useAuthStore();
  const {
    inlineEditMode,
    inlineSelection,
    inlineResult,
    inlineLoading,
    startInlineEdit,
    submitInlineEdit,
    acceptInlineEdit,
    cancelInlineEdit,
  } = useAIStore();
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedJsonRef = useRef<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showScrollTooltip, setShowScrollTooltip] = useState(false);
  const [tooltipY, setTooltipY] = useState(0);

  // Inline editing state
  const [inlinePromptPosition, setInlinePromptPosition] = useState<{ top: number; left: number } | null>(null);
  const [showInlineResult, setShowInlineResult] = useState(false);

  // Listen for page break updates to get total pages
  useEffect(() => {
    const handlePageBreaksUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{ pageBreaks: PageBreak[]; totalHeight: number }>;
      setTotalPages(customEvent.detail.pageBreaks.length || 1);
    };

    window.addEventListener(PAGE_BREAKS_UPDATED_EVENT, handlePageBreaksUpdate);
    return () => {
      window.removeEventListener(PAGE_BREAKS_UPDATED_EVENT, handlePageBreaksUpdate);
    };
  }, []);

  // Handle scroll to calculate current page and show tooltip
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (pageMode !== 'paginated') return;

    const container = e.currentTarget;
    const scrollTop = container.scrollTop;
    const containerHeight = container.clientHeight;

    // Calculate which page is most visible
    // Each page takes PAGE_HEIGHT + PAGE_GAP pixels (except last page has no gap after it)
    const pageWithGap = PAGE_HEIGHT + PAGE_GAP;
    const padding = 32; // p-8 = 32px padding at top
    const adjustedScroll = scrollTop + containerHeight / 2 - padding;
    const page = Math.max(1, Math.min(totalPages, Math.floor(adjustedScroll / pageWithGap) + 1));

    setCurrentPage(page);

    // Calculate tooltip Y position (relative to viewport)
    const containerRect = container.getBoundingClientRect();
    const scrollbarHeight = containerRect.height;
    const scrollProgress = scrollTop / (container.scrollHeight - containerHeight || 1);
    const tooltipPosY = containerRect.top + scrollProgress * (scrollbarHeight - 40) + 20;
    setTooltipY(tooltipPosY);

    // Show tooltip
    setShowScrollTooltip(true);

    // Hide tooltip after scrolling stops
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      setShowScrollTooltip(false);
    }, 1000);
  }, [pageMode, totalPages]);

  // Cleanup scroll timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
        },
        code: false,
        heading: {
          levels: [1, 2, 3, 4, 5],
        },
        horizontalRule: false,
      }),
      ClickableHorizontalRule,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      TextStyle,
      FontFamily,
      FontSize,
      TextColor,
      TextHighlight,
      CustomCode.configure({
        HTMLAttributes: {
          class: 'bg-muted px-1.5 py-0.5 rounded text-sm font-mono',
        },
      }),
      ResizableImage.configure({
        allowBase64: true,
      }),
      Underline,
      Subscript,
      Superscript,
      // PageSplitting, // TEMPORARILY DISABLED FOR PERFORMANCE TESTING
    ],

    editorProps: {
      attributes: {
        class: 'prose prose-neutral dark:prose-invert focus:outline-none min-h-full',
      },
      handleDrop: (view, event, _slice, moved) => {
        if (!moved && event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length > 0) {
          const file = event.dataTransfer.files[0];
          if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (readerEvent) => {
              const base64 = readerEvent.target?.result;
              if (typeof base64 === 'string') {
                const { schema } = view.state;
                const coordinates = view.posAtCoords({ left: event.clientX, top: event.clientY });
                if (coordinates) {
                  const node = schema.nodes.image.create({ src: base64 });
                  const transaction = view.state.tr.insert(coordinates.pos, node);
                  view.dispatch(transaction);
                }
              }
            };
            reader.readAsDataURL(file);
            return true;
          }
        }
        return false;
      },
      handlePaste: (view, event) => {
        if (event.clipboardData && event.clipboardData.files && event.clipboardData.files.length > 0) {
          const file = event.clipboardData.files[0];
          if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (readerEvent) => {
              const base64 = readerEvent.target?.result;
              if (typeof base64 === 'string') {
                const { schema } = view.state;
                const node = schema.nodes.image.create({ src: base64 });
                const transaction = view.state.tr.replaceSelectionWith(node);
                view.dispatch(transaction);
              }
            };
            reader.readAsDataURL(file);
            return true;
          }
        }
        return false;
      }
    },

    onUpdate: ({ editor }) => {
      // Only update isDirty if it's not already true (avoid unnecessary re-renders)
      const currentIsDirty = useFileSystem.getState().isDirty;
      if (!currentIsDirty) {
        setIsDirty(true);
      }

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(() => {
        // Save Tiptap JSON directly
        const json = editor.getJSON();
        const jsonString = JSON.stringify(json);

        // Only save if content actually changed
        if (jsonString !== lastSavedJsonRef.current) {
          lastSavedJsonRef.current = jsonString;
          saveFile(json as any);
        }
      }, 1000);
    },
  });

  // Cmd+K keyboard handler for inline AI editing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();

        if (!editor) return;

        // Check if user is authenticated
        if (!isAuthenticated) {
          toast.error('Sign in to use AI editing');
          return;
        }

        // Get selection
        const { from, to } = editor.state.selection;
        if (from === to) {
          toast.info('Select some text to edit with AI');
          return;
        }

        // Get selected text
        const selectedText = editor.state.doc.textBetween(from, to, ' ');
        if (!selectedText.trim()) {
          toast.info('Select some text to edit with AI');
          return;
        }

        // Get selection coordinates for positioning the popup
        const coords = editor.view.coordsAtPos(from);
        setInlinePromptPosition({
          top: coords.bottom + 8,
          left: coords.left,
        });

        // Start inline edit mode
        startInlineEdit({ from, to, text: selectedText });
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [editor, isAuthenticated, startInlineEdit]);

  // Handle inline edit prompt submission
  const handleInlineEditSubmit = useCallback(async (prompt: string) => {
    try {
      await submitInlineEdit(prompt);
      setShowInlineResult(true);
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate edit');
      cancelInlineEdit();
      setInlinePromptPosition(null);
    }
  }, [submitInlineEdit, cancelInlineEdit]);

  // Handle accepting the inline edit
  const handleAcceptInlineEdit = useCallback(() => {
    if (!editor || !inlineSelection || !inlineResult) return;

    // Replace the selected text with the AI result
    editor
      .chain()
      .focus()
      .setTextSelection({ from: inlineSelection.from, to: inlineSelection.to })
      .insertContent(inlineResult)
      .run();

    // Clean up
    acceptInlineEdit();
    setInlinePromptPosition(null);
    setShowInlineResult(false);
    toast.success('Edit applied');
  }, [editor, inlineSelection, inlineResult, acceptInlineEdit]);

  // Handle rejecting the inline edit
  const handleRejectInlineEdit = useCallback(() => {
    cancelInlineEdit();
    setInlinePromptPosition(null);
    setShowInlineResult(false);
  }, [cancelInlineEdit]);

  // Handle retrying with a new prompt
  const handleRetryInlineEdit = useCallback(() => {
    setShowInlineResult(false);
    // Keep the selection but go back to prompt mode
  }, []);

  // Cancel inline edit when clicking away
  const handleCancelInlinePrompt = useCallback(() => {
    if (!showInlineResult) {
      cancelInlineEdit();
      setInlinePromptPosition(null);
    }
  }, [showInlineResult, cancelInlineEdit]);

  // Notify parent when editor is ready
  useEffect(() => {
    onEditorReady?.(editor);
  }, [editor, onEditorReady]);

  // Load editor content when it changes
  useEffect(() => {
    if (editor && activeFilePath && editorContent) {
      // Compare JSON to prevent unnecessary updates
      const currentJson = JSON.stringify(editor.getJSON());
      const newJson = JSON.stringify(editorContent);

      if (currentJson !== newJson) {
        // Defer setContent to avoid flushSync warning during React render cycle
        queueMicrotask(() => {
          editor.commands.setContent(editorContent);
          lastSavedJsonRef.current = newJson;
        });
      }
    }
  }, [activeFilePath, editorContent, editor]);

  // Listen for external insert events (e.g. Import DOCX)
  useEffect(() => {
    const handleInsert = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (editor && detail) {
        editor.commands.insertContent(detail);
      }
    };
    window.addEventListener('editor:insert-content', handleInsert);
    return () => window.removeEventListener('editor:insert-content', handleInsert);
  }, [editor]);

  // Listen for export requests
  useEffect(() => {
    const handleExport = async () => {
      if (editor) {
        const json = editor.getJSON();
        await window.electronAPI.exportDocx(json);
      }
    };
    window.addEventListener('editor:export-request', handleExport);
    return () => window.removeEventListener('editor:export-request', handleExport);
  }, [editor]);

  // Listen for external file changes
  useEffect(() => {
    const unsubscribe = window.electronAPI.onFileChangedExternally((event) => {
      // Only show dialog if the changed file is currently open
      if (activeFilePath && rootDir) {
        // Get relative path from active file
        const activeRelativePath = activeFilePath.startsWith(rootDir)
          ? activeFilePath.slice(rootDir.length + 1)
          : activeFilePath;

        if (event.fileKey === activeRelativePath || event.absolutePath === activeFilePath) {
          setExternalChange({
            type: event.type,
            fileKey: event.fileKey,
            timestamp: event.timestamp,
          });
        }
      }
    });

    return unsubscribe;
  }, [activeFilePath, rootDir, setExternalChange]);

  // Expose methods to parent via ref - must be called before any early returns
  useImperativeHandle(ref, () => ({
    restoreContent: (content: any) => {
      if (editor && content) {
        editor.commands.setContent(content);
        setIsDirty(true);
        // Refresh history after restore
        if (rootDir && activeFilePath) {
          loadVersions(rootDir, activeFilePath);
        }
      }
    },
    getCurrentContent: () => {
      if (editor) {
        return editor.getJSON();
      }
      return null;
    },
  }), [editor, rootDir, activeFilePath, setIsDirty, loadVersions]);

  // Handle closing file when it's deleted externally
  const handleCloseDeletedFile = () => {
    setExternalChange(null);
    if (activeFilePath) {
      closeFile(activeFilePath);
    }
  };

  if (!activeFilePath) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        Select a file to edit
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-canvas">
      {editor && (
        <ImageWrapMenu editor={editor} />
      )}

      {/* Inline AI Edit Prompt */}
      {inlineEditMode && inlinePromptPosition && inlineSelection && !showInlineResult && (
        <InlineEditPrompt
          position={inlinePromptPosition}
          selectedText={inlineSelection.text}
          onSubmit={handleInlineEditSubmit}
          onCancel={handleCancelInlinePrompt}
          isLoading={inlineLoading}
        />
      )}

      {/* Inline AI Edit Result (Diff View) */}
      {inlineEditMode && inlinePromptPosition && inlineSelection && showInlineResult && inlineResult && (
        <InlineDiffView
          position={inlinePromptPosition}
          originalText={inlineSelection.text}
          modifiedText={inlineResult}
          onAccept={handleAcceptInlineEdit}
          onReject={handleRejectInlineEdit}
          onRetry={handleRetryInlineEdit}
        />
      )}

      {/* Recovery prompt */}
      {hasRecovery && activeFilePath && (
        <RecoveryPrompt
          filePath={activeFilePath}
          recoveryTime={recoveryTime}
          onRecover={() => loadFromRecovery(activeFilePath)}
          onDiscard={() => discardRecovery(activeFilePath)}
        />
      )}

      {/* Canvas area - mode depends on pageMode setting */}
      {pageMode === 'continuous' ? (
        // Continuous mode: single scrolling document, no page breaks
        <div className="flex-1 relative">
          <div className="absolute inset-0 overflow-auto p-8">
            <div
              className="continuous-editor-container"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                minWidth: 'fit-content',
              }}
            >
              {/* Page container - matches page-container in paginated mode */}
              <div
                className="continuous-page"
                style={{
                  width: '816px',
                  minHeight: '1056px',
                  backgroundColor: 'hsl(var(--background))',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
                  borderRadius: '6px',
                  padding: '48px',
                  boxSizing: 'border-box',
                  flexShrink: 0,
                  contain: 'layout style paint',
                }}
              >
                <EditorContent editor={editor} className="editor-continuous" />
              </div>
            </div>
          </div>
        </div>
      ) : (
        // Paginated mode: visual page breaks like Word/Google Docs
        <div className="flex-1 relative">
          <div
            ref={scrollContainerRef}
            className="absolute inset-0 overflow-auto p-8"
            onScroll={handleScroll}
          >
            <PaginatedEditorView editor={editor} />
          </div>

          {/* Scroll page tooltip */}
          {showScrollTooltip && totalPages > 1 && (
            <div
              className="fixed z-50 pointer-events-none"
              style={{
                right: '18px',
                top: `${tooltipY}px`,
                transform: 'translateY(-50%)',
              }}
            >
              <div className="bg-neutral-800 text-white text-sm px-3 py-1.5 rounded-md shadow-lg whitespace-nowrap">
                {currentPage} of {totalPages}
              </div>
            </div>
          )}
        </div>
      )}

      {/* External change dialog */}
      {externalChange && (
        <ExternalChangeDialog
          fileKey={externalChange.fileKey}
          changeType={externalChange.type}
          timestamp={externalChange.timestamp}
          onReload={reloadFromDisk}
          onKeep={keepCurrentVersion}
          onDismiss={externalChange.type === 'unlink' ? handleCloseDeletedFile : keepCurrentVersion}
        />
      )}
    </div>
  );
});
