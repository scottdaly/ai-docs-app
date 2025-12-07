import { useState, useCallback, useRef, useEffect } from 'react';
import { FolderOpen } from 'lucide-react';

interface DropZoneProps {
  children: React.ReactNode;
  onFolderDrop: (path: string) => void;
  disabled?: boolean;
}

export function DropZone({ children, onFolderDrop, disabled = false }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (disabled) return;

    dragCounter.current++;
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setIsDragging(false);
    dragCounter.current = 0;

    if (disabled) return;

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      // In Electron, dropped folders have a path property
      // We need to use the webkitGetAsEntry to check if it's a directory
      const items = e.dataTransfer.items;
      if (items && items.length > 0) {
        const item = items[0];
        const entry = item.webkitGetAsEntry?.();
        if (entry?.isDirectory) {
          // Get the path from the File object (Electron adds this)
          const filePath = (file as any).path;
          if (filePath) {
            onFolderDrop(filePath);
          }
        }
      }
    }
  }, [disabled, onFolderDrop]);

  // Reset drag counter when component unmounts or when drag ends unexpectedly
  useEffect(() => {
    const handleWindowDragEnd = () => {
      setIsDragging(false);
      dragCounter.current = 0;
    };

    window.addEventListener('dragend', handleWindowDragEnd);
    return () => window.removeEventListener('dragend', handleWindowDragEnd);
  }, []);

  return (
    <div
      className="relative h-full"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {children}

      {/* Drop Overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-primary/10 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="bg-background border-2 border-dashed border-primary rounded-xl p-8 shadow-2xl">
            <div className="flex flex-col items-center gap-4 text-primary">
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                <FolderOpen size={32} />
              </div>
              <div className="text-center">
                <div className="font-semibold text-lg">Drop folder here</div>
                <div className="text-sm text-muted-foreground mt-1">
                  Release to open or import
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
