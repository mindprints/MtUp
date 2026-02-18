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
});
