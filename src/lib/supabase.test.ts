import { afterEach, describe, expect, it, vi } from 'vitest';
import { getSupabaseEnv } from '@/lib/supabase';

afterEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('supabase helpers', () => {
  it('returns debug info that matches configured env', async () => {
    const env = getSupabaseEnv();
    const mod = await import('@/lib/supabase');
    const info = mod.getSupabaseAuthDebugInfo();
    const expectedHost = env.url ? new URL(env.url).host : 'invalid-url';
    expect(info.host).toBe(expectedHost);
    expect(info.hasUrl).toBe(Boolean(env.url));
    expect(info.hasAnonKey).toBe(Boolean(env.anonKey));
    expect(info.anonKeyPrefix).toBe(
      env.anonKey ? env.anonKey.slice(0, 12) : ''
    );
  });

  it('stores and clears access token', async () => {
    const mod = await import('@/lib/supabase');
    mod.setStoredSupabaseAccessToken('abc123');
    expect(mod.getStoredSupabaseAccessToken()).toBe('abc123');
    mod.setStoredSupabaseAccessToken(null);
    expect(mod.getStoredSupabaseAccessToken()).toBeNull();
  });

  it('reachability returns ok=true for any HTTP response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const mod = await import('@/lib/supabase');
    const result = await mod.checkSupabaseReachability();
    expect(result.ok).toBe(true);
    expect(result.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
