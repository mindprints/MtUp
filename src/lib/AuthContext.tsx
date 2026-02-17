import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { User } from '@/types';
import { storage } from '@/lib/storage';
import { isSupabaseMode } from '@/lib/runtimeConfig';
import {
  checkSupabaseReachability,
  getSupabaseAuthDebugInfo,
  getSupabaseEnv,
  getSupabaseClient,
  getStoredSupabaseAccessToken,
  setStoredSupabaseAccessToken,
} from '@/lib/supabase';

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timeout`)), timeoutMs)
    ),
  ]);
}

type AuthContextType = {
  user: User | null;
  login: (name: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const hydrateFromSessionUser = async (
    sessionUser: { id: string; email?: string } | null
  ) => {
    if (!sessionUser) {
      storage.logout();
      setUser(null);
      return;
    }

    const supabase = getSupabaseClient();
    const { data: profileData } = await supabase
      .from('profiles')
      .select('display_name,is_platform_admin')
      .eq('id', sessionUser.id)
      .maybeSingle();

    const fallbackName = sessionUser.email?.split('@')[0] || 'User';

    if (!profileData) {
      await supabase.from('profiles').upsert(
        {
          id: sessionUser.id,
          display_name: fallbackName,
          is_platform_admin: false,
        },
        { onConflict: 'id' }
      );
    }

    const normalizedUser: User = {
      id: sessionUser.id,
      name: profileData?.display_name || fallbackName,
      password: '',
      isAdmin: Boolean(profileData?.is_platform_admin),
    };

    storage.setCurrentUser(normalizedUser);
    setUser(normalizedUser);
  };

  useEffect(() => {
    if (!isSupabaseMode()) {
      const currentUser = storage.getCurrentUser();
      setUser(currentUser);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    let sessionBootstrapResolved = false;
    const loadingFallbackTimer = setTimeout(() => {
      if (!isMounted || sessionBootstrapResolved) return;
      setIsLoading(false);
    }, 2500);

    void (async () => {
      try {
        const token = getStoredSupabaseAccessToken();
        if (!token) {
          if (isMounted) {
            setUser(null);
          }
          return;
        }

        const { url, anonKey } = getSupabaseEnv();
        const userResponse = await withTimeout(
          fetch(`${url}/auth/v1/user`, {
            method: 'GET',
            headers: {
              apikey: anonKey,
              Authorization: `Bearer ${token}`,
            },
          }),
          10000,
          'Supabase user bootstrap'
        );

        if (!userResponse.ok) {
          setStoredSupabaseAccessToken(null);
          if (isMounted) setUser(null);
          return;
        }

        const userPayload = (await userResponse.json()) as { id: string; email?: string };
        if (!isMounted) return;
        await hydrateFromSessionUser(userPayload);
      } catch (error) {
        console.error('Failed to bootstrap auth session:', error);
        if (isMounted) {
          setUser(null);
        }
      } finally {
        sessionBootstrapResolved = true;
        clearTimeout(loadingFallbackTimer);
        if (isMounted) setIsLoading(false);
      }
    })();

    return () => {
      isMounted = false;
      clearTimeout(loadingFallbackTimer);
    };
  }, []);

  const login = async (name: string, password: string): Promise<boolean> => {
    if (!isSupabaseMode()) {
      const loggedInUser = storage.login(name, password);
      if (loggedInUser) {
        setUser(loggedInUser);
        return true;
      }
      return false;
    }

    const debugInfo = getSupabaseAuthDebugInfo();
    let stage = 'start';

    const runLoginFlow = async (): Promise<boolean> => {
      stage = 'reachability';
      const reachability = await withTimeout(
        checkSupabaseReachability(),
        7000,
        'Supabase reachability'
      );
      if (!reachability.ok) {
        console.error('Supabase reachability check failed:', reachability, debugInfo);
        return false;
      }

      stage = 'rest_signin';
      const { url, anonKey } = getSupabaseEnv();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);
      const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: name.trim(),
          password,
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);

      if (!response.ok) {
        const payload = await response.text();
        console.error('Supabase REST sign-in failed:', response.status, payload, debugInfo);
        return false;
      }

      const payload = (await response.json()) as {
        access_token: string;
        refresh_token?: string;
        user?: { id: string; email?: string };
      };

      if (!payload.access_token) {
        console.error('Supabase REST sign-in payload missing access_token', payload);
        return false;
      }

      stage = 'set_session';
      setStoredSupabaseAccessToken(payload.access_token);
      await hydrateFromSessionUser(payload.user || null);

      return true;
    };

    try {
      return await withTimeout(runLoginFlow(), 16000, 'Supabase login flow');
    } catch (error) {
      console.error('Supabase login flow failed:', { stage, error, debugInfo });
      return false;
    }
  };

  const logout = async () => {
    if (isSupabaseMode()) setStoredSupabaseAccessToken(null);
    storage.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
