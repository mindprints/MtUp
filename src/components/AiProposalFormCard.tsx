import { useState } from 'react';
import type { AiActionProposal } from '@/types';

export type AiProposalFormValues = {
  title: string;
  dates: string;
  times: string;
  invitees: string;
  place: string;
  requirements: string;
  comments: string;
};

type AiProposalFormCardProps = {
  proposal: AiActionProposal;
  onPropose: (values: AiProposalFormValues, proposal: AiActionProposal) => void | Promise<void>;
  onCancel?: () => void;
  isSubmitting?: boolean;
  isCompleted?: boolean;
};

export function AiProposalFormCard({
  proposal,
  onPropose,
  onCancel,
  isSubmitting = false,
  isCompleted = false,
}: AiProposalFormCardProps) {
  const draft = proposal.payload?.proposalDraft;
  const [values, setValues] = useState<AiProposalFormValues>({
    title: draft?.title || '',
    dates: draft?.form?.dates || draft?.specifics?.date || '',
    times: draft?.form?.times || draft?.specifics?.time || '',
    invitees: draft?.form?.invitees || 'Everyone in active group',
    place: draft?.form?.place || draft?.specifics?.location || '',
    requirements: draft?.form?.requirements || '',
    comments: draft?.form?.comments || '',
  });

  const update = (key: keyof AiProposalFormValues, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="rounded-md border border-gray-300 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-slate-400">
        Something like this...
      </div>
      <div className="grid grid-cols-1 gap-3">
        <label className="text-xs text-gray-700 dark:text-slate-200">
          Title
          <input
            type="text"
            value={values.title}
            onChange={(e) => update('title', e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
        </label>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="text-xs text-gray-700 dark:text-slate-200">
            Date / Dates
            <input
              type="text"
              value={values.dates}
              onChange={(e) => update('dates', e.target.value)}
              placeholder="YYYY-MM-DD or YYYY-MM-DD to YYYY-MM-DD"
              className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </label>
          <label className="text-xs text-gray-700 dark:text-slate-200">
            Time(s)
            <input
              type="text"
              value={values.times}
              onChange={(e) => update('times', e.target.value)}
              placeholder="Evening, 7pm, 6-9pm"
              className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </label>
        </div>
        <label className="text-xs text-gray-700 dark:text-slate-200">
          Invitees
          <input
            type="text"
            value={values.invitees}
            onChange={(e) => update('invitees', e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
        </label>
        <label className="text-xs text-gray-700 dark:text-slate-200">
          Place
          <input
            type="text"
            value={values.place}
            onChange={(e) => update('place', e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
        </label>
        <label className="text-xs text-gray-700 dark:text-slate-200">
          Requirements
          <textarea
            value={values.requirements}
            onChange={(e) => update('requirements', e.target.value)}
            rows={2}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
        </label>
        <label className="text-xs text-gray-700 dark:text-slate-200">
          Comments
          <textarea
            value={values.comments}
            onChange={(e) => update('comments', e.target.value)}
            rows={2}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
        </label>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={isSubmitting || isCompleted || values.title.trim().length === 0}
          onClick={() => onPropose(values, proposal)}
          className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isCompleted ? 'Proposed' : isSubmitting ? 'Proposing...' : 'Propose'}
        </button>
        <button
          type="button"
          disabled={isSubmitting || isCompleted}
          onClick={onCancel}
          className="rounded border border-gray-300 px-3 py-1.5 text-xs text-gray-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:text-slate-200"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
