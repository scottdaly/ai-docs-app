import { RiSearchLine } from '@remixicon/react';

export function SearchBar() {
  return (
    <div className="app-region-no-drag">
      <button
        className="flex items-center gap-2 w-64 px-3 py-1.5 bg-muted/50 hover:bg-muted/70 rounded-lg border border-border transition-colors cursor-pointer"
        onClick={() => {
          // TODO: Wire up command palette / search modal
          console.log('Search clicked');
        }}
      >
        <RiSearchLine size={14} className="text-muted-foreground" />
        <span className="text-sm text-muted-foreground flex-1 text-left">Search...</span>
        <kbd className="text-xs text-muted-foreground/70 bg-muted/50 px-1.5 py-0.5 rounded">
          ⌘K
        </kbd>
      </button>
    </div>
  );
}
