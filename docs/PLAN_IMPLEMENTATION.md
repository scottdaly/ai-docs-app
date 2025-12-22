# Paid & Free Plans Implementation Plan

## Executive Summary

Midlight is well-positioned to implement a freemium model. **Approximately 70-80% of the subscription infrastructure is already built**, including user authentication, subscription tier tracking, usage/quota enforcement, and database schema with Stripe integration fields. This plan outlines completing the remaining work to launch paid plans.

---

## Current State Analysis

### Already Implemented

| Component | Status | Location |
|-----------|--------|----------|
| User authentication (email + OAuth) | Complete | `useAuthStore.ts`, `authService.ts` |
| Subscription data model (free/premium) | Complete | `schema.sql`, `subscriptions` table |
| Usage tracking per LLM request | Complete | `quotaManager.js`, `llm_usage` table |
| Monthly quota enforcement (100/month free) | Complete | `quotaManager.js` |
| Rate limiting by tier | Complete | `rateLimiters.js` |
| Model tier restrictions (backend) | Complete | `llm/index.js` |
| JWT tokens + session management | Complete | `tokenService.js` |
| Stripe fields in database | Complete | `stripe_customer_id`, `stripe_subscription_id` |
| Auth modal UI | Complete | `AuthModal.tsx` |
| Settings modal structure | Complete | `SettingsModal.tsx` (has 'account' tab) |

### Not Yet Implemented

| Component | Priority | Effort |
|-----------|----------|--------|
| Stripe payment integration | High | Medium |
| Upgrade/pricing UI | High | Medium |
| Usage dashboard in settings | High | Low |
| Feature gating in UI | Medium | Low |
| Quota warning notifications | Medium | Low |
| Trial period support | Low | Low |
| Team/seat management | Low | High |

---

## Monetization Approaches Evaluated

### Approach 1: Pure Usage-Based (Tokens/Queries)

**Model:** Users pay for what they use, like OpenAI's pricing.

| Pros | Cons |
|------|------|
| Fair - heavy users pay more | Unpredictable costs deter users |
| Simple to understand | Complex billing implementation |
| No wasted value | Users hesitate to experiment |
| Scales with usage | Hard to budget for users |

**Verdict:** Not recommended for a productivity app targeting general audience. Usage anxiety hurts adoption.

---

### Approach 2: Tiered Subscriptions (Recommended)

**Model:** Free tier with limits, paid tier with higher/unlimited access.

| Pros | Cons |
|------|------|
| Predictable costs for users | Some users may underutilize |
| Simple mental model | Free tier may be "too good" |
| Encourages exploration | Requires careful limit tuning |
| Industry standard (Notion, etc.) | |
| Already partially implemented | |

**Verdict:** Strongly recommended. Aligns with PRD vision, leverages existing infrastructure.

---

### Approach 3: Feature-Based Tiers

**Model:** Free has basic features, paid unlocks advanced capabilities.

| Pros | Cons |
|------|------|
| Clear value proposition | Complex to implement |
| No usage tracking needed | Feature creep risk |
| Strong upgrade motivation | Users feel "locked out" |
| Easy to communicate | Fragmenting the experience |

**Verdict:** Partially recommended as a complement to Approach 2, not standalone.

---

### Approach 4: BYOK (Bring Your Own Key)

**Model:** Free users provide their own API keys, paid users use Midlight's allocation.

| Pros | Cons |
|------|------|
| Zero cost for provider | Poor UX for non-technical users |
| Appeals to power users | Key security concerns |
| No quota management needed | No recurring revenue from heavy users |
| Users control costs | Inconsistent experience |

**Verdict:** Consider as an optional "power user" feature, not primary model.

---

## Recommended Strategy: Hybrid Tiered Model

Combine quota-based limits with feature differentiation for the clearest value proposition.

### Tier Structure

| Feature | Free | Premium ($20/mo or $180/yr) |
|---------|------|---------------------------|
| **AI Queries/Month** | 100 | Unlimited |
| **AI Models** | GPT-5-mini, Gemini 3 Flash | GPT-5.2, Claude Sonnet 4.5, Claude Opus 4.5, Gemini 3 Pro |
| **Inline AI Editing (Cmd+K)** | Included in query limit | Unlimited |
| **AI Agent (file operations)** | Included in query limit | Unlimited |
| **PDF/DOCX/URL Ingestion** | Included | Included |
| **Cloud Sync (E2EE)** | Not included | Included |
| **Priority Support** | Community | Email support |

