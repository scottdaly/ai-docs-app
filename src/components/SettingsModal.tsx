import * as Dialog from '@radix-ui/react-dialog';
import { X, Palette, Settings as SettingsIcon, Bot, Check } from 'lucide-react';
import { useSettingsStore } from '../store/useSettingsStore';
import { useTheme, Theme } from '../store/useTheme';

const TABS = [
  { id: 'general', label: 'General', icon: SettingsIcon },
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

export function SettingsModal() {
  const { isOpen, setIsOpen, activeTab, setActiveTab } = useSettingsStore();
  const { theme, setTheme } = useTheme();

  return (
    <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-[50%] top-[50%] z-50 w-full max-w-4xl translate-x-[-50%] translate-y-[-50%] border bg-background shadow-xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-xl h-[600px] flex overflow-hidden">
          
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
                    <div className="flex flex-col items-center justify-center h-full text-center space-y-4 text-muted-foreground border-2 border-dashed rounded-xl">
                        <SettingsIcon size={48} className="opacity-20" />
                        <p>General settings coming soon.</p>
                    </div>
                )}

                {activeTab === 'ai' && (
                    <div className="flex flex-col items-center justify-center h-full text-center space-y-4 text-muted-foreground border-2 border-dashed rounded-xl">
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
