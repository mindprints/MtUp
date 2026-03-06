import type { Proposal } from '@/types';
import { ProposalCardDrafts, formatDateRangeText } from '@/components/ai-assistant/shared';

type SuggestAlternativesModalProps = {
    proposal: Proposal;
    draft: ProposalCardDrafts[string] | undefined;
    onDraftChange: (updates: Partial<ProposalCardDrafts[string]>) => void;
    onSubmit: (proposal: Proposal) => void;
    onClose: (proposalId: string) => void;
};

export function SuggestAlternativesModal({
    proposal,
    draft,
    onDraftChange,
    onSubmit,
    onClose,
}: SuggestAlternativesModalProps) {
    return (
        <div className="mt-2 rounded-xl border border-gray-200 bg-white p-2.5 shadow-sm dark:border-slate-700 dark:bg-slate-950">
            <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-700 dark:text-slate-200">
                    Suggest Alternatives
                </p>
                <button
                    type="button"
                    onClick={() => onClose(proposal.id)}
                    className="rounded border border-gray-300 px-2 py-1 text-[11px] text-gray-700 dark:border-slate-600 dark:text-slate-200"
                >
                    Close
                </button>
            </div>
            <div className={`grid grid-cols-1 gap-2 ${proposal.type === 'sejour' ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
                <input
                    type="date"
                    value={draft?.startDateSuggestion || ''}
                    onChange={(e) =>
                        onDraftChange({
                            dateSuggestion: formatDateRangeText(
                                e.target.value,
                                proposal.type === 'sejour' ? draft?.endDateSuggestion || '' : e.target.value
                            ),
                            startDateSuggestion: e.target.value,
                            endDateSuggestion: proposal.type === 'sejour' ? draft?.endDateSuggestion || '' : e.target.value,
                            isSuggestModalOpen: true,
                        })
                    }
                    aria-label={proposal.type === 'sejour' ? 'Alternative start date' : 'Alternative date'}
                    className="rounded border border-gray-300 px-2 py-1.5 text-xs text-gray-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:[color-scheme:dark]"
                />
                {proposal.type === 'sejour' && (
                    <input
                        type="date"
                        value={draft?.endDateSuggestion || ''}
                        min={draft?.startDateSuggestion || undefined}
                        onChange={(e) =>
                            onDraftChange({
                                dateSuggestion: formatDateRangeText(
                                    draft?.startDateSuggestion || '',
                                    e.target.value
                                ),
                                startDateSuggestion: draft?.startDateSuggestion || '',
                                endDateSuggestion: e.target.value,
                                isSuggestModalOpen: true,
                            })
                        }
                        aria-label="Alternative end date"
                        className="rounded border border-gray-300 px-2 py-1.5 text-xs text-gray-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:[color-scheme:dark]"
                    />
                )}
                <input
                    type="time"
                    value={draft?.timeSuggestion || ''}
                    step={900}
                    onChange={(e) =>
                        onDraftChange({
                            timeSuggestion: e.target.value,
                            isSuggestModalOpen: true,
                        })
                    }
                    aria-label="Alternative time"
                    className="rounded border border-gray-300 px-2 py-1.5 text-xs text-gray-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:[color-scheme:dark]"
                />
                <input
                    type="text"
                    value={draft?.placeSuggestion || ''}
                    onChange={(e) =>
                        onDraftChange({
                            placeSuggestion: e.target.value,
                            isSuggestModalOpen: true,
                        })
                    }
                    placeholder="Place: neighborhood / venue"
                    className="rounded border border-gray-300 px-2 py-1.5 text-xs text-gray-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
            </div>
            <div className="mt-2 flex justify-end">
                <button
                    type="button"
                    onClick={() => onSubmit(proposal)}
                    disabled={
                        !(
                            draft?.startDateSuggestion?.trim() ||
                            draft?.endDateSuggestion?.trim() ||
                            draft?.timeSuggestion?.trim() ||
                            draft?.placeSuggestion?.trim()
                        )
                    }
                    className="rounded bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                >
                    Add Alternatives
                </button>
            </div>
        </div>
    );
}
