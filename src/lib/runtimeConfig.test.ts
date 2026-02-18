import { describe, expect, it } from 'vitest';
import { isSupabaseMode, runtimeConfig } from '@/lib/runtimeConfig';

describe('runtimeConfig', () => {
  it('exposes a valid data source value', () => {
    expect(['local', 'supabase']).toContain(runtimeConfig.dataSource);
  });

  it('isSupabaseMode stays consistent with dataSource', () => {
    expect(isSupabaseMode()).toBe(runtimeConfig.dataSource === 'supabase');
  });

  it('exposes valid AI runtime settings', () => {
    expect(typeof runtimeConfig.aiAssistantEnabled).toBe('boolean');
    expect(runtimeConfig.orchestratorBaseUrl.length).toBeGreaterThan(0);
  });
});
