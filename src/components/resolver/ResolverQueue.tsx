import type { Proposal } from '@/types';

export type ResolverFilter = 'all' | 'event' | 'sejour' | 'mine';

type ResolverQueueProps = {
  proposals: Proposal[];
  selectedProposalId: string | null;
  onSelectProposal: (proposalId: string) => void;
  filter: ResolverFilter;
  onFilterChange: (filter: ResolverFilter) => void;
  showConfirmed: boolean;
  onShowConfirmedChange: (next: boolean) => void;
  currentUserId: string;
  userNameById: Map<string, string>;
  commentCountByProposalId: Record<string, number>;
  alternativeCountByProposalId: Record<string, number>;
};

const FILTER_OPTIONS: Array<{ value: ResolverFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'event', label: 'Events' },
  { value: 'sejour', label: 'Sejours' },
  { value: 'mine', label: 'Mine' },
];

export function ResolverQueue({
  proposals,
  selectedProposalId,
  onSelectProposal,
  filter,
  onFilterChange,
  showConfirmed,
  onShowConfirmedChange,
  currentUserId,
  userNameById,
  commentCountByProposalId,
  alternativeCountByProposalId,
}: ResolverQueueProps) {
  return (
    <aside className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-gray-200 bg-stone-50 dark:border-slate-700 dark:bg-slate-950">
      <div className="border-b border-gray-200 px-4 py-3 dark:border-slate-700">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100">Resolver</h2>
        <p className="mt-1 text-xs text-gray-600 dark:text-slate-400">
          Review proposals before they are finalized.
        </p>
      </div>

      <div className="space-y-3 border-b border-gray-200 px-4 py-3 dark:border-slate-700">
        <div className="flex flex-wrap gap-1.5">
          {FILTER_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onFilterChange(option.value)}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                filter === option.value
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs text-gray-700 dark:text-slate-300">
          <input
            type="checkbox"
            checked={showConfirmed}
            onChange={(e) => onShowConfirmedChange(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300"
          />
          Show confirmed
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {proposals.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 bg-white p-4 text-sm text-gray-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
            No proposals match the current filters.
          </div>
        ) : (
          <div className="space-y-2">
            {proposals.map((proposal) => {
              const isSelected = proposal.id === selectedProposalId;
              const proposalAuthorId = proposal.authoredBy || proposal.createdBy;
              const creatorName =
                proposalAuthorId === currentUserId
                  ? 'Mine'
                  : userNameById.get(proposalAuthorId) || 'Unknown';
              const variantLabel = proposal.specifics?.resolver?.variantLabel;

              return (
                <button
                  key={proposal.id}
                  type="button"
                  onClick={() => onSelectProposal(proposal.id)}
                  className={`w-full rounded-xl border p-3 text-left transition-colors ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/30'
                      : 'border-gray-200 bg-white hover:bg-gray-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-xl leading-none">{proposal.emoji}</span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-gray-900 dark:text-slate-100">
                        {proposal.title}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-gray-700 dark:bg-slate-800 dark:text-slate-300">
                          {proposal.type}
                        </span>
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                          {proposal.status}
                        </span>
                        {variantLabel && (
                          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-sky-800 dark:bg-sky-950/40 dark:text-sky-300">
                            {variantLabel}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="mt-2 text-[11px] text-gray-600 dark:text-slate-400">
                    {creatorName}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-gray-600 dark:text-slate-400">
                    <span>{commentCountByProposalId[proposal.id] || 0} comments</span>
                    <span>{alternativeCountByProposalId[proposal.id] || 0} alternatives</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
