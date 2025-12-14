/**
 * Authentication Service
 *
 * Handles user authentication with the Midlight backend.
 * - Email/password login and signup
 * - OAuth flow (Google, GitHub)
 * - Token management (access + refresh tokens)
 * - Automatic token refresh
 */

import { app, net, shell, safeStorage } from 'electron';
import http from 'http';
import { URL } from 'url';
// @ts-ignore - electron-store has no type declarations
import Store from 'electron-store';

// API endpoint
const API_BASE = process.env.MIDLIGHT_API_URL || 'https://midlight.ai';

// Token storage - stores encrypted tokens as base64
const store = new Store<{
  encryptedAccessToken?: string;
  encryptedRefreshToken?: string;
  tokenExpiry?: number;
  user?: User;
  // Legacy fields for migration
  refreshToken?: string;
  accessToken?: string;
}>();

// Track if encryption is available (checked at init time)
let encryptionAvailable = false;

// Types
export interface User {
  id: number;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface Subscription {
  tier: 'free' | 'premium';
  status: 'active' | 'cancelled' | 'expired';
  currentPeriodEnd?: string;
}

export interface AuthResult {
  user: User;
  accessToken: string;
  expiresIn: number;
}

export interface QuotaInfo {
  tier: string;
  limit: number | null;
  used: number;
  remaining: number | null;
}

// In-memory access token (short-lived)
let accessToken: string | null = null;
let tokenExpiry: number | null = null;

// Pending OAuth promise handlers (for system browser flow)
let pendingOAuthResolve: ((result: AuthResult) => void) | null = null;
let pendingOAuthReject: ((error: Error) => void) | null = null;

// Dev mode callback server
let devCallbackServer: http.Server | null = null;

/**
 * Initialize auth service - restore tokens from storage
 */
export function initAuth(): void {
  // Check if encryption is available on this platform
  encryptionAvailable = safeStorage.isEncryptionAvailable();
  console.log(`[Auth] Encryption available: ${encryptionAvailable}`);

  const storedExpiry = store.get('tokenExpiry');
  const hasStoredAuth = store.get('encryptedAccessToken') || store.get('accessToken') || store.get('user');

  if (!storedExpiry || storedExpiry <= Date.now()) {
    // Only try refresh if user has logged in before (has stored auth data)
    if (hasStoredAuth) {
      console.log('[Auth] Access token expired, scheduling background refresh');
      // Delay refresh to allow app to fully initialize
      setTimeout(() => {
        refreshAccessToken().then((success) => {
          console.log(`[Auth] Background token refresh: ${success ? 'succeeded' : 'failed'}`);
        });
      }, 500);
    } else {
      console.log('[Auth] No stored auth data, skipping background refresh');
    }
    return;
  }

  // Try to restore encrypted token first
  const encryptedToken = store.get('encryptedAccessToken');
  if (encryptedToken && encryptionAvailable) {
    try {
      const decrypted = safeStorage.decryptString(Buffer.from(encryptedToken, 'base64'));
      accessToken = decrypted;
      tokenExpiry = storedExpiry;
      console.log('[Auth] Restored access token from encrypted storage');
      return;
    } catch (error) {
      console.error('[Auth] Failed to decrypt token:', error);
    }
  }

  // Fall back to legacy unencrypted token (for migration)
  const legacyToken = store.get('accessToken');
  if (legacyToken) {
    accessToken = legacyToken;
    tokenExpiry = storedExpiry;
    console.log('[Auth] Restored access token from legacy storage');

    // Migrate to encrypted storage if possible
    if (encryptionAvailable) {
      setTokens(legacyToken, Math.floor((storedExpiry - Date.now()) / 1000));
      store.delete('accessToken');
      store.delete('refreshToken');
      console.log('[Auth] Migrated tokens to encrypted storage');
    }
  }
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return accessToken !== null && tokenExpiry !== null && tokenExpiry > Date.now();
}

/**
 * Get current access token (auto-refreshes if needed)
 */
export async function getAccessToken(): Promise<string | null> {
  if (!accessToken || !tokenExpiry) {
    return null;
  }

  // Refresh if token expires in less than 1 minute
  if (tokenExpiry - Date.now() < 60000) {
    const refreshed = await refreshAccessToken();
    if (!refreshed) {
      return null;
    }
  }

  return accessToken;
}

/**
 * Signup with email and password
 */
export async function signup(
  email: string,
  password: string,
  displayName?: string
): Promise<AuthResult> {
  const response = await makeRequest('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password, displayName }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Signup failed');
  }

