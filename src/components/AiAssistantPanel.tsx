import { FormEvent, useState } from 'react';
import { sendAiMessage } from '@/lib/aiClient';
import { generateId } from '@/lib/utils';
import type { AiMessage } from '@/types';

type AiAssistantPanelProps = {
  userId: string;
  activeGroupId: string | null;
  compact?: boolean;
};

export function AiAssistantPanel({
  userId,
  activeGroupId,
  compact = false,
}: AiAssistantPanelProps) {
  const [threadId, setThreadId] = useState<string | undefined>(undefined);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const prompt = input.trim();
    if (!prompt || isLoading) return;

    const outgoing: AiMessage = {
      id: generateId(),
      role: 'user',
      content: prompt,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, outgoing]);
    setInput('');
    setError(null);
    setIsLoading(true);

    try {
      const response = await sendAiMessage({
        threadId,
        message: prompt,
        context: {
          userId,
          activeGroupId,
        },
      });
      setThreadId(response.threadId);
      setMessages((prev) => [...prev, response.assistantMessage]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI request failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      {!compact && (
        <p className="text-sm text-gray-600 dark:text-slate-300">
          Ask naturally. The assistant is currently read-only and grounded in your app data.
        </p>
      )}

      <div className="max-h-80 overflow-y-auto rounded-lg border border-gray-200 dark:border-slate-700 p-3 space-y-2 bg-gray-50 dark:bg-slate-950">
        {messages.length === 0 && (
          <div className="space-y-2 text-sm text-gray-600 dark:text-slate-300">
            <p>Try:</p>
            <p className="rounded bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-2 py-1">
              What events are confirmed?
            </p>
            <p className="rounded bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-2 py-1">
              Where am I available this week?
            </p>
          </div>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={`rounded px-3 py-2 text-sm ${
              message.role === 'user'
                ? 'bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-100'
                : 'bg-white text-gray-800 dark:bg-slate-900 dark:text-slate-100 border border-gray-200 dark:border-slate-700'
            }`}
          >
            <div className="text-[10px] uppercase tracking-wide opacity-70">{message.role}</div>
            <div className="whitespace-pre-wrap">{message.content}</div>
          </div>
        ))}
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask AI..."
          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100"
        />
        <button
          type="submit"
          disabled={isLoading || input.trim().length === 0}
          className="px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Asking...' : 'Ask'}
        </button>
      </form>
    </div>
  );
}
