import * as Dialog from '@radix-ui/react-dialog';
import { X, Palette, Settings as SettingsIcon, Bot, Check, Type, History } from 'lucide-react';
import { useSettingsStore } from '../store/useSettingsStore';
import { useTheme, Theme } from '../store/useTheme';
import { useFileSystem } from '../store/useFileSystem';
import { usePreferences } from '../store/usePreferences';
import { useEffect } from 'react';
import {
  useWorkspaceConfig,
  FONT_OPTIONS,
  FONT_SIZE_OPTIONS,
  LINE_HEIGHT_OPTIONS,
  AUTO_SAVE_OPTIONS,
  CHECKPOINT_INTERVAL_OPTIONS,
  MIN_CHANGE_OPTIONS,
  MAX_CHECKPOINTS_OPTIONS,
  RETENTION_OPTIONS,
} from '../hooks/useWorkspaceConfig';

const TABS = [
  { id: 'general', label: 'General', icon: SettingsIcon },
  { id: 'editor', label: 'Editor', icon: Type },
  { id: 'versioning', label: 'Versioning', icon: History },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'ai', label: 'AI Models', icon: Bot },
] as const;

const THEMES: { 
    value: Theme; 
    label: string; 
    description: string;
    colors: { bg: string; sidebar: string; text: string; accent: string; border: string }
}[] = [
  { 
      value: 'light', 
      label: 'Light', 
      description: 'Clean and bright',
      colors: { bg: '#ffffff', sidebar: '#f4f4f5', text: '#0f172a', accent: '#e2e8f0', border: '#e2e8f0' }
  },
  { 
      value: 'dark', 
      label: 'Dark', 
      description: 'Easy on the eyes',
      colors: { bg: '#020817', sidebar: '#0f1729', text: '#f8fafc', accent: '#1e293b', border: '#1e293b' }
  },
  { 
      value: 'midnight', 
      label: 'Midnight', 
      description: 'Deep contrast',
      colors: { bg: '#0b0e14', sidebar: '#10151f', text: '#e2e8f0', accent: '#1e293b', border: '#1e293b' }
  },
  { 
      value: 'sepia', 
      label: 'Sepia', 
      description: 'Warm and reading-focused',
      colors: { bg: '#fdfbf7', sidebar: '#f4efe4', text: '#433422', accent: '#e6dec9', border: '#e6dec9' }
  },
  { 
      value: 'forest', 
      label: 'Forest', 
      description: 'Calming nature tones',
      colors: { bg: '#15231d', sidebar: '#1a2e26', text: '#e2e8f0', accent: '#2d4a3e', border: '#2d4a3e' }
  },
  { 
      value: 'cyberpunk', 
      label: 'Cyberpunk', 
      description: 'High contrast neon',
      colors: { bg: '#0d0514', sidebar: '#1a0a26', text: '#f0f0f0', accent: '#d946ef', border: '#4c1d95' }
  },
  { 
      value: 'coffee', 
      label: 'Coffee', 
      description: 'Rich and cozy',
      colors: { bg: '#f3eeda', sidebar: '#e8e2cd', text: '#4a3b32', accent: '#d4cba8', border: '#d4cba8' }
  },
  { 
      value: 'system', 
      label: 'System', 
      description: 'Follows your OS settings',
      colors: { bg: 'linear-gradient(135deg, #ffffff 50%, #020817 50%)', sidebar: '#e2e8f0', text: '#94a3b8', accent: '#cbd5e1', border: '#cbd5e1' }
  },
];

