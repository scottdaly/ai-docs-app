/**
 * Feature Gates
 *
 * Controls which features are available based on subscription tier.
 * Premium-only features require an active premium subscription.
 * Shared features are available to all tiers (may count against quota for free users).
 */

export type SubscriptionTier = 'free' | 'pro' | 'premium';

/**
 * Features that are only available to premium users
 */
export const PREMIUM_FEATURES = {
  unlimitedQueries: true,
  premiumModels: true,
  cloudSync: true,
} as const;

/**
 * Features available to ALL tiers (count against quota for free users)
 */
export const SHARED_FEATURES = {
  agentFileOperations: true,
  pdfIngestion: true,
  docxIngestion: true,
  inlineEditing: true,
  urlIngestion: true,
} as const;

export type PremiumFeature = keyof typeof PREMIUM_FEATURES;
export type SharedFeature = keyof typeof SHARED_FEATURES;

/**
 * Check if user is on a paid tier (Pro or Premium)
 */
export function isPaidTier(tier: SubscriptionTier): boolean {
  return tier === 'pro' || tier === 'premium';
}

/**
 * Check if a user can access a premium feature
 */
export function canAccessFeature(
  feature: PremiumFeature,
  tier: SubscriptionTier
): boolean {
  if (isPaidTier(tier)) return true;
  return !PREMIUM_FEATURES[feature];
}

/**
 * Premium model identifiers (free users cannot access these)
 */
export const PREMIUM_MODELS = [
  // OpenAI
  'gpt-5.2',
  'gpt-5',
  'gpt-4-turbo',
  'gpt-4o',
  // Anthropic
  'claude-opus-4.5',
  'claude-sonnet-4.5',
  'claude-opus-4',
  'claude-sonnet-4',
  // Google
  'gemini-3-pro',
  'gemini-2-pro',
] as const;

/**
 * Free tier model identifiers
 */
export const FREE_MODELS = [
  // OpenAI
  'gpt-5-mini',
  'gpt-4o-mini',
  // Google
  'gemini-3-flash',
  'gemini-2-flash',
] as const;

/**
 * Check if a model is available for a given tier
 */
export function isModelAvailable(modelId: string, tier: SubscriptionTier): boolean {
  if (isPaidTier(tier)) return true;

  // Check if model is in the premium list
  const isPremiumModel = PREMIUM_MODELS.some(
    (pm) => modelId.toLowerCase().includes(pm.toLowerCase())
  );

  return !isPremiumModel;
}

/**
 * Get a user-friendly message for why a feature is locked
 */
export function getFeatureLockedMessage(feature: PremiumFeature): string {
  switch (feature) {
    case 'unlimitedQueries':
      return 'Upgrade to Premium for unlimited AI queries';
    case 'premiumModels':
      return 'Upgrade to Premium to access advanced AI models';
    case 'cloudSync':
      return 'Upgrade to Premium to sync your documents across devices';
    default:
      return 'Upgrade to Premium to unlock this feature';
  }
}

/**
 * Get a user-friendly message for why a model is locked
 */
export function getModelLockedMessage(modelName: string): string {
  return `${modelName} requires Premium. Upgrade to access advanced AI models.`;
}

/**
 * Check if user has remaining quota
 */
export function hasRemainingQuota(
  used: number,
  limit: number | null,
  tier: SubscriptionTier
): boolean {
  // Paid users have unlimited quota
  if (isPaidTier(tier)) return true;

  // Free users check against limit
  if (limit === null) return true;
  return used < limit;
}

/**
 * Get quota status for display
 */
export function getQuotaStatus(
  used: number,
  limit: number | null,
  tier: SubscriptionTier
): {
  hasQuota: boolean;
  percentage: number;
  isWarning: boolean;
  isCritical: boolean;
  isExhausted: boolean;
} {
  if (isPaidTier(tier) || limit === null) {
    return {
      hasQuota: true,
      percentage: 0,
      isWarning: false,
      isCritical: false,
      isExhausted: false,
    };
  }

  const percentage = Math.min((used / limit) * 100, 100);

  return {
    hasQuota: used < limit,
    percentage,
    isWarning: percentage >= 75 && percentage < 90,
    isCritical: percentage >= 90 && percentage < 100,
    isExhausted: percentage >= 100,
  };
}
