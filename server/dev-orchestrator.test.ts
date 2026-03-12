import { describe, expect, it } from 'vitest';
import { classifyIntent } from './dev-orchestrator.mjs';

describe('dev orchestrator intent classification', () => {
  it('treats trip proposals as propose_activity without model fallback', async () => {
    await expect(
      classifyIntent('propose a trip to Milano the first weekend in June')
    ).resolves.toBe('propose_activity');
  });

  it('treats travel refinements as propose_activity in proposal mode', async () => {
    await expect(
      classifyIntent('the first weekend in June in Milano', { proposalMode: true })
    ).resolves.toBe('propose_activity');
  });
});
