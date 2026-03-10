import { useState } from 'react';
import type { Proposal } from '@/types';

type ResolverCommentsPanelProps = {
  proposal: Proposal;
  currentUserId: string;
  userNameById: Map<string, string>;
  onAddComment: (proposalId: string, text: string) => void;
};

export function ResolverCommentsPanel({
  proposal,
  currentUserId,
  userNameById,
  onAddComment,
}: ResolverCommentsPanelProps) {
  const [draft, setDraft] = useState('');

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    onAddComment(proposal.id, text);
    setDraft('');
  };

  const comments = proposal.comments || [];

  return (
    <section className="rounded-xl border border-gray-200 bg-stone-50 p-4 dark:border-slate-700 dark:bg-slate-950">
      <div className="mb-3">
        <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100">Notes</h3>
        <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">
          Shared notes for moving the proposal toward consensus.
        </p>
      </div>

      <div className="space-y-2">
        {comments.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-slate-400">No notes yet.</p>
        ) : (
          comments.map((comment) => (
            <div
              key={comment.id}
              className="rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            >
              <div className="font-medium">
                {comment.userId === currentUserId
                  ? 'You'
                  : userNameById.get(comment.userId) || 'Unknown'}
              </div>
              <div className="mt-1">{comment.text}</div>
            </div>
          ))
        )}
      </div>

      <div className="mt-3 flex items-start gap-2">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={3}
          placeholder="Add a note"
          className="min-h-[4.5rem] flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
        />
        <button
          type="button"
          onClick={submit}
          disabled={draft.trim().length === 0}
          className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Add Note
        </button>
      </div>
    </section>
  );
}
