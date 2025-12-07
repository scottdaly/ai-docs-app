import { ChevronDown } from 'lucide-react';
import logoSvg from '../assets/logo.svg';
import { useTheme, Theme } from '../store/useTheme';
import { useSettingsStore } from '../store/useSettingsStore';
import { useExportStore } from '../store/useExportStore';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuShortcut,
} from './ui/dropdown-menu';

export function WindowsMenu() {
  const { theme, setTheme } = useTheme();
  const { openSettings } = useSettingsStore();
  const { setIsExporting } = useExportStore();

  // Dispatch custom events that App.tsx will handle (same as native menu)
  const dispatchMenuAction = (action: string) => {
    window.dispatchEvent(new CustomEvent('windows-menu-action', { detail: action }));
  };

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme as Theme);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-1 px-2 py-1 ml-2 hover:bg-accent rounded-md transition-colors">
          <img src={logoSvg} alt="Midlight" className="h-5 w-5 rounded" />
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {/* File Menu */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>File</DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-48">
            <DropdownMenuItem onClick={() => dispatchMenuAction('open-workspace')}>
              Open Workspace...
              <DropdownMenuShortcut>Ctrl+O</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Import</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem onClick={() => dispatchMenuAction('import-obsidian')}>
                  From Obsidian Vault...
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => dispatchMenuAction('import-notion')}>
                  From Notion Export...
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => dispatchMenuAction('import-docx')}>
                  From DOCX File...
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Export</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem onClick={() => dispatchMenuAction('export-pdf')}>
                  To PDF...
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => {
                  setIsExporting(true);
                  window.dispatchEvent(new CustomEvent('editor:export-request'));
                }}>
                  To DOCX...
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => openSettings()}>
              Settings
              <DropdownMenuShortcut>Ctrl+,</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => window.close()}>
              Quit
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {/* Edit Menu */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Edit</DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-48">
            <DropdownMenuItem onClick={() => document.execCommand('undo')}>
              Undo
              <DropdownMenuShortcut>Ctrl+Z</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => document.execCommand('redo')}>
              Redo
              <DropdownMenuShortcut>Ctrl+Y</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => document.execCommand('cut')}>
              Cut
              <DropdownMenuShortcut>Ctrl+X</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => document.execCommand('copy')}>
              Copy
              <DropdownMenuShortcut>Ctrl+C</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => document.execCommand('paste')}>
              Paste
              <DropdownMenuShortcut>Ctrl+V</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => document.execCommand('selectAll')}>
              Select All
              <DropdownMenuShortcut>Ctrl+A</DropdownMenuShortcut>
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {/* View Menu */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>View</DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-48">
            <DropdownMenuItem onClick={() => window.location.reload()}>
              Reload
              <DropdownMenuShortcut>Ctrl+R</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Theme</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuRadioGroup value={theme} onValueChange={handleThemeChange}>
                  <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="midnight">Midnight</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="sepia">Sepia</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="forest">Forest</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="cyberpunk">Cyberpunk</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="coffee">Coffee</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="system">System</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {/* Window Menu */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Window</DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-48">
            <DropdownMenuItem onClick={() => dispatchMenuAction('minimize')}>
              Minimize
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => window.close()}>
              Close
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {/* Help Menu */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>Help</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem onClick={() => window.open('https://electronjs.org', '_blank')}>
              Learn More
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
