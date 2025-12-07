import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface RecentWorkspace {
  path: string;
  name: string;
  lastOpened: string;
}

interface RecentWorkspacesState {
  recentWorkspaces: RecentWorkspace[];
  maxRecent: number;
  addRecentWorkspace: (path: string) => void;
  removeRecentWorkspace: (path: string) => void;
  clearRecentWorkspaces: () => void;
}

export const useRecentWorkspaces = create<RecentWorkspacesState>()(
  persist(
    (set, get) => ({
      recentWorkspaces: [],
      maxRecent: 5,

      addRecentWorkspace: (path: string) => {
        const { recentWorkspaces, maxRecent } = get();

        // Extract folder name from path
        const name = path.split(/[/\\]/).pop() || path;

        // Remove if already exists (will re-add at top)
        const filtered = recentWorkspaces.filter(w => w.path !== path);

        // Add to front of list
        const updated: RecentWorkspace[] = [
          { path, name, lastOpened: new Date().toISOString() },
          ...filtered,
        ].slice(0, maxRecent);

        set({ recentWorkspaces: updated });
      },

      removeRecentWorkspace: (path: string) => {
        const { recentWorkspaces } = get();
        set({
          recentWorkspaces: recentWorkspaces.filter(w => w.path !== path),
        });
      },

      clearRecentWorkspaces: () => {
        set({ recentWorkspaces: [] });
      },
    }),
    {
      name: 'midlight-recent-workspaces',
    }
  )
);