  const data = await response.json();
  setTokens(data.accessToken, data.expiresIn);
  store.set('user', data.user);

  return data;
}

/**
 * Login with email and password
 */
export async function login(email: string, password: string): Promise<AuthResult> {
  const response = await makeRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Login failed');
  }

  const data = await response.json();
  setTokens(data.accessToken, data.expiresIn);
  store.set('user', data.user);

  return data;
}

/**
 * Refresh access token using refresh token cookie
 */
export async function refreshAccessToken(): Promise<boolean> {
  try {
    const response = await makeRequest('/api/auth/refresh', {
      method: 'POST',
    });

    if (!response.ok) {
      clearAuth();
      return false;
    }

    const data = await response.json();
    setTokens(data.accessToken, data.expiresIn);
    return true;
  } catch (error) {
    console.error('[Auth] Token refresh failed:', error);
    clearAuth();
    return false;
  }
}

/**
 * Logout
 */
export async function logout(): Promise<void> {
  try {
    await makeRequest('/api/auth/logout', { method: 'POST' });
  } catch (error) {
    console.error('[Auth] Logout request failed:', error);
  }

  clearAuth();
}

/**
 * Start OAuth flow - opens in system browser for better UX
 * (user has access to saved passwords, password managers, existing sessions)
 *
 * In dev mode, uses a local HTTP server callback to avoid protocol handler conflicts
 * In production, uses the midlight:// protocol handler
 */
export function startOAuth(provider: 'google' | 'github'): Promise<AuthResult> {
  return new Promise(async (resolve, reject) => {
    // Cancel any pending OAuth and cleanup
    if (pendingOAuthReject) {
      pendingOAuthReject(new Error('OAuth cancelled - new flow started'));
    }
    if (devCallbackServer) {
      devCallbackServer.close();
      devCallbackServer = null;
    }

    // Store promise handlers for when callback arrives
    pendingOAuthResolve = resolve;
    pendingOAuthReject = reject;

    const isDev = !app.isPackaged;
    let authUrl: string;

    if (isDev) {
      // Dev mode: start local HTTP server for callback
      try {
        const port = await startDevCallbackServer();
        authUrl = `${API_BASE}/api/auth/${provider}?desktop=true&callback_port=${port}`;
        console.log(`[Auth] Dev mode: started callback server on port ${port}`);
      } catch (error) {
        reject(new Error('Failed to start dev callback server'));
        pendingOAuthResolve = null;
        pendingOAuthReject = null;
        return;
      }
    } else {
      // Production: use protocol handler
      authUrl = `${API_BASE}/api/auth/${provider}?desktop=true`;
      console.log(`[Auth] Production mode: using protocol handler`);
    }

    console.log(`[Auth] Opening OAuth URL: ${authUrl}`);
    // Open OAuth URL in system browser
    shell.openExternal(authUrl);

    // Set a timeout (5 minutes) in case user abandons the flow
    setTimeout(() => {
      if (pendingOAuthReject) {
        pendingOAuthReject(new Error('OAuth timed out'));
        pendingOAuthResolve = null;
        pendingOAuthReject = null;
      }
      if (devCallbackServer) {
        devCallbackServer.close();
        devCallbackServer = null;
      }
    }, 5 * 60 * 1000);
  });
}

/**
 * Start a local HTTP server to receive OAuth callback in dev mode
 * Returns the port number
 */
