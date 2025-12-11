import { TitleBar } from './components/TitleBar'
import { Sidebar } from './components/Sidebar'
import { Editor } from './components/Editor'
import { SettingsModal } from './components/SettingsModal'
import { ExportProgress } from './components/ExportProgress'
import { ImportWizard } from './components/ImportWizard'
import { WelcomeScreen } from './components/WelcomeScreen'
import { DropZone } from './components/DropZone'
import { ImportDetectionDialog, DetectedSourceType } from './components/ImportDetectionDialog'
import { RightSidebar, RightSidebarMode } from './components/RightSidebar'
import { UpdateNotification } from './components/UpdateNotification'
import { ImagePreview } from './components/ImagePreview'
import { EditorHandle } from './components/Editor'
import { useFileSystem } from './store/useFileSystem'
import { useRecentWorkspaces } from './store/useRecentWorkspaces'
import { useTheme, Theme } from './store/useTheme'
import { useSettingsStore } from './store/useSettingsStore'
import { useExportStore } from './store/useExportStore'
import { useEffect, useState, useRef, Component, ErrorInfo, ReactNode } from 'react'
import { htmlToTiptapJson } from './utils/htmlToTiptap'

// Global error handlers - report uncaught errors from renderer process
if (typeof window !== 'undefined') {
  window.onerror = (message, _source, _lineno, _colno, error) => {
    window.electronAPI?.reportRendererError?.({
      type: 'window_error',
      message: String(message),
      stack: error?.stack,
    });
  };

  window.onunhandledrejection = (event) => {
    window.electronAPI?.reportRendererError?.({
      type: 'unhandled_promise',
      message: event.reason?.message || String(event.reason),
      stack: event.reason?.stack,
    });
  };
}