### Pricing Rationale

- **$20/month:** Matches Cursor pricing, positioned as premium AI writing tool
- **$180/year:** 25% discount incentivizes annual commitment ($15/mo effective)
- **Free tier:** Full feature access with query limits - users experience everything, convert when they need more
- **Feature parity:** AI Agent and PDF ingestion available to all - differentiation is volume and model quality

---

## Implementation Plan

### Phase 1: Stripe Integration (Backend)

**Goal:** Enable payment processing and subscription management.

#### 1.1 Install Stripe SDK

```bash
cd midlight-site
npm install stripe
```

#### 1.2 Create Stripe Configuration

**New file:** `server/config/stripe.js`

```javascript
import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

export const STRIPE_PRICES = {
  premium_monthly: process.env.STRIPE_PRICE_MONTHLY,
  premium_yearly: process.env.STRIPE_PRICE_YEARLY,
};

export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
```

#### 1.3 Create Subscription Routes

**New file:** `server/routes/subscription.js`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/subscription/checkout` | Create Stripe Checkout session |
| POST | `/api/subscription/portal` | Create Stripe Customer Portal session |
| POST | `/api/subscription/webhook` | Handle Stripe webhooks |
| GET | `/api/subscription/status` | Get current subscription status |

#### 1.4 Webhook Handler

Handle these Stripe events:
- `checkout.session.completed` - Activate subscription
- `customer.subscription.updated` - Handle plan changes
- `customer.subscription.deleted` - Handle cancellation
- `invoice.payment_failed` - Handle payment failures
- `invoice.paid` - Confirm renewal

#### 1.5 Environment Variables

Add to `.env`:
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_PRICE_MONTHLY=price_...
STRIPE_PRICE_YEARLY=price_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

---

### Phase 2: Upgrade Flow (Frontend)

**Goal:** Allow users to upgrade from free to premium.

#### 2.1 Create Pricing/Upgrade Component

**New file:** `src/components/UpgradeModal.tsx`

Features:
- Plan comparison table
- Monthly vs. yearly toggle (show savings)
- "Current plan" indicator
- CTA button → opens Stripe Checkout
- Testimonials/social proof (optional)

#### 2.2 Add Upgrade Entry Points

Add "Upgrade" buttons in:
- Settings → Account tab
- Quota warning toast (when approaching limit)
- AI panel (when quota exceeded)
- Model selector (when selecting premium model as free user)

#### 2.3 Create Subscription Management in Settings

**Modify:** `src/components/SettingsModal.tsx` → Account tab

Add:
- Current plan display with badge (Free/Premium)
- Billing period display (if premium)
- Usage meter (X of 100 used)
- "Manage Subscription" → opens Stripe Customer Portal
- "Upgrade to Premium" button (if free)

---

### Phase 3: Usage Dashboard

**Goal:** Show users their usage and remaining quota.

#### 3.1 Usage Stats Component

**New file:** `src/components/UsageStats.tsx`

Display:
- Circular progress meter (used/limit)
- Reset date (first of next month)
- Breakdown by request type (chat, inline edit, agent)
- Breakdown by model (optional)
- Historical usage chart (last 6 months)

#### 3.2 Integrate in Settings

Add UsageStats to Account tab, prominently displayed.

#### 3.3 Quota Warning System

**Modify:** `src/store/useAuthStore.ts`

Add:
- `quotaWarningThreshold: 0.8` (warn at 80% usage)
- `showQuotaWarning: boolean`
- Check quota after each AI request

**New component:** `src/components/QuotaWarningBanner.tsx`

- Dismissable warning when approaching limit
- "Upgrade" CTA
- Shows when `used/limit > 0.8`

---

### Phase 4: Feature Gating

**Goal:** Restrict premium-only features for free users in the UI.

#### 4.1 Create Feature Gate Utility

**New file:** `src/utils/featureGates.ts`

```typescript
export const PREMIUM_FEATURES = {
  unlimitedQueries: true,
  premiumModels: true,
  cloudSync: true,
} as const;

// Features available to ALL tiers (count against quota for free users)
export const SHARED_FEATURES = {
  agentFileOperations: true,
  pdfIngestion: true,
  docxIngestion: true,
  inlineEditing: true,
} as const;