function startDevCallbackServer(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      if (!req.url?.startsWith('/auth/callback')) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const url = new URL(req.url, `http://localhost`);
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      // Send success page to browser
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Authentication</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #1a1a2e; color: #eee; }
              .container { text-align: center; }
              h1 { color: #4ade80; }
              p { color: #aaa; }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>${error ? 'Authentication Failed' : 'Authentication Successful!'}</h1>
              <p>${error ? 'Please try again.' : 'You can close this window and return to Midlight.'}</p>
            </div>
          </body>
        </html>
      `);

      // Close server
      server.close();
      devCallbackServer = null;

      // Handle the callback
      if (error) {
        if (pendingOAuthReject) {
          pendingOAuthReject(new Error(`OAuth failed: ${error}`));
        }
      } else if (code) {
        try {
          const result = await handleOAuthCallback(`midlight://auth/callback?code=${code}`);
          if (pendingOAuthResolve) {
            pendingOAuthResolve(result);
          }
        } catch (err) {
          if (pendingOAuthReject) {
            pendingOAuthReject(err as Error);
          }
        }
      } else {
        if (pendingOAuthReject) {
          pendingOAuthReject(new Error('No code received'));
        }
      }

      pendingOAuthResolve = null;
      pendingOAuthReject = null;
    });

    server.on('error', (err) => {
      reject(err);
    });

    // Listen on a random available port
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address && typeof address === 'object') {
        devCallbackServer = server;
        resolve(address.port);
      } else {
        server.close();
        reject(new Error('Failed to get server port'));
      }
    });
  });
}

/**
 * Handle OAuth callback from protocol handler
 * Called by main.ts when the app receives a midlight:// URL
 */
export async function handleOAuthProtocolCallback(url: string): Promise<void> {
  console.log('[Auth] Received OAuth protocol callback:', url);

  if (!pendingOAuthResolve || !pendingOAuthReject) {
    console.error('[Auth] Received OAuth callback but no pending OAuth flow');
    return;
  }

  try {
    const result = await handleOAuthCallback(url);
    console.log('[Auth] OAuth callback handled successfully');
    pendingOAuthResolve(result);
  } catch (error) {
    console.error('[Auth] OAuth callback failed:', error);
    pendingOAuthReject(error as Error);
  } finally {
    pendingOAuthResolve = null;
    pendingOAuthReject = null;
  }
}

/**
 * Exchange a one-time code for tokens
 */
async function exchangeCode(code: string): Promise<{ accessToken: string; expiresIn: number }> {
  return new Promise((resolve, reject) => {
    const url = `${API_BASE}/api/auth/exchange`;
    console.log('[Auth] Exchanging code at:', url);

    const request = net.request({
      method: 'POST',
      url,
    });

    request.setHeader('Content-Type', 'application/json');
    request.setHeader('X-Client-Type', 'desktop'); // Exempt from CSRF checks

    let responseData = '';

    request.on('response', (response) => {
      console.log('[Auth] Exchange response status:', response.statusCode);
      response.on('data', (chunk) => {
        responseData += chunk.toString();
      });

      response.on('end', () => {
        try {
          const data = JSON.parse(responseData);
          if (response.statusCode >= 200 && response.statusCode < 300) {
            console.log('[Auth] Exchange successful');
            resolve(data);
          } else {
            console.error('[Auth] Exchange failed:', data.error);
            reject(new Error(data.error || 'Code exchange failed'));
          }
        } catch {
          console.error('[Auth] Failed to parse exchange response:', responseData);
          reject(new Error('Failed to parse exchange response'));
        }
      });
    });

    request.on('error', (error) => {
      console.error('[Auth] Exchange request error:', error);
      reject(error);
    });

    request.write(JSON.stringify({ code }));
    request.end();
  });
}

/**
 * Handle OAuth callback URL
 */
async function handleOAuthCallback(url: string): Promise<AuthResult> {
  const parsedUrl = new URL(url);
  const params = parsedUrl.searchParams;

  const error = params.get('error');
  if (error) {
    throw new Error(`OAuth failed: ${error}`);
  }

  // Get the one-time exchange code (not tokens directly)
  const code = params.get('code');
  if (!code) {
    throw new Error('No exchange code received');
  }

  // Exchange the code for tokens
  const { accessToken, expiresIn } = await exchangeCode(code);

  // Store tokens
  setTokens(accessToken, expiresIn);

  // Fetch user profile
  const user = await getUser();
  if (!user) {
    throw new Error('Failed to fetch user profile');
  }

  store.set('user', user);

  return {
    user,
    accessToken,
    expiresIn,
  };
}

/**
 * Get current user
 */
export async function getUser(): Promise<User | null> {
  const token = await getAccessToken();
  if (!token) {
    return store.get('user') || null;
  }

  try {
    const response = await makeAuthenticatedRequest('/api/user/me');

    if (!response.ok) {
      return store.get('user') || null;
    }

    const data = await response.json();
    store.set('user', data.user);
    return data.user;
  } catch (error) {
    console.error('[Auth] Get user failed:', error);
    return store.get('user') || null;
  }
}

