import { useState, useEffect, useRef } from 'react';
import { RiSearchLine } from '@remixicon/react';
import { SearchDropdown } from './SearchDropdown';

// Platform detection
const isMac = typeof window !== 'undefined' && window.electronAPI?.platform === 'darwin';

export function SearchBar() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Global keyboard shortcut (Cmd/Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => inputRef.current?.focus(), 10);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleFocus = () => {
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    setQuery('');
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      handleClose();
    }
  };

  return (
    <div ref={containerRef} className="app-region-no-drag relative">
      <div className={`flex items-center gap-2 w-80 px-3 py-1 rounded-lg border transition-colors ${
        isOpen
          ? 'bg-background border-foreground/30 shadow-md'
          : 'bg-muted/50 hover:bg-muted/70 border-foreground/20'
      }`}>
        <RiSearchLine size={14} className="text-muted-foreground shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder="Search..."
          className="flex-1 bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground"
        />
        <kbd className="text-xs text-muted-foreground/70 bg-muted/50 px-1.5 py-0.5 rounded shrink-0">
          {isMac ? '⌘K' : 'Ctrl+K'}
        </kbd>
      </div>

      <SearchDropdown
        open={isOpen}
        query={query}
        onClose={handleClose}
        inputRef={inputRef}
      />
    </div>
  );
}