export function canAccessFeature(
  feature: keyof typeof PREMIUM_FEATURES,
  tier: 'free' | 'premium'
): boolean {
  if (tier === 'premium') return true;
  return !PREMIUM_FEATURES[feature];
}
```

#### 4.2 Gate Premium Models in UI

**Modify:** Model selector dropdown

- Show all models, but mark premium ones with a lock/crown icon
- Clicking premium model as free user → show upgrade modal
- Tooltip: "Upgrade to Premium to access GPT-5.2"

#### 4.3 Gate Cloud Sync (Future)

When cloud sync is implemented:
- Free users see "Cloud Sync - Premium feature" in settings
- Clicking → upgrade modal

#### 4.4 No Gating Needed For

The following features are available to all tiers (usage counts against quota):
- AI Agent file operations (create, edit, delete, move)
- PDF/DOCX ingestion
- Inline editing (Cmd+K)
- URL ingestion

---

### Phase 5: Quota Exceeded Handling

**Goal:** Graceful experience when users hit limits.

#### 5.1 Quota Exceeded Modal

**New file:** `src/components/QuotaExceededModal.tsx`

Content:
- "You've used all 100 AI queries this month"
- Usage resets on [date]
- Plan comparison
- "Upgrade to Premium for unlimited access"
- "Remind me later" option

#### 5.2 Inline Quota Handling

When quota exceeded on AI request:
- Show quota modal instead of error
- Disable AI input with tooltip
- Chat panel shows helpful message

#### 5.3 Rate Limit Handling

When rate limited (too many requests/minute):
- Show toast: "Slow down! Try again in X seconds"
- Temporarily disable send button
- Don't show upgrade (this is abuse prevention, not tier limit)

---

### Phase 6: Trial Period (Optional)

**Goal:** Let users try premium before committing.

#### 6.1 Trial Configuration

Options:
- **7-day trial** of premium on signup (no card required)
- **14-day trial** when starting checkout (card required, cancel anytime)

Recommend: 7-day no-card trial for maximum conversion.

#### 6.2 Database Changes

**Modify:** `subscriptions` table

Add:
```sql
ALTER TABLE subscriptions ADD COLUMN trial_ends_at DATETIME;
ALTER TABLE subscriptions ADD COLUMN has_used_trial BOOLEAN DEFAULT FALSE;
```

#### 6.3 Trial Logic

- New signups get `tier: 'premium'`, `trial_ends_at: NOW() + 7 days`
- Background job checks for expired trials, downgrades to free
- UI shows "Trial: X days remaining"
- Trial ending → email reminder + in-app banner

---

### Phase 7: Analytics & Monitoring

**Goal:** Track conversion and usage patterns.

#### 7.1 Key Metrics to Track

| Metric | Description |
|--------|-------------|
| Free → Premium conversion rate | % of free users who upgrade |
| Time to conversion | Days from signup to upgrade |
| Quota utilization | % of quota used by free users |
| Churn rate | % of premium users who cancel |
| Feature usage by tier | Which features drive upgrades |

#### 7.2 Event Tracking

Track events:
- `signup_completed`
- `quota_warning_shown`
- `quota_exceeded_shown`
- `upgrade_modal_opened`
- `checkout_started`
- `subscription_created`
- `subscription_cancelled`

#### 7.3 Dashboard

Add internal admin dashboard (or use Stripe Dashboard + PostHog/Mixpanel).

---

## Technical Implementation Details

### Stripe Checkout Flow

```
1. User clicks "Upgrade to Premium"
2. Frontend calls POST /api/subscription/checkout
3. Backend creates Stripe Checkout Session
4. Backend returns session.url
5. Frontend redirects to Stripe Checkout
6. User completes payment on Stripe
7. Stripe redirects to success_url (e.g., /upgrade/success)
8. Stripe sends webhook: checkout.session.completed
9. Backend updates subscription: tier → 'premium'
10. Frontend fetches updated subscription
11. UI reflects premium status
```

### Stripe Customer Portal Flow

```
1. User clicks "Manage Subscription"
2. Frontend calls POST /api/subscription/portal
3. Backend creates Portal Session
4. Backend returns session.url
5. Frontend redirects to Stripe Portal
6. User manages subscription (update card, cancel, etc.)
7. Stripe sends webhooks for changes
8. Backend updates subscription accordingly
```

### Quota Enforcement Flow

```
1. User sends AI request
2. Backend middleware checks quota (quotaManager.checkQuota)
3. If quota exceeded → return 429 with quota info
4. Frontend receives 429
5. Frontend shows QuotaExceededModal
6. User can upgrade or wait for reset
```

---

## File Summary

### New Files (Backend)

| File | Purpose |
|------|---------|
| `server/config/stripe.js` | Stripe SDK configuration |
| `server/routes/subscription.js` | Subscription/payment endpoints |
| `server/services/subscriptionService.js` | Subscription business logic |
| `server/webhooks/stripe.js` | Stripe webhook handlers |

### New Files (Frontend)

| File | Purpose |
|------|---------|
| `src/components/UpgradeModal.tsx` | Pricing/upgrade modal |
| `src/components/UsageStats.tsx` | Usage dashboard component |
| `src/components/QuotaWarningBanner.tsx` | Quota warning UI |
| `src/components/QuotaExceededModal.tsx` | Quota exceeded modal |
| `src/utils/featureGates.ts` | Feature gating utilities |

### Modified Files

| File | Changes |
|------|---------|
| `server/routes/user.js` | Add subscription status helpers |
| `src/store/useAuthStore.ts` | Add quota warning state |
| `src/components/SettingsModal.tsx` | Add Account tab with usage/billing |
| `src/components/chat/ChatPanel.tsx` | Handle quota exceeded |
| `src/components/ai/ModelSelector.tsx` | Gate premium models |
| `electron/preload.ts` | Add subscription IPC methods |

---

## Rollout Strategy

### Phase 1: Soft Launch (Week 1-2)
- Deploy Stripe integration
- Enable for internal testing only
- Validate webhook handling
- Test upgrade/downgrade flows

### Phase 2: Beta Launch (Week 3-4)
- Enable for existing users
- Grandfather early adopters with discount
- Monitor conversion and issues
- Iterate on pricing/limits

### Phase 3: Public Launch (Week 5+)
- Enable for new signups
- Marketing push
- Monitor at scale
- A/B test pricing/trial length

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Stripe integration bugs | Extensive webhook testing, idempotency |
| Users angry about limits | Generous free tier, clear communication |
| Churn from pricing | Competitive pricing, annual discount |
| Payment fraud | Stripe Radar, IP monitoring |
| Downtime during billing | Graceful degradation, cache subscription status |

---

## Success Metrics

| Metric | Target (6 months) |
|--------|-------------------|
| Free → Premium conversion | 5-10% |
| Premium monthly churn | < 5% |
| Average quota utilization (free) | 60-80% |
| Revenue per user (blended) | $2-4/month |

---

## Appendix: Stripe Product Setup

### Products to Create in Stripe Dashboard

1. **Midlight Premium Monthly**
   - Price: $20/month
   - Billing: Monthly
   - Product ID: Store in env

2. **Midlight Premium Yearly**
   - Price: $180/year ($15/mo effective, 25% savings)
   - Billing: Yearly
   - Product ID: Store in env

### Webhook Endpoints to Configure

URL: `https://midlight.ai/api/subscription/webhook`

Events:
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

---

## Appendix: Alternative BYOK Implementation

For power users who want to use their own API keys:

### Option A: Separate BYOK Tier
- Free tier: 100 queries with Midlight's keys
- BYOK tier: Unlimited with user's own keys
- Premium tier: Unlimited with Midlight's keys + cloud sync

### Option B: BYOK as Premium Add-on
- Premium users can optionally add their own keys
- Uses their keys first, falls back to Midlight's
- Useful for enterprise/high-volume users

### Implementation Notes
- Store API keys encrypted in database or Electron secure storage
- Validate keys before saving
- Show usage/cost estimates from provider
- Handle key rotation

**Recommendation:** Defer BYOK to post-launch. Focus on core subscription first.

---

## Conclusion

The recommended approach is a **tiered subscription model** with:
- Generous free tier (100 queries/month) with full feature access to acquire users
- Premium tier ($20/month or $180/year) for power users and professionals
- Feature parity on AI capabilities (agent, ingestion) - differentiation is **volume** and **model quality**
- Only cloud sync gated as a premium-exclusive feature

Most infrastructure exists. Primary work is Stripe integration, upgrade UI, and usage dashboard. Estimated effort: **3-4 weeks** for full implementation.
