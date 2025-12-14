import { useState, useEffect, useRef } from 'react';
import { X, Save, Loader2 } from 'lucide-react';

interface SaveSnapshotModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (name: string, description?: string) => Promise<void>;
  isSaving: boolean;
}

export function SaveSnapshotModal({
  open,
  onOpenChange,
  onSave,
  isSaving,
}: SaveSnapshotModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Focus the name input when modal opens
  useEffect(() => {
    if (open) {
      // Small delay to ensure modal is rendered
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 50);
    }
  }, [open]);

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setName('');
      setDescription('');
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSaving) return;
    await onSave(name.trim(), description.trim() || undefined);
  };

  const handleClose = () => {
    if (!isSaving) {
      onOpenChange(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background border rounded-lg shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Save size={20} className="text-primary" />
            <h2 className="font-semibold text-lg">Create Snapshot</h2>
          </div>
          <button
            onClick={handleClose}
            disabled={isSaving}
            className="p-2 rounded hover:bg-muted transition-colors disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label htmlFor="snapshot-name" className="block text-sm font-medium mb-1.5">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              ref={nameInputRef}
              id="snapshot-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 50))}
              placeholder="e.g., Before major rewrite"
              className="w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
              maxLength={50}
              disabled={isSaving}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {name.length}/50 characters
            </p>
          </div>

          <div>
            <label htmlFor="snapshot-description" className="block text-sm font-medium mb-1.5">
              Description <span className="text-muted-foreground">(optional)</span>
            </label>
            <textarea
              id="snapshot-description"
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 200))}
              placeholder="Add notes about this version..."
              rows={3}
              className="w-full px-3 py-2 border rounded-md bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
              maxLength={200}
              disabled={isSaving}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {description.length}/200 characters
            </p>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSaving}
              className="px-4 py-2 rounded-md border hover:bg-muted transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || isSaving}
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={16} />
                  Save Snapshot
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
