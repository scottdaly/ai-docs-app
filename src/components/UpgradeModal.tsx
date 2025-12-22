import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {
  RiCloseLine,
  RiLoader4Line,
  RiCheckLine,
  RiSparklingLine,
  RiInfinityFill,
  RiRobot2Line,
  RiCloudLine,
} from '@remixicon/react';
import { useAuthStore } from '../store/useAuthStore';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const FEATURES = [
  {
    icon: RiInfinityFill,
    title: 'Unlimited AI Queries',
    description: 'No monthly limits on AI chat, inline editing, or document agents',
  },
  {
    icon: RiRobot2Line,
    title: 'Premium AI Models',
    description: 'Access GPT-5.2, Claude Opus 4.5, Claude Sonnet 4.5, and Gemini 3 Pro',
  },
  {
    icon: RiCloudLine,
    title: 'Cloud Sync',
    description: 'Securely sync your documents across devices with end-to-end encryption',
  },
];

export function UpgradeModal({ isOpen, onClose }: UpgradeModalProps) {
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>('yearly');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { subscription } = useAuthStore();

  const handleUpgrade = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await window.electronAPI.subscription.createCheckout(
        billingInterval,
        `${window.location.origin}/upgrade/success`,
        `${window.location.origin}/upgrade/cancel`
      );

      if (result.url) {
        // Open Stripe Checkout in default browser
        window.electronAPI.openExternal(result.url);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to start upgrade process');
    } finally {
      setIsLoading(false);
    }
  };

  const isPremium = subscription?.tier === 'premium';

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg">
          <div className="bg-background border border-border rounded-xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="relative bg-gradient-to-br from-violet-600 to-indigo-600 px-6 py-8 text-white">
              <Dialog.Close asChild>
                <button
                  className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-white/20 transition-colors"
                  aria-label="Close"
                >
                  <RiCloseLine size={20} />
                </button>
              </Dialog.Close>

              <div className="flex items-center gap-3 mb-2">
                <RiSparklingLine size={28} />
                <Dialog.Title className="text-2xl font-bold">
                  Upgrade to Premium
                </Dialog.Title>
              </div>
              <Dialog.Description className="text-white/80">
                Unlock unlimited AI queries and premium features
              </Dialog.Description>
            </div>

            {/* Content */}
            <div className="p-6">
              {/* Billing Toggle */}
              <div className="flex items-center justify-center gap-2 mb-6">
                <button
                  onClick={() => setBillingInterval('monthly')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    billingInterval === 'monthly'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setBillingInterval('yearly')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                    billingInterval === 'yearly'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Yearly
                  <span className="bg-emerald-500 text-white text-xs px-1.5 py-0.5 rounded">
                    Save 25%
                  </span>
                </button>
              </div>

              {/* Price Display */}
              <div className="text-center mb-6">
                <div className="text-4xl font-bold">
                  {billingInterval === 'yearly' ? '$180' : '$20'}
                  <span className="text-lg font-normal text-muted-foreground">
                    /{billingInterval === 'yearly' ? 'year' : 'month'}
                  </span>
                </div>
                {billingInterval === 'yearly' && (
                  <div className="text-sm text-muted-foreground mt-1">
                    That's just $15/month, billed annually
                  </div>
                )}
              </div>

              {/* Features List */}
              <div className="space-y-4 mb-6">
                {FEATURES.map((feature, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <feature.icon size={18} className="text-primary" />
                    </div>
                    <div>
                      <div className="font-medium">{feature.title}</div>
                      <div className="text-sm text-muted-foreground">{feature.description}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Error Display */}
              {error && (
                <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
                  {error}
                </div>
              )}

              {/* CTA Button */}
              {isPremium ? (
                <div className="text-center p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                  <div className="flex items-center justify-center gap-2 text-emerald-500 font-medium">
                    <RiCheckLine size={20} />
                    You're already on Premium!
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleUpgrade}
                  disabled={isLoading}
                  className="w-full py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <RiLoader4Line size={20} className="animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <RiSparklingLine size={20} />
                      Upgrade Now
                    </>
                  )}
                </button>
              )}

              {/* Terms */}
              <p className="text-xs text-muted-foreground text-center mt-4">
                Cancel anytime. By upgrading, you agree to our Terms of Service.
              </p>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
