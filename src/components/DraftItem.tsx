import { useState } from 'react';
import { GitBranch, Check, Trash2, Edit3, MoreHorizontal, X } from 'lucide-react';

interface DraftItemProps {
  draft: DraftListItem;
  isActive: boolean;
  onOpen: () => void;
  onRename: (newName: string) => void;
  onApply: () => void;
  onDiscard: () => void;
  onDelete: () => void;
}

export function DraftItem({
  draft,
  isActive,
  onOpen,
  onRename,
  onApply,
  onDiscard,
  onDelete,
}: DraftItemProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [nameInput, setNameInput] = useState(draft.name);
  const [showMenu, setShowMenu] = useState(false);

  const timeAgo = formatTimeAgo(new Date(draft.modified));

  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (nameInput.trim() && nameInput !== draft.name) {
      onRename(nameInput.trim());
    }
    setIsRenaming(false);
  };

  const handleRenameCancel = () => {
    setNameInput(draft.name);
    setIsRenaming(false);
  };

  return (
    <div
      className={`
        border rounded-lg p-3 cursor-pointer transition-all relative
        ${isActive
          ? 'border-purple-500 bg-purple-500/10 ring-1 ring-purple-500'
          : 'border-border hover:border-purple-500/50 hover:bg-muted/30'}
      `}
      onClick={() => !isRenaming && onOpen()}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <GitBranch
            size={14}
            className={`shrink-0 ${isActive ? 'text-purple-500' : 'text-muted-foreground'}`}
          />
          <div className="min-w-0 flex-1">
            {isRenaming ? (
              <form onSubmit={handleRenameSubmit} className="flex gap-1">
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value.slice(0, 50))}
                  placeholder="Draft name..."
                  className="text-sm px-1.5 py-0.5 border rounded bg-background w-full"
                  maxLength={50}
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') handleRenameCancel();
                  }}
                />
                <button
                  type="submit"
                  className="text-xs px-1.5 py-0.5 bg-primary text-primary-foreground rounded"
                  onClick={(e) => e.stopPropagation()}
                >
                  Save
                </button>
              </form>
            ) : (
              <span className="text-sm font-medium truncate block">
                {draft.name}
              </span>
            )}
          </div>
        </div>

        {/* Actions menu */}
        {!isRenaming && (
          <div className="relative shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            >
              <MoreHorizontal size={14} />
            </button>

            {showMenu && (
              <>
                {/* Backdrop */}
                <div
                  className="fixed inset-0 z-10"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(false);
                  }}
                />

                {/* Menu */}
                <div className="absolute right-0 top-full mt-1 z-20 bg-background border rounded-lg shadow-lg py-1 min-w-[140px]">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      setIsRenaming(true);
                    }}
                    className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted flex items-center gap-2"
                  >
                    <Edit3 size={14} />
                    Rename
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      onApply();
                    }}
                    className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted flex items-center gap-2 text-green-600"
                  >
                    <Check size={14} />
                    Apply to main
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      onDiscard();
                    }}
                    className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted flex items-center gap-2 text-orange-600"
                  >
                    <X size={14} />
                    Discard
                  </button>
                  <hr className="my-1 border-border" />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMenu(false);
                      onDelete();
                    }}
                    className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted flex items-center gap-2 text-destructive"
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Meta */}
      <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
        <span>{timeAgo}</span>
        <span>{draft.wordCount.toLocaleString()} words</span>
      </div>

      {/* Active indicator */}
      {isActive && (
        <div className="mt-2 text-xs text-purple-600 font-medium">
          Currently editing
        </div>
      )}
    </div>
  );
}

/**
 * Format a date as a relative time string.
 */
function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) {
    return 'just now';
  } else if (diffMins < 60) {
    return `${diffMins}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString();
  }
}
