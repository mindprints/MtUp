import React from 'react';
import type { Proposal } from '@/types';

type ProposalCommentsSectionProps = {
    proposal: Proposal;
    userNameById: Map<string, string>;
    commentDraftByProposalId: Record<string, string>;
    setCommentDraftByProposalId: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    handleAddProposalComment: (proposal: Proposal) => Promise<void> | void;
    containerClassName?: string;
    theme?: 'indigo' | 'gray';
    showTitle?: boolean;
};

export function ProposalCommentsSection({
    proposal,
    userNameById,
    commentDraftByProposalId,
    setCommentDraftByProposalId,
    handleAddProposalComment,
    containerClassName,
    theme = 'indigo',
    showTitle = true,
}: ProposalCommentsSectionProps) {
    const isIndigo = theme === 'indigo';
    const requirementsText = proposal.specifics?.requirements?.trim() || '';
    const commentItems = [
        ...(requirementsText
            ? [{ id: `requirements-${proposal.id}`, label: 'Notes', text: requirementsText }]
            : []),
        ...(proposal.comments || []).map((comment) => ({
            id: comment.id,
            label: userNameById.get(comment.userId) || 'User',
            text: comment.text,
        })),
    ];

    const outerBorderClasses = isIndigo
        ? "border-indigo-200 bg-indigo-50/70 dark:border-indigo-900/40 dark:bg-indigo-950/20"
        : "border-gray-200 bg-gray-50 dark:border-slate-800 dark:bg-slate-900";

    const titleClasses = isIndigo
        ? "text-indigo-900 dark:text-indigo-200"
        : "text-gray-800 dark:text-slate-300";

    const textareaClasses = isIndigo
        ? "border-indigo-300 dark:border-indigo-900/70"
        : "border-gray-300 dark:border-slate-700";

    const buttonClasses = isIndigo
        ? "border-indigo-300 text-indigo-800 hover:bg-indigo-100 dark:border-indigo-900/70 dark:text-indigo-200 dark:hover:bg-indigo-900/20"
        : "border-gray-300 text-gray-700 hover:bg-gray-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800";

    return (
        <div className={`space-y-1 rounded border p-2 text-[11px] ${outerBorderClasses} ${containerClassName || ''}`}>
            {showTitle && <p className={`font-semibold ${titleClasses}`}>Notes</p>}
            {commentItems.length > 0 && (
                <div className="space-y-1">
                    {commentItems.map((comment) => (
                        <div key={comment.id} className="rounded bg-white px-2 py-1 dark:bg-slate-900">
                            <span className="font-medium">
                                {comment.label}:
                            </span>{' '}
                            {comment.text}
                        </div>
                    ))}
                </div>
            )}
            <div className="flex items-start gap-1.5">
                <textarea
                    value={commentDraftByProposalId[proposal.id] || ''}
                    onChange={(e) =>
                        setCommentDraftByProposalId((prev) => ({
                            ...prev,
                            [proposal.id]: e.target.value,
                        }))
                    }
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            const draft = (commentDraftByProposalId[proposal.id] || '').trim();
                            if (!draft) return;
                            e.preventDefault();
                            void handleAddProposalComment(proposal);
                        }
                    }}
                    rows={2}
                    placeholder="Write a note"
                    className={`min-h-[3.5rem] flex-1 rounded border bg-white px-2 py-1.5 text-xs text-gray-900 dark:bg-slate-900 dark:text-slate-100 ${textareaClasses}`}
                />
                <button
                    type="button"
                    onClick={() => handleAddProposalComment(proposal)}
                    disabled={!(commentDraftByProposalId[proposal.id] || '').trim()}
                    className={`rounded border bg-white px-2 py-1 text-[11px] disabled:opacity-50 dark:bg-slate-900 ${buttonClasses}`}
                >
                    Add Note
                </button>
            </div>
        </div>
    );
}
