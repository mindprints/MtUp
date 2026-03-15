import { FormEvent, useState } from 'react';
import snookyAtDeskUrl from '../../Snooky_at_desk.webp';
import { generateId } from '@/lib/utils';

type BriefingMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

function SnookyDeskOverlayNote() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[calc(15%+80px)] z-10 flex justify-end px-5 sm:px-6">
      <p className="max-w-[15rem] rotate-[22deg] text-right text-[2rem] leading-[0.94] text-stone-50 [font-family:'Segoe_Print','Bradley_Hand','Comic_Sans_MS',cursive] [text-shadow:0_4px_18px_rgba(15,23,42,0.78)] sm:text-[2.35rem]">
        Is there something I should know?
      </p>
    </div>
  );
}

export function SnookyDeskScreen() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<BriefingMessage[]>([]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const prompt = input.trim();
    if (!prompt) return;

    setMessages((prev) => [
      ...prev,
      {
        id: generateId(),
        role: 'user',
        content: prompt,
      },
      {
        id: generateId(),
        role: 'assistant',
        content: "I'll keep that in mind for future planning.",
      },
    ]);
    setInput('');
  };

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col">
      <div
        className="relative flex h-full min-h-0 w-full min-w-0 flex-col gap-2 overflow-hidden rounded-xl bg-slate-900 bg-cover bg-center"
        style={{
          backgroundImage: `linear-gradient(180deg, rgba(15,23,42,0.28), rgba(15,23,42,0.72)), url(${snookyAtDeskUrl})`,
        }}
      >
        <SnookyDeskOverlayNote />
        <form onSubmit={handleSubmit} className="bg-transparent p-2">
          <input
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Tell me..."
            className="w-full rounded-full border border-white/45 bg-white/88 px-4 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none"
          />
        </form>
        <div className="flex min-h-0 flex-1 flex-col gap-2 px-2 pb-2">
          <div
            data-screen-scroll-root="true"
            className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-white/25 bg-transparent p-2 dark:border-slate-700/60"
          >
            {messages.length === 0 ? (
              <div className="flex h-full min-h-[15rem] rounded-[1.25rem]" />
            ) : (
              <div className="space-y-2">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`rounded px-3 py-2 text-sm ${
                      message.role === 'user'
                        ? 'bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-100'
                        : 'border border-white/35 bg-white/88 text-slate-900 dark:border-slate-700/60 dark:bg-slate-900/84 dark:text-slate-50'
                    }`}
                  >
                    <div className="text-[10px] uppercase tracking-wide opacity-70">
                      {message.role === 'assistant' ? 'Snooky' : 'You'}
                    </div>
                    <div className="whitespace-pre-wrap break-words">{message.content}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
