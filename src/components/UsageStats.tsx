import { useEffect, useState } from 'react';
import { RiLoader4Line, RiSparklingLine } from '@remixicon/react';
import { useAuthStore } from '../store/useAuthStore';

interface UsageStatsProps {
  onUpgradeClick?: () => void;
}

export function UsageStats({ onUpgradeClick }: UsageStatsProps) {
  const { quota, subscription, fetchQuota } = useAuthStore();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Refresh quota on mount
  useEffect(() => {
    fetchQuota();
  }, [fetchQuota]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchQuota();
    setIsRefreshing(false);
  };

  if (!quota) {
    return (
      <div className="flex items-center justify-center py-8">
        <RiLoader4Line size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isPaidUser = subscription?.tier === 'premium' || subscription?.tier === 'pro';
  const limit = quota.limit ?? 0;
  const used = quota.used ?? 0;
  const remaining = quota.remaining ?? 0;
  const percentage = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;

  // Determine color based on usage
  const getProgressColor = () => {
    if (isPaidUser) return 'bg-primary';
    if (percentage >= 90) return 'bg-destructive';
    if (percentage >= 75) return 'bg-amber-500';
    return 'bg-primary';
  };

  // Get the reset date (first of next month)
  const getResetDate = () => {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return nextMonth.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  };

  return (
    <div className="space-y-4">
      {/* Usage Meter */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">AI Queries Used</span>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            {isRefreshing ? (
              <RiLoader4Line size={12} className="animate-spin" />
            ) : (
              'Refresh'
            )}
          </button>
        </div>

        {isPaidUser ? (
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full w-1/4" />
            </div>
            <span className="text-sm font-medium text-primary">Unlimited</span>
          </div>
        ) : (
          <>
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${getProgressColor()}`}
                style={{ width: `${percentage}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">
                {used} / {limit} queries
              </span>
              <span className="text-muted-foreground">
                {remaining} remaining
              </span>
            </div>
          </>
        )}
      </div>

      {/* Reset Date (for free users) */}
      {!isPaidUser && (
        <p className="text-xs text-muted-foreground">
          Resets on {getResetDate()}
        </p>
      )}

      {/* Usage Warning */}
      {!isPaidUser && percentage >= 75 && (
        <div className={`p-3 rounded-lg text-sm ${
          percentage >= 90
            ? 'bg-destructive/10 text-destructive'
            : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
        }`}>
          {percentage >= 90 ? (
            <p>You're almost out of queries. Upgrade for unlimited access.</p>
          ) : (
            <p>You've used {Math.round(percentage)}% of your monthly quota.</p>
          )}
        </div>
      )}

      {/* Upgrade CTA (for free users) */}
      {!isPaidUser && onUpgradeClick && (
        <button
          onClick={onUpgradeClick}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-sm font-medium rounded-lg transition-all"
        >
          <RiSparklingLine size={16} />
          Upgrade
        </button>
      )}
    </div>
  );
}

/**
 * Compact usage indicator for use in headers/toolbars
 */
export function UsageIndicator({ onClick }: { onClick?: () => void }) {
  const { quota, subscription } = useAuthStore();

  if (!quota) return null;

  const isPremium = subscription?.tier === 'premium';
  const isPro = subscription?.tier === 'pro';
  const isPaidUser = isPremium || isPro;
  const limit = quota.limit ?? 0;
  const used = quota.used ?? 0;
  const percentage = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;

  if (isPaidUser) {
    return (
      <button
        onClick={onClick}
        className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded-md hover:opacity-80 transition-colors ${
          isPremium
            ? 'bg-amber-500/10 text-amber-500'
            : 'bg-violet-500/10 text-violet-500'
        }`}
      >
        <RiSparklingLine size={12} />
        {isPremium ? 'Premium' : 'Pro'}
      </button>
    );
  }

  const getColor = () => {
    if (percentage >= 90) return 'text-destructive bg-destructive/10';
    if (percentage >= 75) return 'text-amber-600 dark:text-amber-400 bg-amber-500/10';
    return 'text-muted-foreground bg-muted';
  };

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded-md hover:opacity-80 transition-opacity ${getColor()}`}
    >
      {used}/{limit}
    </button>
  );
}
