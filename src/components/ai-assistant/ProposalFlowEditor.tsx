import React from 'react';
import type { Proposal } from '@/types';
import {
    ProposalFlowEditDraft,
    QuarterHourTimeSelect,
    SejourDateTimeRow,
    buildProposalFlowEditDraft,
    parseDateRangeFromText,
    parseSejourTimeText,
} from '@/components/ai-assistant/shared';
import { ProposalCommentsSection } from './ProposalCommentsSection';
import { proposalThreadStore } from '@/lib/proposalThreadStore';

type EditorAlternativeDraft = {
    startDate: string;
    endDate: string;
    time: string;
    startTime: string;
    endTime: string;
    place: string;
};

type ProposalFlowEditorProps = {
    selectedEditableProposal: Proposal;
    proposalFlowEditDrafts: Record<string, ProposalFlowEditDraft>;
    userId: string;
    userNameById: Map<string, string>;
    updateProposalFlowEditField: (proposalId: string, field: keyof ProposalFlowEditDraft, value: string) => void;
    canEditSelectedProposal: boolean;

    editorAlternativeDraftByProposalId: Record<string, EditorAlternativeDraft>;
    updateEditorAlternativeDraftField: (proposalId: string, field: keyof EditorAlternativeDraft, value: string) => void;
    handleSubmitEditorAlternative: (proposal: Proposal) => void;

    commentDraftByProposalId: Record<string, string>;
    setCommentDraftByProposalId: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    handleAddProposalComment: (proposal: Proposal) => Promise<void> | void;

    proposalFlowSavingById: Record<string, boolean>;
    handleSaveProposalFlowEdit: (proposal: Proposal) => void;
};

