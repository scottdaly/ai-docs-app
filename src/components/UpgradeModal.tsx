import { useState, useEffect, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {
  RiCloseLine,
  RiLoader4Line,
  RiCheckLine,
} from '@remixicon/react';
import { useAuthStore } from '../store/useAuthStore';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRO_FEATURES = [
  'Unlimited AI queries',
  'Advanced AI models',
  'Priority support',
  'Early access to new features',
];

const PREMIUM_FEATURES = [
  'Everything in Pro',
  'Higher rate limits',
  'Team collaboration',
  'Dedicated support',
];

type PlanType = 'pro' | 'premium';

export function UpgradeModal({ isOpen, onClose }: UpgradeModalProps) {
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>('monthly');
  const [isLoading, setIsLoading] = useState<PlanType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const checkoutInitiated = useRef(false);

  const { subscription, fetchSubscription, fetchQuota } = useAuthStore();

  // Refresh subscription when window regains focus after checkout
  useEffect(() => {
    const handleFocus = () => {
      if (checkoutInitiated.current) {
        // User returned from checkout - refresh subscription status
        fetchSubscription();
        fetchQuota();
        checkoutInitiated.current = false;
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [fetchSubscription, fetchQuota]);

  // Refresh subscription when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchSubscription();
    }
  }, [isOpen, fetchSubscription]);

  const handleUpgrade = async (plan: PlanType) => {
    setIsLoading(plan);
    setError(null);

    const priceType = `${plan}_${billingInterval === 'monthly' ? 'monthly' : 'yearly'}` as const;

    try {
      const result = await window.electronAPI.subscription.createCheckout(
        priceType,
        'https://midlight.ai/checkout/success',
        'https://midlight.ai/checkout/cancel'
      );

      if (result.url) {
        checkoutInitiated.current = true;
        window.electronAPI.openExternal(result.url);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to start upgrade process');
    } finally {
      setIsLoading(null);
    }
  };

  const currentTier = subscription?.tier || 'free';
  const isPro = currentTier === 'pro';
  const isPremium = currentTier === 'premium';

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl">
          <div className="bg-background border border-border rounded-xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="relative px-6 pt-8 pb-6">
              <Dialog.Close asChild>
                <button
                  className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-muted transition-colors"
                  aria-label="Close"
                >
                  <RiCloseLine size={20} />
                </button>
              </Dialog.Close>

              <Dialog.Title className="text-4xl font-bold text-center tracking-tight">
                Pricing Plans
              </Dialog.Title>
              <Dialog.Description className="text-muted-foreground text-center mt-2">
                Unlock unlimited AI queries with a plan built for your needs.
              </Dialog.Description>

              {/* Billing Toggle */}
              <div className="flex items-center justify-center gap-1 mt-6 p-1 bg-muted rounded-lg w-fit mx-auto">
                <button
                  onClick={() => setBillingInterval('monthly')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    billingInterval === 'monthly'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setBillingInterval('yearly')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    billingInterval === 'yearly'
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Annual
                </button>
              </div>
            </div>

            {/* Plan Cards */}
            <div className="px-6 pb-6">
              <div className="grid grid-cols-2 gap-4">
                {/* Pro Plan */}
                <div className={`rounded-xl p-5 border ${
                  isPro
                    ? 'border-violet-500 bg-violet-500/5'
                    : 'border-border bg-card'
                }`}>
                  <div className="flex items-center gap-2 mb-4">
                    <h3 className="text-2xl font-semibold">Pro</h3>
                    <span className="ml-auto text-xs bg-foreground/10 text-foreground/70 px-2 py-0.5 rounded-md">
                      Popular
                    </span>
                  </div>

                  <div className="mb-2">
                    <span className="text-base text-muted-foreground align-top">$</span>
                    <span className="text-5xl font-bold tracking-tight">
                      {billingInterval === 'yearly' ? '180' : '20'}
                    </span>
                    <span className="text-muted-foreground text-sm ml-1">
                      USD / {billingInterval === 'yearly' ? 'year' : 'month'}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-sm mb-4">
                    {billingInterval === 'yearly' ? '$15/month billed annually' : 'Unlock the full experience'}
                  </p>

                  <ul className="space-y-2 mb-5">
                    {PRO_FEATURES.map((feature, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <RiCheckLine size={16} className="text-foreground/70 flex-shrink-0" />
                        <span className="text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {isPro ? (
                    <div className="text-center py-2.5 bg-violet-500/10 rounded-lg text-sm font-medium text-violet-400">
                      Current Plan
                    </div>
                  ) : isPremium ? (
                    <div className="text-center py-2.5 text-sm text-muted-foreground">
                      Downgrade via billing portal
                    </div>
                  ) : (
                    <button
                      onClick={() => handleUpgrade('pro')}
                      disabled={isLoading !== null}
                      className="w-full py-2.5 bg-foreground hover:bg-foreground/90 text-background font-medium rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isLoading === 'pro' ? (
                        <>
                          <RiLoader4Line size={18} className="animate-spin" />
                          Processing...
                        </>
                      ) : (
                        'Upgrade to Pro'
                      )}
                    </button>
                  )}
                </div>

                {/* Premium Plan */}
                <div className={`rounded-xl p-5 border ${
                  isPremium
                    ? 'border-amber-500 bg-amber-500/5'
                    : 'border-border bg-card'
                }`}>
                  <div className="flex items-center gap-2 mb-4">
                    <h3 className="text-2xl font-semibold">Premium</h3>
                  </div>

                  <div className="mb-2">
                    <span className="text-base text-muted-foreground align-top">$</span>
                    <span className="text-5xl font-bold tracking-tight">
                      {billingInterval === 'yearly' ? '2,000' : '200'}
                    </span>
                    <span className="text-muted-foreground text-sm ml-1">
                      USD / {billingInterval === 'yearly' ? 'year' : 'month'}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-sm mb-4">
                    {billingInterval === 'yearly' ? '$167/month billed annually' : 'Maximize your productivity'}
                  </p>

                  <ul className="space-y-2 mb-5">
                    {PREMIUM_FEATURES.map((feature, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <RiCheckLine size={16} className="text-foreground/70 flex-shrink-0" />
                        <span className="text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {isPremium ? (
                    <div className="text-center py-2.5 bg-amber-500/10 rounded-lg text-sm font-medium text-amber-400">
                      Current Plan
                    </div>
                  ) : (
                    <button
                      onClick={() => handleUpgrade('premium')}
                      disabled={isLoading !== null}
                      className="w-full py-2.5 bg-foreground hover:bg-foreground/90 text-background font-medium rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isLoading === 'premium' ? (
                        <>
                          <RiLoader4Line size={18} className="animate-spin" />
                          Processing...
                        </>
                      ) : (
                        'Upgrade to Premium'
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Error Display */}
              {error && (
                <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
                  {error}
                </div>
              )}

              {/* Terms */}
              <p className="text-xs text-muted-foreground text-center mt-5">
                Cancel anytime. By upgrading, you agree to our Terms of Service.
              </p>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
