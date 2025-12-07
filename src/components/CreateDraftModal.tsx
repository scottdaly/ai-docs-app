import { useState } from 'react';
import { X, GitBranch, Loader2 } from 'lucide-react';

interface CreateDraftModalProps {
  onClose: () => void;
  onCreate: (name: string) => Promise<void>;
  isFromCheckpoint?: boolean;
}

export function CreateDraftModal({ onClose, onCreate, isFromCheckpoint }: CreateDraftModalProps) {
  const [name, setName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isCreating) return;

    setIsCreating(true);
    try {
      await onCreate(name.trim());
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background border rounded-lg shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <GitBranch size={18} className="text-purple-500" />
            <h2 className="font-semibold">Create New Draft</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-muted transition-colors"
            disabled={isCreating}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label htmlFor="draft-name" className="block text-sm font-medium mb-1.5">
              Draft Name
            </label>
            <input
              id="draft-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 50))}
              placeholder="e.g., Shorter intro, New ending..."
              className="w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              maxLength={50}
              autoFocus
              disabled={isCreating}
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              {isFromCheckpoint
                ? 'This draft will be created from the selected version.'
                : 'This draft will start with your current document content.'}
            </p>
          </div>

          <div className="bg-muted/30 rounded-md p-3 text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-1">What are drafts?</p>
            <p>
              Drafts let you experiment with changes without affecting your main document.
              You can create multiple drafts, switch between them, and apply the best one when ready.
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded border hover:bg-muted transition-colors"
              disabled={isCreating}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || isCreating}
              className="px-4 py-2 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isCreating ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Draft'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
