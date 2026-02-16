import { useMemo } from 'react';
import type { DecisionOption, DecisionVote, VotingMode } from '@/types';

type DecisionOptionListProps = {
  mode: VotingMode;
  options: DecisionOption[];
  votes: DecisionVote[];
  currentUserVote: DecisionVote | null;
  currentUserId: string;
  currentUserIsAdmin: boolean;
  onSingleVote: (optionId: string) => void;
  onMultiVoteToggle: (optionId: string) => void;
  onRankedMove: (optionId: string, direction: 'up' | 'down') => void;
  onDeleteOption: (optionId: string) => void;
};

export function DecisionOptionList({
  mode,
  options,
  votes,
  currentUserVote,
  currentUserId,
  currentUserIsAdmin,
  onSingleVote,
  onMultiVoteToggle,
  onRankedMove,
  onDeleteOption,
}: DecisionOptionListProps) {
  const getOptionSupport = (optionId: string) => {
    if (mode === 'multi') {
      return votes.filter((vote) => vote.selectedOptionIds?.includes(optionId)).length;
    }
    return votes.filter((vote) => vote.rankedOptionIds?.[0] === optionId).length;
  };

  const getOptionSupportPercent = (optionId: string) => {
    if (votes.length === 0) return 0;
    return Math.round((getOptionSupport(optionId) / votes.length) * 100);
  };

  const rankedDisplayOrder = useMemo(() => {
    if (mode !== 'ranked') return options;
    const userRanking = currentUserVote?.rankedOptionIds || [];
    const order = [
      ...userRanking,
      ...options.map((option) => option.id).filter((id) => !userRanking.includes(id)),
    ];

    return order
      .map((id) => options.find((option) => option.id === id))
      .filter((option): option is DecisionOption => Boolean(option));
  }, [mode, currentUserVote?.rankedOptionIds, options]);

  return (
    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
      {options.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-slate-400">
          No options yet for this dimension.
        </p>
      )}

      {rankedDisplayOrder.map((option, index) => {
        const support = getOptionSupport(option.id);
        const supportPercent = getOptionSupportPercent(option.id);
        const isSingleSelected = currentUserVote?.rankedOptionIds?.[0] === option.id;
        const isMultiSelected = currentUserVote?.selectedOptionIds?.includes(option.id);
        const isInRankedVote = currentUserVote?.rankedOptionIds?.includes(option.id);
        const canDelete = option.createdBy === currentUserId || currentUserIsAdmin;

        return (
          <div
            key={option.id}
            className="rounded-md border border-gray-200 dark:border-slate-700 p-2"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                  {mode === 'ranked' && (
                    <span className="mr-2 text-xs text-gray-500 dark:text-slate-400">
                      #{index + 1}
                    </span>
                  )}
                  {option.label}
                </p>
                <p className="text-xs text-gray-500 dark:text-slate-400">
                  {support} vote{support === 1 ? '' : 's'} ({supportPercent}%)
                </p>
              </div>
              <div className="flex items-center gap-1">
                {mode === 'single' && (
                  <button
                    type="button"
                    onClick={() => onSingleVote(option.id)}
                    className={`px-2 py-1 text-xs rounded border ${
                      isSingleSelected
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600'
                    }`}
                  >
                    {isSingleSelected ? 'Selected' : 'Select'}
                  </button>
                )}

                {mode === 'multi' && (
                  <button
                    type="button"
                    onClick={() => onMultiVoteToggle(option.id)}
                    className={`px-2 py-1 text-xs rounded border ${
                      isMultiSelected
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-700 border-gray-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600'
                    }`}
                  >
                    {isMultiSelected ? 'Included' : 'Include'}
                  </button>
                )}

                {mode === 'ranked' && (
                  <>
                    <button
                      type="button"
                      onClick={() => onRankedMove(option.id, 'up')}
                      className="px-2 py-1 text-xs rounded border bg-white text-gray-700 border-gray-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600"
                      title="Move up"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => onRankedMove(option.id, 'down')}
                      className="px-2 py-1 text-xs rounded border bg-white text-gray-700 border-gray-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600"
                      title="Move down"
                    >
                      ↓
                    </button>
                    {isInRankedVote && currentUserVote?.rankedOptionIds?.[0] === option.id && (
                      <span className="text-xs text-blue-600">Top</span>
                    )}
                  </>
                )}

                {canDelete && (
                  <button
                    type="button"
                    onClick={() => onDeleteOption(option.id)}
                    className="px-2 py-1 text-xs rounded border bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>

            <div className="mt-2 h-2 rounded-full bg-gray-200 dark:bg-slate-700">
              <div
                className="h-2 rounded-full bg-blue-500"
                style={{ width: `${supportPercent}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
