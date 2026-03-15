import { useState } from 'react';
import type { AiActionProposal } from '@/types';

type AiActionCardProps = {
  proposal: AiActionProposal;
  onApprove?: (proposal: AiActionProposal) => void | Promise<void>;
  onCancel?: () => void;
  isExecuting?: boolean;
  isCompleted?: boolean;
};

export function AiActionCard({
  proposal,
  onApprove,
  onCancel,
  isExecuting = false,
  isCompleted = false,
}: AiActionCardProps) {
  const [isChecked, setIsChecked] = useState(false);

  return (
    <div className="rounded-md border border-beige-400 bg-beige-50 p-3 text-sm text-amber-950 dark:border-amber-700 dark:bg-grey-950/30 dark:text-amber-100">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-wide">Action Proposal</div>
        {proposal.requiresApproval && (
          <span className="text-[10px] uppercase tracking-wide opacity-80">Approval required</span>
        )}
      </div>
      <div className="mt-1 font-medium">{proposal.summary}</div>
      {proposal.impact && <div className="mt-2 text-xs opacity-90">{proposal.impact}</div>}
      {!isCompleted && (
        <label className="mt-3 flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={isChecked}
            onChange={(e) => setIsChecked(e.target.checked)}
            className="h-3.5 w-3.5"
          />
          <span>I approve this action</span>
        </label>
      )}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={!isChecked || isExecuting || isCompleted || !onApprove}
          onClick={() => onApprove?.(proposal)}
          className="rounded border border-amber-400 px-2 py-1 text-xs disabled:opacity-60 disabled:cursor-not-allowed dark:border-amber-600"
        >
          {isCompleted ? 'Created' : isExecuting ? 'Creating...' : 'Approve & Create'}
        </button>
        <button
          type="button"
          disabled={isExecuting || isCompleted}
          onClick={onCancel}
          className="rounded border border-amber-400 px-2 py-1 text-xs disabled:opacity-60 disabled:cursor-not-allowed dark:border-amber-600"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
