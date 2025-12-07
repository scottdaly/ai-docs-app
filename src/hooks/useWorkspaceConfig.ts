import { create } from 'zustand';
import { useFileSystem } from '../store/useFileSystem';

// Default config values (must match electron/services/types.ts)
const DEFAULT_CONFIG: WorkspaceConfig = {
  version: 1,
  workspace: {
    created: new Date().toISOString(),
  },
  defaults: {
    font: 'Merriweather',
    fontSize: '16px',
    lineHeight: 1.6,
  },
  editor: {
    spellcheck: true,
    showWordCount: true,
    showCharCount: false,
    autoSaveIntervalMs: 1000,
  },
  versioning: {
    enabled: true,
    checkpointIntervalMs: 5 * 60 * 1000,
    minChangeChars: 50,
    maxCheckpointsPerFile: 50,
    retentionDays: 7,
  },
  recovery: {
    enabled: true,
    walIntervalMs: 500,
  },
  sync: {
    enabled: false,
    lastSync: null,
  },
};

interface WorkspaceConfigState {
  config: WorkspaceConfig;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadConfig: (workspaceRoot: string) => Promise<void>;
  updateConfig: (updates: Partial<WorkspaceConfig>) => Promise<void>;
  updateDefaults: (defaults: Partial<WorkspaceConfig['defaults']>) => Promise<void>;
  updateEditor: (editor: Partial<EditorConfig>) => Promise<void>;
  updateVersioning: (versioning: Partial<WorkspaceConfig['versioning']>) => Promise<void>;
  resetToDefaults: () => Promise<void>;
}

export const useWorkspaceConfig = create<WorkspaceConfigState>((set, get) => ({
  config: DEFAULT_CONFIG,
  isLoading: false,
  error: null,

  loadConfig: async (workspaceRoot: string) => {
    set({ isLoading: true, error: null });
    try {
      const result = await window.electronAPI.workspaceGetConfig(workspaceRoot);
      if (result.success && result.config) {
        // Merge with defaults to ensure all fields exist
        const mergedConfig: WorkspaceConfig = {
          ...DEFAULT_CONFIG,
          ...result.config,
          defaults: { ...DEFAULT_CONFIG.defaults, ...result.config.defaults },
          editor: { ...DEFAULT_CONFIG.editor, ...result.config.editor },
          versioning: { ...DEFAULT_CONFIG.versioning, ...result.config.versioning },
          recovery: { ...DEFAULT_CONFIG.recovery, ...result.config.recovery },
          sync: { ...DEFAULT_CONFIG.sync, ...result.config.sync },
        };
        set({ config: mergedConfig, isLoading: false });
      } else {
        set({ error: result.error || 'Failed to load config', isLoading: false });
      }
    } catch (error) {
      set({ error: String(error), isLoading: false });
    }
  },

  updateConfig: async (updates: Partial<WorkspaceConfig>) => {
    const rootDir = useFileSystem.getState().rootDir;
    if (!rootDir) return;

    try {
      const result = await window.electronAPI.workspaceUpdateConfig(rootDir, updates);
      if (result.success) {
        set((state) => ({
          config: { ...state.config, ...updates },
        }));
      }
    } catch (error) {
      console.error('Failed to update config:', error);
    }
  },

  updateDefaults: async (defaults: Partial<WorkspaceConfig['defaults']>) => {
    const { config, updateConfig } = get();
    await updateConfig({
      defaults: { ...config.defaults, ...defaults },
    });
  },

  updateEditor: async (editor: Partial<EditorConfig>) => {
    const { config, updateConfig } = get();
    await updateConfig({
      editor: { ...config.editor, ...editor },
    });
  },

  updateVersioning: async (versioning: Partial<WorkspaceConfig['versioning']>) => {
    const { config, updateConfig } = get();
    await updateConfig({
      versioning: { ...config.versioning, ...versioning },
    });
  },

  resetToDefaults: async () => {
    const rootDir = useFileSystem.getState().rootDir;
    if (!rootDir) return;

    try {
      const result = await window.electronAPI.workspaceUpdateConfig(rootDir, {
        defaults: DEFAULT_CONFIG.defaults,
        editor: DEFAULT_CONFIG.editor,
        versioning: DEFAULT_CONFIG.versioning,
      });
      if (result.success) {
        set((state) => ({
          config: {
            ...state.config,
            defaults: DEFAULT_CONFIG.defaults,
            editor: DEFAULT_CONFIG.editor,
            versioning: DEFAULT_CONFIG.versioning,
          },
        }));
      }
    } catch (error) {
      console.error('Failed to reset config:', error);
    }
  },
}));

// Font options for settings UI
export const FONT_OPTIONS = [
  { value: 'Merriweather', label: 'Merriweather', category: 'Serif' },
  { value: 'Georgia', label: 'Georgia', category: 'Serif' },
  { value: 'Times New Roman', label: 'Times New Roman', category: 'Serif' },
  { value: 'Lora', label: 'Lora', category: 'Serif' },
  { value: 'Inter', label: 'Inter', category: 'Sans-serif' },
  { value: 'Open Sans', label: 'Open Sans', category: 'Sans-serif' },
  { value: 'Roboto', label: 'Roboto', category: 'Sans-serif' },
  { value: 'system-ui', label: 'System UI', category: 'Sans-serif' },
  { value: 'JetBrains Mono', label: 'JetBrains Mono', category: 'Monospace' },
  { value: 'Fira Code', label: 'Fira Code', category: 'Monospace' },
];

export const FONT_SIZE_OPTIONS = [
  { value: '12px', label: '12px' },
  { value: '14px', label: '14px' },
  { value: '16px', label: '16px' },
  { value: '18px', label: '18px' },
  { value: '20px', label: '20px' },
  { value: '24px', label: '24px' },
];

export const LINE_HEIGHT_OPTIONS = [
  { value: 1.4, label: '1.4 - Compact' },
  { value: 1.5, label: '1.5 - Normal' },
  { value: 1.6, label: '1.6 - Relaxed' },
  { value: 1.8, label: '1.8 - Spacious' },
  { value: 2.0, label: '2.0 - Double' },
];

export const AUTO_SAVE_OPTIONS = [
  { value: 500, label: '0.5 seconds' },
  { value: 1000, label: '1 second' },
  { value: 2000, label: '2 seconds' },
  { value: 5000, label: '5 seconds' },
];

export const CHECKPOINT_INTERVAL_OPTIONS = [
  { value: 60000, label: '1 minute' },
  { value: 300000, label: '5 minutes' },
  { value: 600000, label: '10 minutes' },
  { value: 1800000, label: '30 minutes' },
];

export const MIN_CHANGE_OPTIONS = [
  { value: 20, label: '20 characters' },
  { value: 50, label: '50 characters' },
  { value: 100, label: '100 characters' },
  { value: 200, label: '200 characters' },
];

export const MAX_CHECKPOINTS_OPTIONS = [
  { value: 20, label: '20 checkpoints' },
  { value: 50, label: '50 checkpoints' },
  { value: 100, label: '100 checkpoints' },
  { value: 200, label: '200 checkpoints' },
];

export const RETENTION_OPTIONS = [
  { value: 1, label: '1 day' },
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
];
