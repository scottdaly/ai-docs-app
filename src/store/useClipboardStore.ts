import { create } from 'zustand';

interface FileOperation {
  type: 'copy' | 'move' | 'delete';
  // For copy: sources are original paths, destinations are where they were copied to
  // For move: sources are original paths, destinations are where they were moved to
  // For delete: sources are the deleted paths, destinations is empty
  sources: string[];
  destinations: string[];
  timestamp: number;
}

interface ClipboardState {
  paths: string[];
  operation: 'copy' | 'cut' | null;
  undoStack: FileOperation[];
  copy: (paths: string[]) => void;
  cut: (paths: string[]) => void;
  clear: () => void;
  hasItems: () => boolean;
  pushUndo: (op: Omit<FileOperation, 'timestamp'>) => void;
  popUndo: () => FileOperation | null;
  peekUndo: () => FileOperation | null;
  canUndo: () => boolean;
}

const MAX_UNDO_STACK = 20;

export const useClipboardStore = create<ClipboardState>((set, get) => ({
  paths: [],
  operation: null,
  undoStack: [],

  copy: (paths: string[]) => {
    set({ paths, operation: 'copy' });
  },

  cut: (paths: string[]) => {
    set({ paths, operation: 'cut' });
  },

  clear: () => {
    set({ paths: [], operation: null });
  },

  hasItems: () => {
    return get().paths.length > 0 && get().operation !== null;
  },

  pushUndo: (op) => {
    set((state) => ({
      undoStack: [
        { ...op, timestamp: Date.now() },
        ...state.undoStack.slice(0, MAX_UNDO_STACK - 1),
      ],
    }));
  },

  popUndo: () => {
    const { undoStack } = get();
    if (undoStack.length === 0) return null;
    const [first, ...rest] = undoStack;
    set({ undoStack: rest });
    return first;
  },

  peekUndo: () => {
    const { undoStack } = get();
    if (undoStack.length === 0) return null;
    return undoStack[0];
  },

  canUndo: () => {
    return get().undoStack.length > 0;
  },
}));