// Error Boundary - catches React component errors
class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  state = { hasError: false, error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('React error boundary caught:', error, errorInfo);
    window.electronAPI?.reportRendererError?.({
      type: 'react_error',
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack || undefined,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-screen bg-background text-foreground">
          <div className="text-center p-8 max-w-md">
            <h1 className="text-xl font-semibold mb-4">Something went wrong</h1>
            <p className="text-muted-foreground mb-6">
              An unexpected error occurred. Please reload the application.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  const { restoreSession, loadDir, rootDir, openFiles, activeFilePath } = useFileSystem();
  const activeFile = openFiles.find(f => f.path === activeFilePath);
  const { setTheme } = useTheme();
  const { openSettings } = useSettingsStore();
  const { isExporting, setIsExporting } = useExportStore();
  const { addRecentWorkspace } = useRecentWorkspaces();

  // Import wizard state
  const [importWizardOpen, setImportWizardOpen] = useState(false);
  const [importSourceType, setImportSourceType] = useState<'obsidian' | 'notion'>('obsidian');
  const [importQuickMode, setImportQuickMode] = useState(false);
  const [importSourcePath, setImportSourcePath] = useState<string | null>(null);

  // Import detection dialog state (for drag-drop)
  const [detectionDialogOpen, setDetectionDialogOpen] = useState(false);
  const [detectedFolderPath, setDetectedFolderPath] = useState('');
  const [detectedFolderName, setDetectedFolderName] = useState('');
  const [detectedType, setDetectedType] = useState<DetectedSourceType>('generic');

  // Right sidebar state (ai, history, drafts, or null)
  const [rightPanelMode, setRightPanelMode] = useState<RightSidebarMode>(null);

  // Editor ref for accessing editor methods from RightSidebar
  const editorRef = useRef<EditorHandle>(null);

  // Shared handler for menu actions (used by both native menu and WindowsMenu)
  const handleMenuAction = async (action: string) => {
    if (action === 'open-workspace') {
      const path = await window.electronAPI.selectDirectory();
      if (path) {
        // Use detection flow to auto-detect workspace type
        const folderName = path.split(/[/\\]/).pop() || path;
        setDetectedFolderPath(path);
        setDetectedFolderName(folderName);

        const result = await window.electronAPI.importDetectSourceType(path);
        if (result.success && result.sourceType) {
          setDetectedType(result.sourceType as DetectedSourceType);
        } else {
          setDetectedType('generic');
        }

        setDetectionDialogOpen(true);
      }
    }
    if (action === 'open-settings') {
      openSettings();
    }
    if (action === 'import-docx') {
      const result = await window.electronAPI.importDocx();
      if (result) {
        const { html, filename } = result;

        // Get current state from store (avoid stale closure)
        const { rootDir: currentRootDir, createFile } = useFileSystem.getState();

        // Check if workspace is open
        if (!currentRootDir) {
          // No workspace - fall back to inserting into current editor
          window.dispatchEvent(new CustomEvent('editor:insert-content', { detail: html }));
          return;
        }

        // Convert HTML to Tiptap JSON
        const json = htmlToTiptapJson(html);

        // Create new file in workspace with the imported content
        const filePath = await createFile(filename, json);

        if (filePath) {
          console.log(`Imported DOCX as: ${filePath}`);
        }
      }
    }
    if (action === 'export-pdf') {
      await window.electronAPI.exportPdf();
    }
    if (action === 'export-docx') {
      setIsExporting(true);
      window.dispatchEvent(new CustomEvent('editor:export-request'));
    }
    if (action === 'import-obsidian') {
      handleImportFromMenu('obsidian');
    }
    if (action === 'import-notion') {
      handleImportFromMenu('notion');
    }
  };

  useEffect(() => {
    restoreSession();

    // Listen for menu actions from native menu (via IPC)
    const cleanupMenu = window.electronAPI.onMenuAction(async (action) => {
      await handleMenuAction(action);
    });

    // Listen for menu actions from WindowsMenu (via custom event)
    const handleWindowsMenuAction = (event: Event) => {
      const customEvent = event as CustomEvent<string>;
      handleMenuAction(customEvent.detail);
    };
    window.addEventListener('windows-menu-action', handleWindowsMenuAction);

    // Listen for theme updates
    const cleanupTheme = window.electronAPI.onUpdateTheme((theme) => {
      setTheme(theme as Theme);
    });

    return () => {
      cleanupMenu();
      cleanupTheme();
      window.removeEventListener('windows-menu-action', handleWindowsMenuAction);
    };
  }, []);

  // Import from menu (obsidian/notion)
  const handleImportFromMenu = (type: 'obsidian' | 'notion') => {
    setImportSourceType(type);
    setImportQuickMode(false);
    setImportSourcePath(null);
    setImportWizardOpen(true);
  };

  // Handle folder drop - detect type and show import dialog
  const handleFolderDrop = async (path: string) => {
    const folderName = path.split(/[/\\]/).pop() || path;
    setDetectedFolderPath(path);
    setDetectedFolderName(folderName);

    // Detect source type
    const result = await window.electronAPI.importDetectSourceType(path);
    if (result.success && result.sourceType) {
      setDetectedType(result.sourceType as DetectedSourceType);
    } else {
      setDetectedType('generic');
    }

    setDetectionDialogOpen(true);
  };

  // Open workspace folder picker
  const handleOpenWorkspace = async () => {
    const path = await window.electronAPI.selectDirectory();
    if (path) {
      await handleFolderDrop(path);
    }
  };

  // Open a recent workspace directly
  const handleOpenRecentWorkspace = async (path: string) => {
    await loadDir(path);
    addRecentWorkspace(path);
  };

  // Quick import - use defaults
  const handleQuickImport = () => {
    setDetectionDialogOpen(false);
    setImportSourceType(detectedType as 'obsidian' | 'notion');
    setImportQuickMode(true);
    setImportSourcePath(detectedFolderPath);
    setImportWizardOpen(true);
  };

  // Customize import - show options
  const handleCustomizeImport = () => {
    setDetectionDialogOpen(false);
    setImportSourceType(detectedType as 'obsidian' | 'notion');
    setImportQuickMode(false);
    setImportSourcePath(detectedFolderPath);
    setImportWizardOpen(true);
  };

  // Open folder without importing
  const handleOpenWithoutImport = async () => {
    setDetectionDialogOpen(false);
    await loadDir(detectedFolderPath);
    addRecentWorkspace(detectedFolderPath);
  };

  return (
    <DropZone onFolderDrop={handleFolderDrop}>
      <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
        <TitleBar />
        {rootDir ? (
          // Workspace is open - show normal layout
          <div className="flex-1 flex overflow-hidden bg-secondary gap-2">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0 py-2 pr-2 h-full">
              <div className="flex-1 flex flex-col min-w-0 bg-background rounded-xl shadow-sm overflow-hidden">
                {activeFile?.category === 'viewable' ? (
                  <ImagePreview
                    filePath={activeFile.path}
                    fileName={activeFile.name}
                  />
                ) : (
                  <Editor
                    ref={editorRef}
                    rightPanelMode={rightPanelMode}
                    onSetRightPanelMode={setRightPanelMode}
                  />
                )}
              </div>
            </div>
            {/* Right Sidebar - AI, History, or Drafts - only show for markdown files */}
            {activeFile?.category !== 'viewable' && (
              <RightSidebar
                mode={rightPanelMode}
                onClose={() => setRightPanelMode(null)}
                onRestoreContent={(content) => editorRef.current?.restoreContent(content)}
                onSwitchToDraft={(content) => editorRef.current?.switchToDraft(content)}
                onSwitchToMain={() => editorRef.current?.switchToMain()}
                getCurrentContent={() => editorRef.current?.getCurrentContent()}
              />
            )}
          </div>
        ) : (
          // No workspace - show welcome screen
          <WelcomeScreen
            onOpenWorkspace={handleOpenWorkspace}
            onImportObsidian={() => handleImportFromMenu('obsidian')}
            onImportNotion={() => handleImportFromMenu('notion')}
            onOpenRecentWorkspace={handleOpenRecentWorkspace}
          />
        )}
        <SettingsModal />
        <ExportProgress isVisible={isExporting} onClose={() => setIsExporting(false)} />
        <ImportDetectionDialog
          open={detectionDialogOpen}
          onOpenChange={setDetectionDialogOpen}
          folderPath={detectedFolderPath}
          folderName={detectedFolderName}
          detectedType={detectedType}
          onQuickImport={handleQuickImport}
          onCustomizeImport={handleCustomizeImport}
          onOpenWithoutImport={handleOpenWithoutImport}
        />
        <ImportWizard
          open={importWizardOpen}
          onOpenChange={setImportWizardOpen}
          sourceType={importSourceType}
          destinationPath={rootDir || detectedFolderPath}
          onComplete={() => {
            // Reload the directory to show imported files
            const path = rootDir || detectedFolderPath;
            if (path) {
              loadDir(path);
              addRecentWorkspace(path);
            }
          }}
          quickImport={importQuickMode}
          initialSourcePath={importSourcePath}
        />
        <UpdateNotification />
      </div>
    </DropZone>
  )
}

// Wrap App with ErrorBoundary for production error catching
export default function AppWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}
