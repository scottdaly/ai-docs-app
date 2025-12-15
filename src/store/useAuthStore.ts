import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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

export interface QuotaInfo {
  tier: string;
  limit: number | null;
  used: number;
  remaining: number | null;
}

interface AuthState {
  // State
  user: User | null;
  subscription: Subscription | null;
  quota: QuotaInfo | null;
  isLoading: boolean;
  isInitializing: boolean; // True while checking auth on app start
  error: string | null;

  // Computed
  isAuthenticated: boolean;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, displayName?: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  fetchUser: () => Promise<void>;
  fetchSubscription: () => Promise<void>;
  fetchQuota: () => Promise<void>;
  clearError: () => void;
  resetLoading: () => void;
  checkAuth: () => Promise<boolean>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      subscription: null,
      quota: null,
      isLoading: false,
      isInitializing: true, // Start as true, set to false after checkAuth
      error: null,
      isAuthenticated: false,

      // Actions
      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const result = await window.electronAPI.auth.login(email, password);
          set({
            user: result.user,
            isAuthenticated: true,
            isLoading: false,
          });
          // Fetch additional data
          get().fetchSubscription();
          get().fetchQuota();
        } catch (error: any) {
          set({
            isLoading: false,
            error: error.message || 'Login failed',
          });
          throw error;
        }
      },

      signup: async (email: string, password: string, displayName?: string) => {
        set({ isLoading: true, error: null });
        try {
          const result = await window.electronAPI.auth.signup(email, password, displayName);
          set({
            user: result.user,
            isAuthenticated: true,
            isLoading: false,
          });
          // Fetch additional data
          get().fetchSubscription();
          get().fetchQuota();
        } catch (error: any) {
          set({
            isLoading: false,
            error: error.message || 'Signup failed',
          });
          throw error;
        }
      },

      loginWithGoogle: async () => {
        set({ isLoading: true, error: null });
        try {
          const result = await window.electronAPI.auth.loginWithGoogle();
          set({
            user: result.user,
            isAuthenticated: true,
            isLoading: false,
          });
          // Fetch additional data
          get().fetchSubscription();
          get().fetchQuota();
        } catch (error: any) {
          set({
            isLoading: false,
            error: error.message || 'Google login failed',
          });
          throw error;
        }
      },

      logout: async () => {
        set({ isLoading: true });
        try {
          await window.electronAPI.auth.logout();
        } catch (error) {
          console.error('Logout error:', error);
        }
        set({
          user: null,
          subscription: null,
          quota: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });
      },

      fetchUser: async () => {
        try {
          const user = await window.electronAPI.auth.getUser();
          if (user) {
            set({ user, isAuthenticated: true });
          }
        } catch (error) {
          console.error('Fetch user error:', error);
        }
      },

      fetchSubscription: async () => {
        try {
          const subscription = await window.electronAPI.auth.getSubscription();
          set({ subscription });
        } catch (error) {
          console.error('Fetch subscription error:', error);
        }
      },

      fetchQuota: async () => {
        try {
          const quota = await window.electronAPI.auth.getUsage();
          set({ quota });
        } catch (error) {
          console.error('Fetch quota error:', error);
        }
      },

      clearError: () => {
        set({ error: null });
      },

      resetLoading: () => {
        set({ isLoading: false, error: null });
      },

      checkAuth: async () => {
        try {
          const state = await window.electronAPI.auth.getState();

          if (state === 'initializing') {
            // Wait for auth to be ready (background refresh in progress)
            return new Promise<boolean>((resolve) => {
              const unsubscribe = window.electronAPI.auth.onAuthStateChange((newState) => {
                unsubscribe();
                if (newState === 'authenticated') {
                  get().fetchUser();
                  get().fetchSubscription();
                  get().fetchQuota();
                  set({ isAuthenticated: true, isInitializing: false });
                  resolve(true);
                } else {
                  set({ isAuthenticated: false, user: null, isInitializing: false });
                  resolve(false);
                }
              });
            });
          }

          if (state === 'authenticated') {
            await get().fetchUser();
            await get().fetchSubscription();
            await get().fetchQuota();
            set({ isAuthenticated: true, isInitializing: false });
            return true;
          }

          set({ isAuthenticated: false, isInitializing: false });
          return false;
        } catch (error) {
          console.error('Check auth error:', error);
          set({ isInitializing: false });
          return false;
        }
      },
    }),
    {
      name: 'midlight-auth',
      partialize: (state) => ({
        // Only persist user for quick display on app load
        // Actual auth state is verified with checkAuth()
        user: state.user,
      }),
    }
  )
);