export function ProposalFlowEditor({
    selectedEditableProposal: proposal,
    proposalFlowEditDrafts,
    userId,
    userNameById,
    updateProposalFlowEditField,
    canEditSelectedProposal,
    editorAlternativeDraftByProposalId,
    updateEditorAlternativeDraftField,
    handleSubmitEditorAlternative,
    commentDraftByProposalId,
    setCommentDraftByProposalId,
    handleAddProposalComment,
    proposalFlowSavingById,
    handleSaveProposalFlowEdit,
}: ProposalFlowEditorProps) {
    const draft = proposalFlowEditDrafts[proposal.id] || buildProposalFlowEditDraft(proposal);

    const contributions = proposalThreadStore
        .listForProposal(proposal.id)
        .filter((entry) => entry.kind === 'field_change' && entry.userId !== userId);

    const dateSuggestions = contributions.filter((entry) => entry.field === 'date');
    const timeSuggestions = contributions.filter((entry) => entry.field === 'time');
    const placeSuggestions = contributions.filter((entry) => entry.field === 'place');

    return (
        <>
            <input
                type="text"
                value={draft.title}
                onChange={(e) =>
                    updateProposalFlowEditField(proposal.id, 'title', e.target.value)
                }
                disabled={!canEditSelectedProposal}
                placeholder="Title"
                className="w-full rounded border border-indigo-300 bg-white px-2 py-1.5 text-xs text-gray-900 disabled:opacity-60 dark:border-indigo-900/70 dark:bg-slate-900 dark:text-slate-100"
            />

            <div className={`grid grid-cols-1 gap-1.5 ${proposal.type === 'sejour' ? '' : 'md:grid-cols-2'}`}>
                {proposal.type === 'sejour' ? (
                    <SejourDateTimeRow
                        startDate={draft.startDate}
                        endDate={draft.endDate}
                        startTime={draft.startTime}
                        endTime={draft.endTime}
                        onStartDateChange={(value) =>
                            updateProposalFlowEditField(proposal.id, 'startDate', value)
                        }
                        onEndDateChange={(value) =>
                            updateProposalFlowEditField(proposal.id, 'endDate', value)
                        }
                        onStartTimeChange={(value) =>
                            updateProposalFlowEditField(proposal.id, 'startTime', value)
                        }
                        onEndTimeChange={(value) =>
                            updateProposalFlowEditField(proposal.id, 'endTime', value)
                        }
                        startDateLabel="Start Date"
                        startTimeLabel="Start Time"
                        endDateLabel="End Date"
                        endTimeLabel="End Time"
                        startDateAriaLabel="Proposal start date"
                        startTimeAriaLabel="Proposal start time"
                        endDateAriaLabel="Proposal end date"
                        endTimeAriaLabel="Proposal end time"
                        disabled={!canEditSelectedProposal}
                        dateInputClassName="w-full rounded border border-indigo-300 bg-white px-2 py-1.5 text-xs text-gray-900 disabled:opacity-60 dark:border-indigo-900/70 dark:bg-slate-900 dark:text-slate-100 dark:[color-scheme:dark]"
                        timeSelectClassName="w-full rounded border border-indigo-300 bg-white px-2 py-1.5 text-xs text-gray-900 disabled:opacity-60 dark:border-indigo-900/70 dark:bg-slate-900 dark:text-slate-100 dark:[color-scheme:dark]"
                        labelClassName="text-[10px] font-medium uppercase tracking-wide text-indigo-700 dark:text-indigo-200"
                        separatorClassName="text-[11px] font-semibold text-indigo-400 dark:text-indigo-600"
                    />
                ) : (
                    <input
                        type="date"
                        value={draft.startDate}
                        onChange={(e) => {
                            updateProposalFlowEditField(proposal.id, 'startDate', e.target.value);
                            updateProposalFlowEditField(proposal.id, 'endDate', e.target.value);
                        }}
                        disabled={!canEditSelectedProposal}
                        aria-label="Proposal date"
                        className="w-full rounded border border-indigo-300 bg-white px-2 py-1.5 text-xs text-gray-900 disabled:opacity-60 dark:border-indigo-900/70 dark:bg-slate-900 dark:text-slate-100 dark:[color-scheme:dark]"
                    />
                )}
                {proposal.type !== 'sejour' && (
                    <QuarterHourTimeSelect
                        value={draft.time}
                        onChange={(value) =>
                            updateProposalFlowEditField(proposal.id, 'time', value)
                        }
                        disabled={!canEditSelectedProposal}
                        ariaLabel="Proposal time"
                        className="w-full rounded border border-indigo-300 bg-white px-2 py-1.5 text-xs text-gray-900 disabled:opacity-60 dark:border-indigo-900/70 dark:bg-slate-900 dark:text-slate-100 dark:[color-scheme:dark]"
                    />
                )}
            </div>

            <input
                type="text"
                value={draft.place}
                onChange={(e) =>
                    updateProposalFlowEditField(proposal.id, 'place', e.target.value)
                }
                disabled={!canEditSelectedProposal}
                placeholder="Place"
                className="w-full rounded border border-indigo-300 bg-white px-2 py-1.5 text-xs text-gray-900 disabled:opacity-60 dark:border-indigo-900/70 dark:bg-slate-900 dark:text-slate-100"
            />

            <div className="space-y-1 rounded border border-indigo-200 bg-indigo-50/70 p-2 text-[11px] dark:border-indigo-900/40 dark:bg-indigo-950/20">
                <p className="font-semibold text-indigo-900 dark:text-indigo-200">
                    Suggest alternative
                </p>
                {(() => {
                    const altDraft = editorAlternativeDraftByProposalId[proposal.id] || {
                        startDate: '',
                        endDate: '',
                        time: '',
                        startTime: '',
                        endTime: '',
                        place: '',
                    };
                    return (
                        <>
                            <div className={`grid grid-cols-1 gap-1.5 ${proposal.type === 'sejour' ? '' : 'md:grid-cols-3'}`}>
                                {proposal.type === 'sejour' ? (
                                    <SejourDateTimeRow
                                        startDate={altDraft.startDate}
                                        endDate={altDraft.endDate}
                                        startTime={altDraft.startTime}
                                        endTime={altDraft.endTime}
                                        onStartDateChange={(value) =>
                                            updateEditorAlternativeDraftField(proposal.id, 'startDate', value)
                                        }
                                        onEndDateChange={(value) =>
                                            updateEditorAlternativeDraftField(proposal.id, 'endDate', value)
                                        }
                                        onStartTimeChange={(value) =>
                                            updateEditorAlternativeDraftField(proposal.id, 'startTime', value)
                                        }
                                        onEndTimeChange={(value) =>
                                            updateEditorAlternativeDraftField(proposal.id, 'endTime', value)
                                        }
                                        startDateLabel="Start Date"
                                        startTimeLabel="Start Time"
                                        endDateLabel="End Date"
                                        endTimeLabel="End Time"
                                        startDateAriaLabel="Alternative start date"
                                        startTimeAriaLabel="Alternative start time"
                                        endDateAriaLabel="Alternative end date"
                                        endTimeAriaLabel="Alternative end time"
                                        disabled={!canEditSelectedProposal}
                                        dateInputClassName="w-full rounded border border-indigo-300 bg-white px-2 py-1.5 text-xs disabled:opacity-60 dark:border-indigo-900/70 dark:bg-slate-900 dark:[color-scheme:dark]"
                                        timeSelectClassName="w-full rounded border border-indigo-300 bg-white px-2 py-1.5 text-xs disabled:opacity-60 dark:border-indigo-900/70 dark:bg-slate-900 dark:[color-scheme:dark]"
                                        labelClassName="text-[10px] font-medium uppercase tracking-wide text-indigo-700 dark:text-indigo-200"
                                        separatorClassName="text-[11px] font-semibold text-indigo-400 dark:text-indigo-600"
                                    />
                                ) : (
                                    <>
                                        <input
                                            type="date"
                                            value={altDraft.startDate}
                                            onChange={(e) => {
                                                updateEditorAlternativeDraftField(
                                                    proposal.id,
                                                    'startDate',
                                                    e.target.value
                                                );
                                                updateEditorAlternativeDraftField(
                                                    proposal.id,
                                                    'endDate',
                                                    e.target.value
                                                );
                                            }}
                                            disabled={!canEditSelectedProposal}
                                            aria-label="Alternative date"
                                            className="rounded border border-indigo-300 bg-white px-2 py-1.5 text-xs disabled:opacity-60 dark:border-indigo-900/70 dark:bg-slate-900 dark:[color-scheme:dark]"
                                        />
                                        <QuarterHourTimeSelect
                                            value={altDraft.time}
                                            onChange={(value) =>
                                                updateEditorAlternativeDraftField(
                                                    proposal.id,
                                                    'time',
                                                    value
                                                )
                                            }
                                            disabled={!canEditSelectedProposal}
                                            ariaLabel="Alternative time"
                                            className="rounded border border-indigo-300 bg-white px-2 py-1.5 text-xs disabled:opacity-60 dark:border-indigo-900/70 dark:bg-slate-900 dark:[color-scheme:dark]"
                                        />
                                    </>
                                )}
                                <input
                                    type="text"
                                    value={altDraft.place}
                                    onChange={(e) =>
                                        updateEditorAlternativeDraftField(
                                            proposal.id,
                                            'place',
                                            e.target.value
                                        )
                                    }
                                    disabled={!canEditSelectedProposal}
                                    placeholder="Alternative place"
                                    className="rounded border border-indigo-300 bg-white px-2 py-1.5 text-xs disabled:opacity-60 dark:border-indigo-900/70 dark:bg-slate-900"
                                />
                            </div>
                            <div className="flex justify-end">
                                <button
                                    type="button"
                                    onClick={() => handleSubmitEditorAlternative(proposal)}
                                    disabled={!canEditSelectedProposal}
                                    className="rounded border border-indigo-300 bg-white px-2 py-1 text-[11px] text-indigo-800 hover:bg-indigo-100 disabled:opacity-50 dark:border-indigo-900/70 dark:bg-slate-900 dark:text-indigo-200 dark:hover:bg-indigo-900/20"
                                >
                                    Add Alternative
                                </button>
                            </div>
                        </>
                    );
                })()}
            </div>

            {(dateSuggestions.length > 0 ||
                timeSuggestions.length > 0 ||
                placeSuggestions.length > 0) && (
                    <div className="space-y-1.5 rounded border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
                        <p className="font-semibold">Alternatives from others</p>
                        {dateSuggestions.map((change) => {
                            const text =
                                typeof change.value.dateText === 'string'
                                    ? String(change.value.dateText)
                                    : typeof change.value.text === 'string'
                                        ? String(change.value.text)
                                        : '';
                            const parsed = parseDateRangeFromText(text);
                            return (
                                <div key={`proposal-flow-alt-date-${change.id}`} className="flex items-center gap-1.5">
                                    <span className="flex-1 truncate">
                                        {userNameById.get(change.userId) || 'Someone'} suggested date:{' '}
                                        {text || 'unspecified'}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            updateProposalFlowEditField(proposal.id, 'startDate', parsed.startDate);
                                            updateProposalFlowEditField(
                                                proposal.id,
                                                'endDate',
                                                proposal.type === 'sejour' ? parsed.endDate : parsed.startDate
                                            );
                                        }}
                                        disabled={!canEditSelectedProposal}
                                        className="rounded border border-amber-300 bg-white px-1.5 py-0.5 text-[10px] disabled:opacity-50 dark:border-amber-800 dark:bg-slate-900"
                                    >
                                        Use
                                    </button>
                                </div>
                            );
                        })}
                        {timeSuggestions.map((change) => {
                            const text =
                                typeof change.value.text === 'string'
                                    ? String(change.value.text)
                                    : '';
                            return (
                                <div key={`proposal-flow-alt-time-${change.id}`} className="flex items-center gap-1.5">
                                    <span className="flex-1 truncate">
                                        {userNameById.get(change.userId) || 'Someone'} suggested time:{' '}
                                        {text || 'unspecified'}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (proposal.type === 'sejour') {
                                                const parsedTimes = parseSejourTimeText(text);
                                                updateProposalFlowEditField(proposal.id, 'startTime', parsedTimes.startTime || '');
                                                updateProposalFlowEditField(proposal.id, 'endTime', parsedTimes.endTime || '');
                                                return;
                                            }
                                            updateProposalFlowEditField(proposal.id, 'time', text);
                                        }}
                                        disabled={!canEditSelectedProposal}
                                        className="rounded border border-amber-300 bg-white px-1.5 py-0.5 text-[10px] disabled:opacity-50 dark:border-amber-800 dark:bg-slate-900"
                                    >
                                        Use
                                    </button>
                                </div>
                            );
                        })}
                        {placeSuggestions.map((change) => {
                            const text =
                                typeof change.value.text === 'string'
                                    ? String(change.value.text)
                                    : '';
                            return (
                                <div key={`proposal-flow-alt-place-${change.id}`} className="flex items-center gap-1.5">
                                    <span className="flex-1 truncate">
                                        {userNameById.get(change.userId) || 'Someone'} suggested place:{' '}
                                        {text || 'unspecified'}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => updateProposalFlowEditField(proposal.id, 'place', text)}
                                        disabled={!canEditSelectedProposal}
                                        className="rounded border border-amber-300 bg-white px-1.5 py-0.5 text-[10px] disabled:opacity-50 dark:border-amber-800 dark:bg-slate-900"
                                    >
                                        Use
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}

            <ProposalCommentsSection
                proposal={proposal}
                userNameById={userNameById}
                commentDraftByProposalId={commentDraftByProposalId}
                setCommentDraftByProposalId={setCommentDraftByProposalId}
                handleAddProposalComment={handleAddProposalComment}
                theme="indigo"
            />

            {canEditSelectedProposal ? (
                <div className="flex justify-end">
                    <button
                        type="button"
                        onClick={() => handleSaveProposalFlowEdit(proposal)}
                        disabled={
                            proposalFlowSavingById[proposal.id] ||
                            draft.title.trim().length === 0
                        }
                        className="rounded bg-indigo-700 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {proposalFlowSavingById[proposal.id] ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            ) : (
                <p className="text-[11px] text-indigo-700 dark:text-indigo-300">
                    View only. You can only edit your own activities.
                </p>
            )}
        </>
    );
}
