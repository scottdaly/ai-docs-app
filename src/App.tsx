import { TitleBar } from './components/TitleBar'
import { Sidebar } from './components/Sidebar'
import { Editor } from './components/Editor'
import { TabBar } from './components/TabBar'
import { SettingsModal } from './components/SettingsModal'
import { ExportProgress } from './components/ExportProgress'
import { useFileSystem } from './store/useFileSystem'
import { useTheme, Theme } from './store/useTheme'
import { useSettingsStore } from './store/useSettingsStore'
import { useExportStore } from './store/useExportStore'
import { useEffect } from 'react'
import { htmlToMarkdown } from './utils/markdown'

function App() {
  const { restoreSession, loadDir } = useFileSystem();
  const { setTheme } = useTheme();
  const { openSettings } = useSettingsStore();
  const { isExporting, setIsExporting } = useExportStore();

  useEffect(() => {
    restoreSession();

    // Listen for menu actions
    const cleanupMenu = window.electronAPI.onMenuAction(async (action) => {
        if (action === 'open-workspace') {
            const path = await window.electronAPI.selectDirectory();
            if (path) {
                await loadDir(path);
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

                // Convert HTML to markdown for storage
                const markdown = htmlToMarkdown(html);

                // Create new file in workspace with the imported content
                const filePath = await createFile(filename, markdown);

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

  return (
    <div className="h-screen flex flex-col bg-background text-foreground overflow-hidden">
      <TitleBar />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <TabBar />
          <Editor />
        </div>
      </div>
      <SettingsModal />
      <ExportProgress isVisible={isExporting} onClose={() => setIsExporting(false)} />
    </div>
  )
}

export default App
