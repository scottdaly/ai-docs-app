import { useState, useEffect } from 'react';
import { RiCloseLine, RiSparklingLine, RiAlertLine } from '@remixicon/react';
import { useAuthStore } from '../store/useAuthStore';

interface QuotaWarningBannerProps {
  onUpgradeClick: () => void;
}

/**
 * Banner that appears when user is approaching their monthly quota limit.
 * Dismissable, but reappears when usage increases to next threshold.
 */
export function QuotaWarningBanner({ onUpgradeClick }: QuotaWarningBannerProps) {
  const { quota, subscription } = useAuthStore();
  const [dismissed, setDismissed] = useState(false);
  const [lastDismissedAt, setLastDismissedAt] = useState<number | null>(null);

  // Don't show for premium users
  if (subscription?.tier === 'premium') {
    return null;
  }

  // Don't show if no quota info
  if (!quota || quota.limit === null) {
    return null;
  }

  const percentage = Math.min((quota.used / quota.limit) * 100, 100);

  // Only show at 75%, 90%, and 100% thresholds
  const shouldShow = percentage >= 75;

  // Re-show if percentage increased to a new threshold since last dismissal
  useEffect(() => {
    if (lastDismissedAt !== null) {
      const lastPercentage = lastDismissedAt;
      // Crossed a new threshold
      if (
        (lastPercentage < 90 && percentage >= 90) ||
        (lastPercentage < 100 && percentage >= 100)
      ) {
        setDismissed(false);
      }
    }
  }, [percentage, lastDismissedAt]);

  if (!shouldShow || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    setLastDismissedAt(percentage);
  };

  const isAtLimit = percentage >= 100;
  const isNearLimit = percentage >= 90;

  return (
    <div
      className={`flex items-center gap-3 px-4 py-2.5 text-sm ${
        isAtLimit
          ? 'bg-destructive text-destructive-foreground'
          : isNearLimit
          ? 'bg-amber-500 text-white'
          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-b border-amber-500/20'
      }`}
    >
      <RiAlertLine size={18} className="flex-shrink-0" />

      <span className="flex-1">
        {isAtLimit ? (
          <>You've used all {quota.limit} AI queries this month.</>
        ) : isNearLimit ? (
          <>Only {quota.remaining} queries remaining this month.</>
        ) : (
          <>You've used {Math.round(percentage)}% of your monthly AI quota.</>
        )}
      </span>

      <button
        onClick={onUpgradeClick}
        className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-sm font-medium transition-colors ${
          isAtLimit || isNearLimit
            ? 'bg-white/20 hover:bg-white/30 text-white'
            : 'bg-amber-500 hover:bg-amber-600 text-white'
        }`}
      >
        <RiSparklingLine size={14} />
        Upgrade
      </button>

      <button
        onClick={handleDismiss}
        className={`p-1 rounded transition-colors ${
          isAtLimit || isNearLimit
            ? 'hover:bg-white/20'
            : 'hover:bg-amber-500/20'
        }`}
        aria-label="Dismiss"
      >
        <RiCloseLine size={18} />
      </button>
    </div>
  );
}
