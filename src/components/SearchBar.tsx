import { useState, useEffect } from 'react';
import { RiSearchLine } from '@remixicon/react';
import { SearchModal } from './SearchModal';

// Platform detection
const isMac = typeof window !== 'undefined' && window.electronAPI?.platform === 'darwin';

export function SearchBar() {
  const [isOpen, setIsOpen] = useState(false);

  // Global keyboard shortcut (Cmd/Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <>
      <div className="app-region-no-drag">
        <button
          className="flex items-center gap-2 w-80 px-3 py-1 bg-muted/50 hover:bg-muted/70 rounded-lg border border-foreground/20 transition-colors cursor-pointer"
          onClick={() => setIsOpen(true)}
        >
          <RiSearchLine size={14} className="text-muted-foreground" />
          <span className="text-sm text-muted-foreground flex-1 text-left">Search...</span>
          <kbd className="text-xs text-muted-foreground/70 bg-muted/50 px-1.5 py-0.5 rounded">
            {isMac ? '⌘K' : 'Ctrl+K'}
          </kbd>
        </button>
      </div>

      <SearchModal open={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
