import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from './ui/alert-dialog';
import { ImportableFileIcon } from './icons/ImportableFileIcon';
import { Loader2, AlertTriangle } from 'lucide-react';

interface ImportConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  fileName: string;
  isImporting?: boolean;
  error?: string | null;
}

export function ImportConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  fileName,
  isImporting = false,
  error = null,
}: ImportConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-[320px] rounded-xl bg-popover/95 backdrop-blur-xl border-border/50 p-6">
        <AlertDialogTitle className="sr-only">Import File</AlertDialogTitle>
        <div className="flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 flex items-center justify-center">
            {error ? (
              <AlertTriangle size={48} className="text-destructive" />
            ) : (
              <ImportableFileIcon size={56} />
            )}
          </div>
          <AlertDialogDescription className="text-foreground text-sm">
            {error ? (
              <span className="text-destructive">
                Failed to import: {error}
              </span>
            ) : isImporting ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 size={14} className="animate-spin" />
                Importing {fileName}...
              </span>
            ) : (
              <>
                <span className="font-medium">{fileName}</span> cannot be edited directly.
                <br />
                Would you like to import it as a new document?
              </>
            )}
          </AlertDialogDescription>
        </div>
        <AlertDialogFooter className="flex-row justify-center gap-2 mt-4">
          {error ? (
            <AlertDialogCancel className="flex-1 h-8 text-sm rounded-md bg-muted hover:bg-muted/80 border-0">
              Close
            </AlertDialogCancel>
          ) : (
            <>
              <AlertDialogCancel
                className="flex-1 h-8 text-sm rounded-md bg-muted hover:bg-muted/80 border-0"
                disabled={isImporting}
              >
                Cancel
              </AlertDialogCancel>
              {/* Use a regular button instead of AlertDialogAction to prevent auto-close */}
              <button
                onClick={onConfirm}
                className="flex-1 h-8 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
                disabled={isImporting}
              >
                Import
              </button>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
