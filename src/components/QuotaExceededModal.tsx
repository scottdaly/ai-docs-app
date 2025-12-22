import * as Dialog from '@radix-ui/react-dialog';
import {
  RiCloseLine,
  RiSparklingLine,
  RiTimeLine,
  RiAlertLine,
} from '@remixicon/react';
import { useAuthStore } from '../store/useAuthStore';

interface QuotaExceededModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpgrade: () => void;
}

export function QuotaExceededModal({
  isOpen,
  onClose,
  onUpgrade,
}: QuotaExceededModalProps) {
  const { quota } = useAuthStore();

  // Get the reset date (first of next month)
  const getResetDate = () => {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return nextMonth.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  };

  // Calculate days until reset
  const getDaysUntilReset = () => {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const diffTime = nextMonth.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const daysRemaining = getDaysUntilReset();

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md">
          <div className="bg-background border border-border rounded-xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="relative bg-gradient-to-br from-amber-500 to-orange-500 px-6 py-6 text-white">
              <Dialog.Close asChild>
                <button
                  className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-white/20 transition-colors"
                  aria-label="Close"
                >
                  <RiCloseLine size={20} />
                </button>
              </Dialog.Close>

              <div className="flex items-center gap-3 mb-2">
                <RiAlertLine size={28} />
                <Dialog.Title className="text-xl font-bold">
                  Monthly Quota Reached
                </Dialog.Title>
              </div>
              <Dialog.Description className="text-white/80">
                You've used all {quota?.limit ?? 100} AI queries for this month
              </Dialog.Description>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Reset Info */}
              <div className="flex items-start gap-4 p-4 bg-muted/50 rounded-lg">
                <RiTimeLine size={24} className="text-muted-foreground flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Quota resets on {getResetDate()}</p>
                  <p className="text-sm text-muted-foreground">
                    {daysRemaining} day{daysRemaining !== 1 ? 's' : ''} remaining
                  </p>
                </div>
              </div>

              {/* Upgrade Option */}
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Need more AI queries? Upgrade to Premium for unlimited access to all AI features.
                </p>

                <button
                  onClick={() => {
                    onClose();
                    onUpgrade();
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium rounded-lg transition-all"
                >
                  <RiSparklingLine size={18} />
                  Upgrade to Premium - $20/mo
                </button>
              </div>

              {/* Alternative */}
              <div className="text-center">
                <button
                  onClick={onClose}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Remind me later
                </button>
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