function ThemePreview({ colors, isSystem }: { colors: typeof THEMES[0]['colors'], isSystem?: boolean }) {
    if (isSystem) {
        return (
            <div className="w-full h-full relative overflow-hidden bg-white dark:bg-black"> {/* Light/Dark base */}
                <div className="absolute inset-0 flex">
                    {/* Left half (Light) */}
                    <div className="w-1/2 h-full flex flex-col text-[6px] select-none overflow-hidden" style={{ backgroundColor: '#ffffff', color: '#0f172a' }}>
                        <div className="h-3 w-full border-b flex items-center px-2 gap-1" style={{ borderColor: '#e2e8f0' }}></div>
                        <div className="flex-1 flex overflow-hidden">
                            <div className="w-8 h-full border-r" style={{ backgroundColor: '#f4f4f5', borderColor: '#e2e8f0' }}></div>
                            <div className="flex-1 p-2"></div>
                        </div>
                    </div>
                    {/* Right half (Dark) */}
                    <div className="w-1/2 h-full flex flex-col text-[6px] select-none overflow-hidden" style={{ backgroundColor: '#020817', color: '#f8fafc' }}>
                        <div className="h-3 w-full border-b flex items-center px-2 gap-1" style={{ borderColor: '#1e293b' }}></div>
                        <div className="flex-1 flex overflow-hidden">
                            <div className="w-8 h-full border-r" style={{ backgroundColor: '#0f1729', borderColor: '#1e293b' }}></div>
                            <div className="flex-1 p-2"></div>
                        </div>
                    </div>
                </div>
                 <div className="absolute inset-0 flex items-center justify-center">
                     <div className="text-xs font-medium text-white dark:text-black bg-black/50 dark:bg-white/50 px-2 py-1 rounded shadow-md backdrop-blur-sm">System</div>
                 </div>
            </div>
        )
    }

    return (
        <div className="w-full h-full flex flex-col text-[6px] select-none overflow-hidden" style={{ backgroundColor: colors.bg, color: colors.text }}>
            {/* Title Bar */}
            <div className="h-3 w-full border-b flex items-center px-2 gap-1" style={{ borderColor: colors.border }}>
                <div className="h-1 w-1 rounded-full" style={{ backgroundColor: colors.text, opacity: 0.2 }} />
                <div className="h-1 w-1 rounded-full" style={{ backgroundColor: colors.text, opacity: 0.2 }} />
                <div className="h-1 w-1 rounded-full" style={{ backgroundColor: colors.text, opacity: 0.2 }} />
            </div>
            <div className="flex-1 flex overflow-hidden">
                {/* Sidebar */}
                <div className="w-8 h-full border-r flex flex-col gap-1 p-1" style={{ backgroundColor: colors.sidebar, borderColor: colors.border }}>
                     <div className="h-1 w-5 rounded opacity-20" style={{ backgroundColor: colors.text }} />
                     <div className="h-1 w-4 rounded opacity-20" style={{ backgroundColor: colors.text }} />
                     <div className="h-1 w-6 rounded opacity-20" style={{ backgroundColor: colors.text }} />
                     <div className="mt-auto h-1 w-3 rounded opacity-20" style={{ backgroundColor: colors.text }} />
                </div>
                {/* Editor */}
                <div className="flex-1 p-2 space-y-1.5">
                     <div className="h-2 w-3/4 rounded opacity-80 mb-2" style={{ backgroundColor: colors.text }} />
                     <div className="h-1 w-full rounded opacity-40" style={{ backgroundColor: colors.text }} />
                     <div className="h-1 w-5/6 rounded opacity-40" style={{ backgroundColor: colors.text }} />
                     <div className="h-1 w-4/6 rounded opacity-40" style={{ backgroundColor: colors.text }} />
                     
                     <div className="h-1 w-full rounded opacity-40 mt-2" style={{ backgroundColor: colors.text }} />
                     <div className="h-1 w-2/3 rounded opacity-40" style={{ backgroundColor: colors.text }} />
                </div>
            </div>
        </div>
    );
}

// Reusable form components
function SettingRow({ label, description, children }: { label: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="space-y-0.5">
        <label className="text-sm font-medium">{label}</label>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      {children}
    </div>
  );
}

function Select({ value, onChange, options }: { value: string | number; onChange: (value: string) => void; options: { value: string | number; label: string }[] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
        checked ? 'bg-primary' : 'bg-muted'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

function SettingSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">{title}</h3>
      <div className="divide-y">{children}</div>
    </div>
  );
}

