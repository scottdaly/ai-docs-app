import { X } from 'lucide-react';
import { useFileSystem } from '../store/useFileSystem';

export function TabBar() {
  const { openFiles, activeFilePath, selectFile, closeFile } = useFileSystem();

  if (openFiles.length === 0) return null;

  return (
    <div className="flex items-center border-b bg-background overflow-x-auto scrollbar-hide">
      {openFiles.map((file) => {
        const isActive = file.path === activeFilePath;
        return (
          <div
            key={file.path}
            onClick={() => selectFile(file.path)}
            className={`
              flex items-center min-w-[120px] max-w-[200px] h-9 px-3 border-r text-sm select-none cursor-pointer group
              ${isActive ? 'bg-background text-foreground font-medium' : 'bg-muted/30 text-muted-foreground hover:bg-muted/50'}
            `}
          >
            <span className="truncate flex-1">{file.name}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeFile(file.path);
              }}
              className={`ml-2 p-0.5 rounded-sm hover:bg-muted-foreground/20 opacity-0 group-hover:opacity-100 ${isActive ? 'opacity-100' : ''}`}
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
