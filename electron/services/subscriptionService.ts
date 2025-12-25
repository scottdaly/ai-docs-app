/**
 * Subscription Service
 *
 * Handles subscription management with the Midlight backend.
 * - Get subscription status
 * - Create Stripe checkout sessions
 * - Create Stripe customer portal sessions
 */

import { net } from 'electron';
import { getAccessToken } from './authService';

// API endpoint
const API_BASE = process.env.MIDLIGHT_API_URL || 'https://midlight.ai';

// Types
export type PriceType = 'pro_monthly' | 'pro_yearly' | 'premium_monthly' | 'premium_yearly';

export interface SubscriptionStatus {
  tier: 'free' | 'pro' | 'premium';
  status: 'active' | 'cancelled' | 'expired' | 'past_due' | 'trialing';
  billingInterval: 'monthly' | 'yearly' | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  hasStripeSubscription: boolean;
}

export interface CheckoutResult {
  url: string;
  sessionId: string;
}

export interface PortalResult {
  url: string;
}

export interface SubscriptionPrices {
  monthly: {
    amount: number;
    currency: string;
    interval: string;
  };
  yearly: {
    amount: number;
    currency: string;
    interval: string;
    savings: string;
  };
}

/**
 * Make authenticated request to backend
 */
async function makeRequest<T>(
  method: string,
  path: string,
  body?: object
): Promise<T> {
  const accessToken = await getAccessToken();

  if (!accessToken) {
    throw new Error('Not authenticated');
  }

  return new Promise((resolve, reject) => {
    const request = net.request({
      method,
      url: `${API_BASE}${path}`,
    });

    request.setHeader('Authorization', `Bearer ${accessToken}`);
    request.setHeader('Content-Type', 'application/json');
    request.setHeader('X-Client-Type', 'desktop');

    let responseData = '';

    request.on('response', (response) => {
      response.on('data', (chunk) => {
        responseData += chunk.toString();
      });

      response.on('end', () => {
        try {
          const data = JSON.parse(responseData);

          if (response.statusCode && response.statusCode >= 400) {
            reject(new Error(data.error || `Request failed with status ${response.statusCode}`));
          } else {
            resolve(data);
          }
        } catch (e) {
          if (response.statusCode && response.statusCode >= 400) {
            reject(new Error(`Request failed with status ${response.statusCode}`));
          } else {
            reject(new Error('Invalid response from server'));
          }
        }
      });
    });

    request.on('error', (error) => {
      reject(new Error(`Network error: ${error.message}`));
    });

    if (body) {
      request.write(JSON.stringify(body));
    }

    request.end();
  });
}

/**
 * Get current subscription status
 */
export async function getSubscriptionStatus(): Promise<SubscriptionStatus> {
  return makeRequest<SubscriptionStatus>('GET', '/api/subscription/status');
}

/**
 * Create Stripe checkout session for upgrading
 */
export async function createCheckoutSession(
  priceType: PriceType,
  successUrl: string,
  cancelUrl: string
): Promise<CheckoutResult> {
  return makeRequest<CheckoutResult>('POST', '/api/subscription/checkout', {
    priceType,
    successUrl,
    cancelUrl,
  });
}

/**
 * Create Stripe customer portal session
 */
export async function createPortalSession(returnUrl: string): Promise<PortalResult> {
  return makeRequest<PortalResult>('POST', '/api/subscription/portal', {
    returnUrl,
  });
}

/**
 * Get subscription prices (public, no auth required)
 */
export async function getSubscriptionPrices(): Promise<SubscriptionPrices> {
  return new Promise((resolve, reject) => {
    const request = net.request({
      method: 'GET',
      url: `${API_BASE}/api/subscription/prices`,
    });

    request.setHeader('X-Client-Type', 'desktop');

    let responseData = '';

    request.on('response', (response) => {
      response.on('data', (chunk) => {
        responseData += chunk.toString();
      });

      response.on('end', () => {
        try {
          const data = JSON.parse(responseData);
          resolve(data);
        } catch (e) {
          reject(new Error('Invalid response from server'));
        }
      });
    });

    request.on('error', (error) => {
      reject(new Error(`Network error: ${error.message}`));
    });

    request.end();
  });
}
