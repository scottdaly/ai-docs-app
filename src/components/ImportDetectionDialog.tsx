import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { FolderOpen, Sparkles, Settings, FileText } from 'lucide-react';
import appIcon from '../../build/icon.png';

export type DetectedSourceType = 'obsidian' | 'notion' | 'midlight' | 'generic';

interface ImportDetectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderPath: string;
  folderName: string;
  detectedType: DetectedSourceType;
  onQuickImport: () => void;
  onCustomizeImport: () => void;
  onOpenWithoutImport: () => void;
}

export function ImportDetectionDialog({
  open,
  onOpenChange,
  folderPath,
  folderName,
  detectedType,
  onQuickImport,
  onCustomizeImport,
  onOpenWithoutImport,
}: ImportDetectionDialogProps) {
  const getSourceInfo = () => {
    switch (detectedType) {
      case 'obsidian':
        return {
          title: 'Obsidian Vault Detected',
          description: `"${folderName}" appears to be an Obsidian vault.`,
          color: 'text-purple-500',
          bgColor: 'bg-purple-500/10',
        };
      case 'notion':
        return {
          title: 'Notion Export Detected',
          description: `"${folderName}" appears to be a Notion export.`,
          color: 'text-orange-500',
          bgColor: 'bg-orange-500/10',
        };
      case 'midlight':
        return {
          title: 'Midlight Workspace',
          description: `"${folderName}" is already a Midlight workspace.`,
          color: 'text-primary',
          bgColor: 'bg-primary/10',
        };
      default:
        return {
          title: 'Open Folder',
          description: `Open "${folderName}" as a workspace.`,
          color: 'text-muted-foreground',
          bgColor: 'bg-muted',
        };
    }
  };

  const sourceInfo = getSourceInfo();

  // For midlight or generic folders, just open directly
  if (detectedType === 'midlight' || detectedType === 'generic') {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <img src={appIcon} alt="Midlight" className="w-6 h-6 rounded" />
              {sourceInfo.title}
            </DialogTitle>
            <DialogDescription>{sourceInfo.description}</DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
              <FolderOpen size={20} className="text-muted-foreground" />
              <span className="truncate text-sm">{folderPath}</span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={onOpenWithoutImport}>
              Open Workspace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // For Obsidian or Notion, show import options
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <img src={appIcon} alt="Midlight" className="w-6 h-6 rounded" />
            {sourceInfo.title}
          </DialogTitle>
          <DialogDescription>{sourceInfo.description}</DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg mb-4">
            <FolderOpen size={20} className="text-muted-foreground" />
            <span className="truncate text-sm">{folderPath}</span>
          </div>

          <p className="text-sm text-muted-foreground mb-4">
            Would you like to import this {detectedType === 'obsidian' ? 'vault' : 'export'} to convert it for Midlight?
          </p>

          <div className="space-y-2">
            <button
              onClick={onQuickImport}
              className="w-full flex items-center gap-4 p-4 rounded-lg border border-primary bg-primary/5 hover:bg-primary/10 transition-colors text-left group"
            >
              <div className={`w-10 h-10 rounded-lg ${sourceInfo.bgColor} flex items-center justify-center ${sourceInfo.color}`}>
                <Sparkles size={20} />
              </div>
              <div className="flex-1">
                <div className="font-medium text-foreground flex items-center gap-2">
                  Quick Import
                  <span className="text-xs px-2 py-0.5 bg-primary/20 text-primary rounded-full">
                    Recommended
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Import with optimal settings
                </div>
              </div>
            </button>

            <button
              onClick={onCustomizeImport}
              className="w-full flex items-center gap-4 p-4 rounded-lg border border-border hover:bg-accent/50 transition-colors text-left group"
            >
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-muted-foreground group-hover:bg-accent transition-colors">
                <Settings size={20} />
              </div>
              <div className="flex-1">
                <div className="font-medium text-foreground">Customize Import</div>
                <div className="text-xs text-muted-foreground">
                  Choose which options to apply
                </div>
              </div>
            </button>

            <button
              onClick={onOpenWithoutImport}
              className="w-full flex items-center gap-4 p-3 rounded-lg hover:bg-accent/50 transition-colors text-left group"
            >
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground">
                <FileText size={18} />
              </div>
              <div className="flex-1">
                <div className="text-sm text-muted-foreground">
                  Open without importing
                </div>
                <div className="text-xs text-muted-foreground/70">
                  Files will be treated as plain markdown
                </div>
              </div>
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
