import { TitleBar } from './components/TitleBar'
import { Sidebar } from './components/Sidebar'
import { Editor } from './components/Editor'
import { TabBar } from './components/TabBar'
import { SettingsModal } from './components/SettingsModal'
import { ExportProgress } from './components/ExportProgress'
import { ImportWizard } from './components/ImportWizard'
import { WelcomeScreen } from './components/WelcomeScreen'
import { DropZone } from './components/DropZone'
import { ImportDetectionDialog, DetectedSourceType } from './components/ImportDetectionDialog'
import { useFileSystem } from './store/useFileSystem'
import { useRecentWorkspaces } from './store/useRecentWorkspaces'
import { useTheme, Theme } from './store/useTheme'
import { useSettingsStore } from './store/useSettingsStore'
import { useExportStore } from './store/useExportStore'
import { useEffect, useState } from 'react'
import { htmlToTiptapJson } from './utils/htmlToTiptap'

function App() {
  const { restoreSession, loadDir, rootDir } = useFileSystem();
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

  useEffect(() => {
    restoreSession();

    // Listen for menu actions
    const cleanupMenu = window.electronAPI.onMenuAction(async (action) => {
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
                const { rootDir, createFile } = useFileSystem.getState();

                // Check if workspace is open
                if (!rootDir) {
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
    });

    // Listen for theme updates
    const cleanupTheme = window.electronAPI.onUpdateTheme((theme) => {
        setTheme(theme as Theme);
    });

    return () => {
        cleanupMenu();
        cleanupTheme();
    };
  }, []);

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

  // Import from menu (obsidian/notion)
  const handleImportFromMenu = (type: 'obsidian' | 'notion') => {
    setImportSourceType(type);
    setImportQuickMode(false);
    setImportSourcePath(null);
    setImportWizardOpen(true);
  };

  return (
    <DropZone onFolderDrop={handleFolderDrop}>
      <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
        <TitleBar />
        {rootDir ? (
          // Workspace is open - show normal layout
          <div className="flex-1 flex overflow-hidden">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0">
              <TabBar />
              <Editor />
            </div>
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
      </div>
    </DropZone>
  )
}

export default App