export function SettingsModal() {
  const { isOpen, setIsOpen, activeTab, setActiveTab } = useSettingsStore();
  const { theme, setTheme } = useTheme();
  const { rootDir } = useFileSystem();
  const { config, loadConfig, updateDefaults, updateEditor, updateVersioning } = useWorkspaceConfig();
  const { showUnsupportedFiles, setShowUnsupportedFiles, errorReportingEnabled, setErrorReportingEnabled, pageMode, setPageMode, showPageNumbers, setShowPageNumbers } = usePreferences();

  // Load config when modal opens and workspace exists
  useEffect(() => {
    if (isOpen && rootDir) {
      loadConfig(rootDir);
    }
  }, [isOpen, rootDir, loadConfig]);

  const hasWorkspace = !!rootDir;

  return (
    <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-50 w-full max-w-4xl translate-x-[-50%] translate-y-[-50%] border bg-background shadow-xl sm:rounded-xl h-[600px] flex overflow-hidden">
          
          {/* Sidebar */}
          <div className="w-64 border-r bg-muted/30 flex flex-col">
            <div className="p-6 pb-4">
                <h2 className="text-lg font-semibold tracking-tight">Settings</h2>
            </div>
            <div className="flex-1 px-3 space-y-1">
                {TABS.map((tab) => (
                <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md w-full text-left transition-all ${
                    activeTab === tab.id 
                        ? 'bg-accent text-accent-foreground' 
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    }`}
                >
                    <tab.icon size={18} />
                    {tab.label}
                </button>
                ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 flex flex-col min-w-0 bg-background">
             <div className="flex items-center justify-between px-8 py-6 border-b">
                <div>
                    <Dialog.Title className="text-2xl font-semibold tracking-tight">
                        {TABS.find(t => t.id === activeTab)?.label}
                    </Dialog.Title>
                    <p className="text-sm text-muted-foreground mt-1">
                        Manage your {TABS.find(t => t.id === activeTab)?.label.toLowerCase()} preferences.
                    </p>
                </div>
                <Dialog.Close className="rounded-full p-2 opacity-70 ring-offset-background transition-all hover:bg-accent hover:opacity-100 focus:outline-none">
                    <X size={20} />
                    <span className="sr-only">Close</span>
                </Dialog.Close>
             </div>

             <div className="flex-1 overflow-y-auto p-8">
                {activeTab === 'appearance' && (
                    <div className="space-y-8">
                        <div className="space-y-4">
                            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Theme</h3>
                            <div className="grid grid-cols-3 gap-6">
                                {THEMES.map((t) => (
                                    <button
                                        key={t.value}
                                        onClick={() => setTheme(t.value)}
                                        className={`
                                            group relative flex flex-col text-left rounded-xl transition-all overflow-hidden focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
                                            ${theme === t.value ? 'ring-2 ring-primary ring-offset-2' : 'border border-muted hover:border-primary/50'}
                                        `}
                                    >
                                        <div className="aspect-video w-full border-b">
                                            <ThemePreview colors={t.colors} isSystem={t.value === 'system'} />
                                        </div>
                                        <div className="p-4 space-y-1 bg-card">
                                            <div className="font-semibold text-sm flex items-center justify-between">
                                                {t.label}
                                                {theme === t.value && (
                                                    <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-sm">
                                                        <Check size={14} strokeWidth={2.5} />
                                                    </div>
                                                )}
                                            </div>
                                            <p className="text-xs text-muted-foreground">{t.description}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'general' && (
                    <div className="space-y-8">
                      <SettingSection title="File Browser">
                        <SettingRow label="Show Unsupported Files" description="Display files that can't be opened or imported">
                          <Toggle
                            checked={showUnsupportedFiles}
                            onChange={setShowUnsupportedFiles}
                          />
                        </SettingRow>
                      </SettingSection>

                      <SettingSection title="Privacy">
                        <SettingRow
                          label="Send Error Reports"
                          description="Help improve Midlight by sending anonymous error reports when something goes wrong"
                        >
                          <Toggle
                            checked={errorReportingEnabled}
                            onChange={setErrorReportingEnabled}
                          />
                        </SettingRow>
                        <p className="text-xs text-muted-foreground pt-2 pb-1">
                          Error reports include only technical details needed to diagnose issues.
                          No personal data, file contents, or identifying information is collected.
                        </p>
                      </SettingSection>

                      {!hasWorkspace ? (
                        <div className="flex flex-col items-center justify-center h-48 text-center space-y-4 text-muted-foreground border-2 border-dashed rounded-xl">
                          <SettingsIcon size={48} className="opacity-20" />
                          <p>Open a workspace to configure document defaults.</p>
                        </div>
                      ) : (
                        <>
                          <SettingSection title="Document Defaults">
                            <SettingRow label="Default Font" description="Font family for new documents">
                              <Select
                                value={config.defaults.font || 'Merriweather'}
                                onChange={(v) => updateDefaults({ font: v })}
                                options={FONT_OPTIONS}
                              />
                            </SettingRow>
                            <SettingRow label="Font Size" description="Base font size for new documents">
                              <Select
                                value={config.defaults.fontSize || '16px'}
                                onChange={(v) => updateDefaults({ fontSize: v })}
                                options={FONT_SIZE_OPTIONS}
                              />
                            </SettingRow>
                            <SettingRow label="Line Height" description="Line spacing for new documents">
                              <Select
                                value={config.defaults.lineHeight || 1.6}
                                onChange={(v) => updateDefaults({ lineHeight: parseFloat(v) })}
                                options={LINE_HEIGHT_OPTIONS}
                              />
                            </SettingRow>
                          </SettingSection>

                          <SettingSection title="Saving">
                            <SettingRow label="Auto-save Delay" description="Wait time before auto-saving changes">
                              <Select
                                value={config.editor.autoSaveIntervalMs}
                                onChange={(v) => updateEditor({ autoSaveIntervalMs: parseInt(v) })}
                                options={AUTO_SAVE_OPTIONS}
                              />
                            </SettingRow>
                          </SettingSection>

                          <p className="text-xs text-muted-foreground pt-4">
                            These settings apply to new documents in this workspace.
                          </p>
                        </>
                      )}
                    </div>
                )}

                {activeTab === 'editor' && (
                    <div className="space-y-8">
                      {/* Page Mode - Global setting, doesn't require workspace */}
                      <SettingSection title="Page Layout">
                        <SettingRow label="Page Mode" description="How the document is displayed in the editor">
                          <div className="flex gap-2">
                            <button
                              onClick={() => setPageMode('continuous')}
                              className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                                pageMode === 'continuous'
                                  ? 'bg-primary text-primary-foreground border-primary'
                                  : 'bg-background border-border hover:bg-accent'
                              }`}
                            >
                              Continuous
                            </button>
                            <button
                              onClick={() => setPageMode('paginated')}
                              className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                                pageMode === 'paginated'
                                  ? 'bg-primary text-primary-foreground border-primary'
                                  : 'bg-background border-border hover:bg-accent'
                              }`}
                            >
                              Pages
                            </button>
                          </div>
                        </SettingRow>
                        <p className="text-xs text-muted-foreground pt-2 pb-1">
                          {pageMode === 'continuous'
                            ? 'Document flows as one long page. Good for drafting and notes.'
                            : 'Document shows visual page breaks like Word or Google Docs. Good for print-ready documents.'
                          }
                        </p>
                        {pageMode === 'paginated' && (
                          <SettingRow label="Show Page Numbers" description="Display page numbers at the bottom of each page">
                            <Toggle
                              checked={showPageNumbers}
                              onChange={setShowPageNumbers}
                            />
                          </SettingRow>
                        )}
                      </SettingSection>

                      {!hasWorkspace ? (
                        <div className="flex flex-col items-center justify-center h-48 text-center space-y-4 text-muted-foreground border-2 border-dashed rounded-xl">
                          <Type size={48} className="opacity-20" />
                          <p>Open a workspace to configure additional editor settings.</p>
                        </div>
                      ) : (
                        <>
                          <SettingSection title="Display">
                            <SettingRow label="Show Word Count" description="Display word count in the status bar">
                              <Toggle
                                checked={config.editor.showWordCount}
                                onChange={(v) => updateEditor({ showWordCount: v })}
                              />
                            </SettingRow>
                            <SettingRow label="Show Character Count" description="Display character count in the status bar">
                              <Toggle
                                checked={config.editor.showCharCount}
                                onChange={(v) => updateEditor({ showCharCount: v })}
                              />
                            </SettingRow>
                          </SettingSection>

                          <SettingSection title="Input">
                            <SettingRow label="Spellcheck" description="Enable browser spellcheck in the editor">
                              <Toggle
                                checked={config.editor.spellcheck}
                                onChange={(v) => updateEditor({ spellcheck: v })}
                              />
                            </SettingRow>
                          </SettingSection>
                        </>
                      )}
                    </div>
                )}

                {activeTab === 'versioning' && (
                    <div className="space-y-8">
                      {!hasWorkspace ? (
                        <div className="flex flex-col items-center justify-center h-64 text-center space-y-4 text-muted-foreground border-2 border-dashed rounded-xl">
                          <History size={48} className="opacity-20" />
                          <p>Open a workspace to configure versioning settings.</p>
                        </div>
                      ) : (
                        <>
                          <SettingSection title="Auto-Save History">
                            <SettingRow label="Enable Auto-Save History" description="Keep background snapshots for crash recovery">
                              <Toggle
                                checked={config.versioning.enabled}
                                onChange={(v) => updateVersioning({ enabled: v })}
                              />
                            </SettingRow>
                            <SettingRow label="Snapshot Interval" description="Time between background snapshots">
                              <Select
                                value={config.versioning.checkpointIntervalMs}
                                onChange={(v) => updateVersioning({ checkpointIntervalMs: parseInt(v) })}
                                options={CHECKPOINT_INTERVAL_OPTIONS}
                              />
                            </SettingRow>
                            <SettingRow label="Minimum Changes" description="Minimum changes to trigger a snapshot">
                              <Select
                                value={config.versioning.minChangeChars}
                                onChange={(v) => updateVersioning({ minChangeChars: parseInt(v) })}
                                options={MIN_CHANGE_OPTIONS}
                              />
                            </SettingRow>
                          </SettingSection>

                          <SettingSection title="Storage Limits">
                            <SettingRow label="Max Snapshots" description="Maximum background snapshots per file">
                              <Select
                                value={config.versioning.maxCheckpointsPerFile}
                                onChange={(v) => updateVersioning({ maxCheckpointsPerFile: parseInt(v) })}
                                options={MAX_CHECKPOINTS_OPTIONS}
                              />
                            </SettingRow>
                            <SettingRow label="Retention Period" description="How long to keep background snapshots">
                              <Select
                                value={config.versioning.retentionDays}
                                onChange={(v) => updateVersioning({ retentionDays: parseInt(v) })}
                                options={RETENTION_OPTIONS}
                              />
                            </SettingRow>
                          </SettingSection>

                          <p className="text-xs text-muted-foreground pt-4">
                            Saved versions are kept forever until you delete them.
                          </p>
                        </>
                      )}
                    </div>
                )}

                {activeTab === 'ai' && (
                    <div className="flex flex-col items-center justify-center h-64 text-center space-y-4 text-muted-foreground border-2 border-dashed rounded-xl">
                        <Bot size={48} className="opacity-20" />
                        <p>AI Model configuration coming in Phase 2.</p>
                    </div>
                )}
             </div>
          </div>

        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