/**
 * Get subscription info
 */
export async function getSubscription(): Promise<Subscription | null> {
  const token = await getAccessToken();
  if (!token) {
    return { tier: 'free', status: 'active' };
  }

  try {
    const response = await makeAuthenticatedRequest('/api/user/subscription');

    if (!response.ok) {
      return { tier: 'free', status: 'active' };
    }

    return response.json();
  } catch (error) {
    console.error('[Auth] Get subscription failed:', error);
    return { tier: 'free', status: 'active' };
  }
}

/**
 * Get usage quota
 */
export async function getUsage(): Promise<QuotaInfo | null> {
  const token = await getAccessToken();
  if (!token) {
    return null;
  }

  try {
    const response = await makeAuthenticatedRequest('/api/llm/quota');

    if (!response.ok) {
      return null;
    }

    return response.json();
  } catch (error) {
    console.error('[Auth] Get usage failed:', error);
    return null;
  }
}

// Helper functions

function setTokens(token: string, expiresIn: number): void {
  accessToken = token;
  tokenExpiry = Date.now() + expiresIn * 1000;

  // Persist to storage with encryption if available
  if (encryptionAvailable) {
    try {
      const encrypted = safeStorage.encryptString(token);
      store.set('encryptedAccessToken', encrypted.toString('base64'));
    } catch (error) {
      console.error('[Auth] Failed to encrypt token:', error);
      // Fall back to unencrypted (better than losing auth)
      store.set('accessToken', token);
    }
  } else {
    // Encryption unavailable - tokens stay in memory only
    // Don't persist unencrypted tokens on platforms without safeStorage
    console.warn('[Auth] Encryption unavailable, tokens will not persist');
  }
  store.set('tokenExpiry', tokenExpiry);
}

function clearAuth(): void {
  accessToken = null;
  tokenExpiry = null;

  // Clear all token fields (both encrypted and legacy)
  store.delete('encryptedAccessToken');
  store.delete('encryptedRefreshToken');
  store.delete('accessToken');
  store.delete('refreshToken');
  store.delete('tokenExpiry');
  store.delete('user');
}

/**
 * Make a request to the API (no auth)
 */
function makeRequest(
  path: string,
  options: { method?: string; body?: string } = {}
): Promise<{ ok: boolean; status: number; json: () => Promise<any> }> {
  return new Promise((resolve, reject) => {
    const url = `${API_BASE}${path}`;

    const request = net.request({
      method: options.method || 'GET',
      url,
    });

    request.setHeader('Content-Type', 'application/json');
    request.setHeader('X-Client-Type', 'desktop'); // Exempt from CSRF checks

    let responseData = '';

    request.on('response', (response) => {
      response.on('data', (chunk) => {
        responseData += chunk.toString();
      });

      response.on('end', () => {
        resolve({
          ok: response.statusCode >= 200 && response.statusCode < 300,
          status: response.statusCode,
          json: async () => JSON.parse(responseData),
        });
      });
    });

    request.on('error', (error) => {
      reject(error);
    });

    if (options.body) {
      request.write(options.body);
    }

    request.end();
  });
}

/**
 * Make an authenticated request to the API
 */
async function makeAuthenticatedRequest(
  path: string,
  options: { method?: string; body?: string } = {}
): Promise<{ ok: boolean; status: number; json: () => Promise<any> }> {
  const token = await getAccessToken();

  return new Promise((resolve, reject) => {
    const url = `${API_BASE}${path}`;

    const request = net.request({
      method: options.method || 'GET',
      url,
    });

    request.setHeader('Content-Type', 'application/json');
    request.setHeader('X-Client-Type', 'desktop'); // Exempt from CSRF checks
    if (token) {
      request.setHeader('Authorization', `Bearer ${token}`);
    }

    let responseData = '';

    request.on('response', (response) => {
      response.on('data', (chunk) => {
        responseData += chunk.toString();
      });

      response.on('end', () => {
        resolve({
          ok: response.statusCode >= 200 && response.statusCode < 300,
          status: response.statusCode,
          json: async () => JSON.parse(responseData),
        });
      });
    });

    request.on('error', (error) => {
      reject(error);
    });

    if (options.body) {
      request.write(options.body);
    }

    request.end();
  });
}

// Export for use by LLM service
export { makeAuthenticatedRequest };
