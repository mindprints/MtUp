import { afterEach, describe, expect, it, vi } from 'vitest';
import { proposalContextTestUtils } from '@/lib/ProposalContext';

describe('ProposalContext abort filtering', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('treats abort-style fetch failures as ignorable read errors', () => {
    expect(
      proposalContextTestUtils.isAbortLikeError({
        message: 'TypeError: Failed to fetch',
        details: 'net::ERR_ABORTED',
      })
    ).toBe(true);

    expect(
      proposalContextTestUtils.isAbortLikeError({
        name: 'AbortError',
        message: 'The operation was aborted.',
      })
    ).toBe(true);
  });

  it('does not classify ordinary Supabase errors as aborts', () => {
    expect(
      proposalContextTestUtils.isAbortLikeError({
        code: '42501',
        message: 'new row violates row-level security policy for table "profiles"',
      })
    ).toBe(false);
  });

  it('suppresses console noise for abort-like read errors', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const ignored = proposalContextTestUtils.logSupabaseReadError(
      'Failed to fetch proposals:',
      {
        message: 'TypeError: Failed to fetch',
        details: 'ERR_ABORTED',
      }
    );

    expect(ignored).toBe(true);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('still logs genuine read errors', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = {
      code: 'PGRST116',
      message: 'JSON object requested, multiple (or no) rows returned',
    };

    const ignored = proposalContextTestUtils.logSupabaseReadError(
      'Failed to fetch proposals:',
      error
    );

    expect(ignored).toBe(false);
    expect(errorSpy).toHaveBeenCalledWith('Failed to fetch proposals:', error);
  });
});
