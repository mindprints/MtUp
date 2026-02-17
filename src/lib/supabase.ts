import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { runtimeConfig } from '@/lib/runtimeConfig';

type SupabaseEnv = {
  url: string;
  anonKey: string;
};

const ACCESS_TOKEN_KEY = 'mtup-supabase-access-token';

function readSupabaseEnv(): SupabaseEnv {
  const url = ((import.meta as any).env?.VITE_SUPABASE_URL || '').trim();
  const anonKey = ((import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '').trim();
  return { url, anonKey };
}

export function getSupabaseEnv(): SupabaseEnv {
  return readSupabaseEnv();
}

export function assertSupabaseEnv(): void {
  if (runtimeConfig.dataSource !== 'supabase') return;
  const { url, anonKey } = readSupabaseEnv();
  if (!url || !anonKey) {
    throw new Error(
      'Supabase mode requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
    );
  }
}

let supabaseClient: SupabaseClient | null = null;

export function getStoredSupabaseAccessToken(): string | null {
  try {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredSupabaseAccessToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(ACCESS_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
    }
  } finally {
    supabaseClient = null;
  }
}

export function getSupabaseClient(): SupabaseClient {
  assertSupabaseEnv();
  if (supabaseClient) return supabaseClient;
  const { url, anonKey } = readSupabaseEnv();
  const accessToken = getStoredSupabaseAccessToken();
  supabaseClient = createClient(url, anonKey, {
    global: {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    },
    auth: {
      // We use explicit REST auth flow due observed SDK session hangs in local dev.
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return supabaseClient;
}

export function getSupabaseAuthDebugInfo() {
  const { url, anonKey } = getSupabaseEnv();
  const host = (() => {
    try {
      return new URL(url).host;
    } catch {
      return 'invalid-url';
    }
  })();
  return {
    host,
    hasUrl: Boolean(url),
    hasAnonKey: Boolean(anonKey),
    anonKeyPrefix: anonKey ? anonKey.slice(0, 12) : '',
  };
}

export async function checkSupabaseReachability(
  timeoutMs = 6000
): Promise<{ ok: boolean; status?: number; error?: string }> {
  const { url, anonKey } = getSupabaseEnv();
  if (!url) {
    return { ok: false, error: 'Missing VITE_SUPABASE_URL' };
  }
  if (!anonKey) {
    return { ok: false, error: 'Missing VITE_SUPABASE_ANON_KEY' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${url}/auth/v1/health`, {
      method: 'GET',
      headers: {
        apikey: anonKey,
      },
      signal: controller.signal,
    });
    clearTimeout(timer);
    // Any HTTP response means endpoint is reachable. Auth correctness is checked in sign-in.
    return { ok: true, status: response.status };
  } catch (error) {
    clearTimeout(timer);
    return { ok: false, error: String(error) };
  }
}
