import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import FontFamily from '@tiptap/extension-font-family';
import { TextStyle } from '@tiptap/extension-text-style';
import { FontSize } from './extensions/FontSize';
import { ResizableImage } from './extensions/ResizableImage';
import { TextColor } from './extensions/TextColor';
import { TextHighlight } from './extensions/TextHighlight';
import { CustomCode } from './extensions/CustomCode';
import { useEffect, useRef } from 'react';
import { useFileSystem } from '../store/useFileSystem';
import { EditorToolbar } from './EditorToolbar';
import { ImageWrapMenu } from './ImageWrapMenu';
import { RecoveryPrompt } from './RecoveryPrompt';
import { ExternalChangeDialog } from './ExternalChangeDialog';
import { HistoryPanel } from './HistoryPanel';
import { DraftPanel } from './DraftPanel';
import { useHistoryStore } from '../store/useHistoryStore';
import { useDraftStore } from '../store/useDraftStore';

export function Editor() {
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
  const { isOpen: isHistoryOpen, loadCheckpoints } = useHistoryStore();
  const {
    isOpen: isDraftsOpen,
    activeDraftId,
    activeDraft,
    saveDraftContent,
    closeDraft,
  } = useDraftStore();
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedJsonRef = useRef<string | null>(null);

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
          levels: [1, 2, 3],
        },
      }),
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
    ],

    editorProps: {
      attributes: {
        class: 'prose prose-neutral dark:prose-invert mx-auto focus:outline-none min-h-full max-w-3xl pt-8 pb-32',
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
      setIsDirty(true);

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

          // Save to draft if editing a draft, otherwise save to main file
          if (activeDraftId && rootDir && activeFilePath) {
            saveDraftContent(rootDir, activeFilePath, json as any);
          } else {
            saveFile(json as any);
          }
        }
      }, 1000);
    },
  });

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

  // Handle restoring content from history
  const handleRestoreContent = (content: any) => {
    if (editor && content) {
      editor.commands.setContent(content);
      setIsDirty(true);
      // Refresh history after restore
      if (rootDir && activeFilePath) {
        loadCheckpoints(rootDir, activeFilePath);
      }
    }
  };

  // Handle switching to a draft
  const handleSwitchToDraft = (content: any) => {
    if (editor && content) {
      queueMicrotask(() => {
        editor.commands.setContent(content);
        lastSavedJsonRef.current = JSON.stringify(content);
      });
    }
  };

  // Handle switching back to main document
  const handleSwitchToMain = async () => {
    closeDraft();
    // Reload main document content
    if (rootDir && activeFilePath) {
      try {
        const result = await window.electronAPI.workspaceLoadDocument(rootDir, activeFilePath);
        if (result.success && result.json && editor) {
          queueMicrotask(() => {
            editor.commands.setContent(result.json);
            lastSavedJsonRef.current = JSON.stringify(result.json);
          });
        }
      } catch (error) {
        console.error('Failed to reload main document:', error);
      }
    }
  };

  // Get current editor content (for creating drafts)
  const getCurrentContent = () => {
    if (editor) {
      return editor.getJSON();
    }
    return null;
  };

  return (
    <div className="flex-1 flex h-full overflow-hidden">
      {/* Main editor area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {editor && (
          <ImageWrapMenu editor={editor} />
        )}

        <EditorToolbar editor={editor} />

        {/* Draft mode indicator */}
        {activeDraft && (
          <div className="px-4 py-2 bg-purple-500/10 border-b border-purple-500/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-purple-600">
                Editing draft: {activeDraft.name}
              </span>
              <span className="text-xs text-muted-foreground">
                Changes are saved to this draft, not the main document.
              </span>
            </div>
            <button
              onClick={handleSwitchToMain}
              className="text-xs px-2 py-1 rounded border border-purple-500/30 text-purple-600 hover:bg-purple-500/10"
            >
              Exit Draft
            </button>
          </div>
        )}

        {/* Recovery prompt */}
        {hasRecovery && activeFilePath && !activeDraft && (
          <RecoveryPrompt
            filePath={activeFilePath}
            recoveryTime={recoveryTime}
            onRecover={() => loadFromRecovery(activeFilePath)}
            onDiscard={() => discardRecovery(activeFilePath)}
          />
        )}

        <div className="flex-1 overflow-y-auto bg-background p-4">
          <EditorContent editor={editor} className="min-h-full" />
        </div>

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

      {/* History panel */}
      {isHistoryOpen && (
        <HistoryPanel onRestoreContent={handleRestoreContent} />
      )}

      {/* Drafts panel */}
      {isDraftsOpen && (
        <DraftPanel
          onSwitchToDraft={handleSwitchToDraft}
          onSwitchToMain={handleSwitchToMain}
          getCurrentContent={getCurrentContent}
        />
      )}
    </div>
  );
}
