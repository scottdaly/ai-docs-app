import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
} from './ui/alert-dialog';
import appIcon from '../../build/icon.png';

interface UndoConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  fileName: string;
  operationType: 'copy' | 'move' | 'delete';
}

export function UndoConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  fileName,
  operationType,
}: UndoConfirmDialogProps) {
  const actionName = operationType === 'copy' ? 'Paste' : operationType === 'move' ? 'Move' : 'Delete';

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-[280px] rounded-xl bg-popover/95 backdrop-blur-xl border-border/50 p-6">
        <div className="flex flex-col items-center text-center gap-4">
          <img
            src={appIcon}
            alt="Midlight"
            className="w-16 h-16 rounded-xl"
          />
          <AlertDialogDescription className="text-foreground text-sm">
            Would you like to undo '{actionName} {fileName}'?
          </AlertDialogDescription>
        </div>
        <AlertDialogFooter className="flex-row justify-center gap-2 mt-4">
          <AlertDialogCancel className="flex-1 h-8 text-sm rounded-md bg-muted hover:bg-muted/80 border-0">
            No
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="flex-1 h-8 text-sm rounded-md"
          >
            Yes
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
