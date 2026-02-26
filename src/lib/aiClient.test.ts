import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendAiMessage } from '@/lib/aiClient';

describe('aiClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns parsed assistant response on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          threadId: 'thread-1',
          mode: 'answer',
          assistantMessage: {
            id: 'msg-1',
            role: 'assistant',
            content: 'Hello from orchestrator',
            createdAt: new Date().toISOString(),
          },
        }),
      })
    );

    const response = await sendAiMessage({
      message: 'What is confirmed?',
    });

    expect(response.threadId).toBe('thread-1');
    expect(response.assistantMessage.role).toBe('assistant');
  });

  it('throws on invalid response shape', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          foo: 'bar',
        }),
      })
    );

    await expect(sendAiMessage({ message: 'test' })).rejects.toThrow(
      'AI response shape invalid'
    );
  });

  it('accepts action proposal responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          threadId: 'thread-2',
          mode: 'action_proposal',
          assistantMessage: {
            id: 'msg-2',
            role: 'assistant',
            content: 'Here is a proposal preview.',
            createdAt: new Date().toISOString(),
          },
          actionProposal: {
            id: 'action-1',
            type: 'create_activity_proposal_and_invite_draft',
            summary: 'Propose a night on the town next week',
            requiresApproval: true,
            impact: 'No write will occur until approval.',
          },
        }),
      })
    );

    const response = await sendAiMessage({ message: 'Propose a night on the town next week' });

    expect(response.mode).toBe('action_proposal');
    expect(response.actionProposal?.requiresApproval).toBe(true);
  });
});
