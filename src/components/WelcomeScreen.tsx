import { FolderOpen, Download, Clock, X } from 'lucide-react';
import { useRecentWorkspaces } from '../store/useRecentWorkspaces';
import appIcon from '../../build/icon.png';

interface WelcomeScreenProps {
  onOpenWorkspace: () => void;
  onImportObsidian: () => void;
  onImportNotion: () => void;
  onOpenRecentWorkspace: (path: string) => void;
}

export function WelcomeScreen({
  onOpenWorkspace,
  onImportObsidian,
  onImportNotion,
  onOpenRecentWorkspace,
}: WelcomeScreenProps) {
  const { recentWorkspaces, removeRecentWorkspace, clearRecentWorkspaces } = useRecentWorkspaces();

  return (
    <div className="flex-1 flex items-center justify-center bg-background">
      <div className="max-w-md w-full px-8 py-12">
        {/* Logo and Title */}
        <div className="text-center mb-10">
          <img
            src={appIcon}
            alt="Midlight"
            className="w-20 h-20 mx-auto mb-4 rounded-2xl shadow-lg"
          />
          <h1 className="text-2xl font-semibold text-foreground">Welcome to Midlight</h1>
          <p className="text-sm text-muted-foreground mt-2">
            A beautiful writing environment for your documents
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 mb-8">
          <button
            onClick={onOpenWorkspace}
            className="w-full flex items-center gap-4 p-4 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors text-left group"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary/20 transition-colors">
              <FolderOpen size={20} />
            </div>
            <div>
              <div className="font-medium text-foreground">Open Workspace</div>
              <div className="text-xs text-muted-foreground">Choose an existing folder</div>
            </div>
          </button>

          <button
            onClick={onImportObsidian}
            className="w-full flex items-center gap-4 p-4 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors text-left group"
          >
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-500 group-hover:bg-purple-500/20 transition-colors">
              <Download size={20} />
            </div>
            <div>
              <div className="font-medium text-foreground">Import from Obsidian</div>
              <div className="text-xs text-muted-foreground">Migrate your Obsidian vault</div>
            </div>
          </button>

          <button
            onClick={onImportNotion}
            className="w-full flex items-center gap-4 p-4 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors text-left group"
          >
            <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-500 group-hover:bg-orange-500/20 transition-colors">
              <Download size={20} />
            </div>
            <div>
              <div className="font-medium text-foreground">Import from Notion</div>
              <div className="text-xs text-muted-foreground">Import a Notion export</div>
            </div>
          </button>
        </div>

        {/* Drag-drop hint */}
        <div className="text-center text-xs text-muted-foreground mb-8">
          <span className="inline-flex items-center gap-1">
            or drag a folder here to get started
          </span>
        </div>

        {/* Recent Workspaces */}
        {recentWorkspaces.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Clock size={14} />
                <span>Recent Workspaces</span>
              </div>
              <button
                onClick={clearRecentWorkspaces}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                title="Clear recent workspaces"
              >
                Clear all
              </button>
            </div>
            <div className="space-y-1">
              {recentWorkspaces.map((workspace) => (
                <div
                  key={workspace.path}
                  className="group flex items-center gap-2 px-3 py-2 rounded-md hover:bg-accent/50 transition-colors"
                >
                  <button
                    onClick={() => onOpenRecentWorkspace(workspace.path)}
                    className="flex-1 text-left truncate text-sm text-foreground hover:text-primary transition-colors"
                    title={workspace.path}
                  >
                    {workspace.name}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeRecentWorkspace(workspace.path);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                    title="Remove from recent"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
