import { Folder, File, ChevronRight, ChevronDown, Settings } from 'lucide-react';
import { useFileSystem } from '../store/useFileSystem';
import { useSettingsStore } from '../store/useSettingsStore';
import { useState } from 'react';
import { FileNode } from '../shared/types';

interface FileTreeItemProps {
  node: FileNode;
  level?: number;
}

function FileTreeItem({ node, level = 0 }: FileTreeItemProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { loadSubDirectory, openFile, activeFilePath } = useFileSystem();
  const paddingLeft = `${level * 12 + 12}px`;

  const isActive = activeFilePath === node.path;

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (node.type === 'directory') {
        if (!isOpen && !node.children) {
            await loadSubDirectory(node.path);
        }
        setIsOpen(!isOpen);
    } else {
        await openFile(node);
    }
  };
  
  return (
    <div>
      <div 
        className={`flex items-center py-1 px-2 hover:bg-accent/50 cursor-pointer text-sm select-none ${isActive ? 'bg-accent text-accent-foreground' : 'text-foreground/90'}`}
        style={{ paddingLeft }}
        onClick={handleClick}
      >
        <span className={`mr-1 ${isActive ? 'text-accent-foreground/70' : 'text-foreground/50'}`}>
            {node.type === 'directory' ? (
                isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />
            ) : <span className="w-3.5 inline-block" />}
        </span>
        <span className={`mr-2 ${isActive ? 'text-accent-foreground/80' : 'text-foreground/70'}`}>
          {node.type === 'directory' ? <Folder size={14} /> : <File size={14} />}
        </span>
        <span className="truncate">{node.name}</span>
      </div>
      {isOpen && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeItem key={child.path} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const { files, rootDir, loadDir } = useFileSystem();
  const { openSettings } = useSettingsStore();

  const handleOpenFolder = async () => {
    const path = await window.electronAPI.selectDirectory();
    if (path) {
      await loadDir(path);
    }
  };

  return (
    <div className="w-64 border-r bg-muted/10 flex flex-col h-full">
      <div className="p-3 border-b">
         <button 
           onClick={handleOpenFolder}
           className="text-xs font-medium hover:bg-accent px-2 py-1 rounded w-full text-left truncate flex items-center gap-2"
           title={rootDir || "Select a folder"}
         >
           <Folder size={14} className="shrink-0" />
           <span className="truncate">{rootDir ? rootDir.split('/').pop() : 'Open Workspace...'}</span>
         </button>
      </div>
      <div className="flex-1 overflow-auto py-2">
        {files.map((file) => (
          <FileTreeItem key={file.path} node={file} />
        ))}
        {files.length === 0 && rootDir && (
            <div className="text-center text-muted-foreground text-xs mt-4">Empty folder</div>
        )}
      </div>
      <div className="p-2 border-t">
        <button
            onClick={() => openSettings()}
            className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 px-2 py-1.5 rounded w-full transition-colors"
        >
            <Settings size={14} />
            <span>Settings</span>
        </button>
      </div>
    </div>
  );
}
