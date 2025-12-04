import { TitleBar } from './components/TitleBar'
import { Sidebar } from './components/Sidebar'
import { Editor } from './components/Editor'
import { TabBar } from './components/TabBar'
import { SettingsModal } from './components/SettingsModal'
import { useFileSystem } from './store/useFileSystem'
import { useTheme, Theme } from './store/useTheme'
import { useSettingsStore } from './store/useSettingsStore'
import { useEffect } from 'react'

function App() {
  const { restoreSession, loadDir } = useFileSystem();
  const { setTheme } = useTheme();
  const { openSettings } = useSettingsStore();

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
            const html = await window.electronAPI.importDocx();
            if (html) {
                // We need a way to insert this into the editor.
                // For now, we'll just dispatch a custom event that the Editor component listens to,
                // OR we can update the store if we want to replace content.
                // But import usually means "insert".
                // Let's use a custom event 'editor:insert-content'
                window.dispatchEvent(new CustomEvent('editor:insert-content', { detail: html }));
            }
        }
        if (action === 'export-pdf') {
            await window.electronAPI.exportPdf();
        }
        if (action === 'export-docx') {
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
    </div>
  )
}

export default App
