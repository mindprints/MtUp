import type { Proposal, User, Availability } from '@/types';
import { proposalThreadStore } from '@/lib/proposalThreadStore';
import {
    canGenerateProposalThumbnail,
    getThumbnailGeneratorDebugState,
} from '@/lib/thumbnailGenerator';
import { SuggestAlternativesModal } from '@/components/ai-assistant/SuggestAlternativesModal';
import { ProposalCommentsSection } from '@/components/ai-assistant/ProposalCommentsSection';
import {
    ProposalCardDrafts,
    proposalCardTheme,
    ProposalFlag,
    userInitials,
    parseIsoDatesFromText,
    formatTo24HourTimeText,
    formatProposalBaseline,
} from '@/components/ai-assistant/shared';

export type ProposalCardProps = {
    proposal: Proposal;
    index: number;
    userId: string;
    compact: boolean;
    displayGroupUsers: Array<Pick<User, 'id' | 'name' | 'isAdmin'>>;
    proposalFeedRefreshTick: number;
    proposalAvailabilities: Availability[];

    selectedAlternativeIds: Record<string, boolean>;
    toggleAlternativeSelection: (proposalId: string, optionId: string) => void;

    proposalThumbnailUrl: string | undefined;
    thumbnailGenerating: boolean;
    thumbnailError: string | undefined;
    handleGenerateProposalThumbnail: (proposal: Proposal) => void | Promise<void>;

    draft: ProposalCardDrafts[string] | undefined;
    setDraft: (updates: Partial<ProposalCardDrafts[string]>) => void;
    handleSubmitAlternatives: (proposal: Proposal) => void;
    closeSuggestAlternativesModal: (proposalId: string) => void;
    openSuggestAlternativesModal: (proposalId: string) => void;

    handleAffirmAvailabilityAsProposed: (proposal: Proposal) => void;
    openCalendarPopup: (
        proposal: Proposal,
        originalDates: string[],
        alternativeDates: string[]
    ) => void;
    handleAddToCalendar: (proposal: Proposal) => void;

    commentDraft: string;
    setCommentDraft: (draft: string) => void;
    handleAddProposalComment: (proposal: Proposal) => void | Promise<void>;

    userNameById: Map<string, string>;
};

export function ProposalCard({
    proposal,
    index,
    userId,
    compact,
    displayGroupUsers,
    proposalFeedRefreshTick,
    proposalAvailabilities,
    selectedAlternativeIds,
    toggleAlternativeSelection,
    proposalThumbnailUrl,
    thumbnailGenerating,
    thumbnailError,
    handleGenerateProposalThumbnail,
    draft,
    setDraft,
    handleSubmitAlternatives,
    closeSuggestAlternativesModal,
    openSuggestAlternativesModal,
    handleAffirmAvailabilityAsProposed,
    openCalendarPopup,
    handleAddToCalendar,
    commentDraft,
    setCommentDraft,
    handleAddProposalComment,
    userNameById,
}: ProposalCardProps) {
    const theme = proposalCardTheme(index);
    const contributions = proposalThreadStore.listForProposal(proposal.id);
    const userNames = new Map(displayGroupUsers.map((u) => [u.id, u.name]));
    const fieldChanges = contributions.filter((c) => c.kind === 'field_change');
    const dateChanges = fieldChanges.filter((c) => c.field === 'date');
    const timeChanges = fieldChanges.filter((c) => c.field === 'time');
    const placeChanges = fieldChanges.filter((c) => c.field === 'place');

    const participantRows = displayGroupUsers.map((member) => {
        const memberContributions = contributions.filter((c) => c.userId === member.id);
        const hasAffirmation = memberContributions.some((c) => c.kind === 'affirmation');
        const hasDateDelta = memberContributions.some(
            (c) => c.kind === 'field_change' && c.field === 'date'
        );
        const availability = proposalAvailabilities.find((a) => a.userId === member.id);
        return {
            member,
            hasAffirmation,
            hasDateDelta,
            availabilityDateCount: availability?.dates.length || 0,
        };
    });

    const myHasExplicitAffirmation = proposalThreadStore.hasExplicitAffirmation(proposal.id, userId);
    const shouldShowAffirmButton = !myHasExplicitAffirmation;
    const subscribedCount = participantRows.filter((row) => row.hasAffirmation).length;
    const proposalAuthorId = proposal.authoredBy || proposal.createdBy;
    const proposalCreatorName = userNames.get(proposalAuthorId) || 'Unknown';
    const resolverMetadata = proposal.specifics?.resolver;

    const proposerNote =
        proposal.comments
            ?.filter((comment) => comment.userId === proposalAuthorId)
            .slice(-1)[0]
            ?.text?.trim() || 'No proposer notes yet.';
    const requirementsNote =
        proposal.specifics?.requirements ||
        proposal.comments
            ?.find((comment) => /requirement|require|need/i.test(comment.text))
            ?.text?.trim() || 'No requirements listed.';

    const baselineDateText = proposal.specifics?.date || '';
    const originalCalendarDates = parseIsoDatesFromText(baselineDateText);
    const alternativeCalendarDates = Array.from(
        new Set(
            dateChanges.flatMap((change) => {
                if (typeof change.value.dateText === 'string') {
                    return parseIsoDatesFromText(String(change.value.dateText));
                }
                if (typeof change.value.text === 'string') {
                    return parseIsoDatesFromText(String(change.value.text));
                }
                return [];
            })
        )
    );

    const thumbnailBusy = Boolean(thumbnailGenerating);
    const thumbnailDebug = getThumbnailGeneratorDebugState();

    const handleUpdateDraft = (updates: Partial<ProposalCardDrafts[string]>) => {
        setDraft({
            ...(draft || {
                dateSuggestion: '',
                startDateSuggestion: '',
                endDateSuggestion: '',
                timeSuggestion: '',
                placeSuggestion: '',
            }),
            ...updates,
        });
    };

    const imageHeader = (
        <div className="relative">
            <div className="aspect-[16/7] w-full overflow-hidden bg-white/40 dark:bg-slate-900/40">
                {proposalThumbnailUrl ? (
                    <img
                        src={proposalThumbnailUrl}
                        alt={`${proposal.title} thumbnail`}
                        className="h-full w-full object-cover"
                    />
                ) : (
                    <div
                        className={`flex h-full w-full items-center justify-center text-6xl ${theme.tile}`}
                        title="Thumbnail placeholder (can be replaced with image)"
                    >
                        <span aria-hidden="true">{proposal.emoji}</span>
                    </div>
                )}
            </div>
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-2.5">
                <div className="flex items-end justify-between gap-3">
                    <div>
                        <p className="text-base font-semibold text-white drop-shadow-sm">{proposal.title}</p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-white/85">
                            <span>by {proposalCreatorName}</span>
                            {resolverMetadata?.variantLabel && (
                                <span className="rounded-full bg-sky-500/85 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white">
                                    {resolverMetadata.variantLabel}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    const subscribedAvatars = (
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <span className={compact ? 'text-[10px] font-medium text-gray-700 dark:text-slate-200' : 'text-xs font-medium text-gray-700 dark:text-slate-200'}>
                Subscribed {subscribedCount}/{participantRows.length}
            </span>
            {participantRows.map((row) => (
                <span
                    key={`avatar-${row.member.id}`}
                    title={`${row.member.name}: ${row.hasAffirmation ? 'subscribed' : 'not subscribed'}`}
                    className={`relative inline-flex h-7 w-7 items-center justify-center rounded-full border text-[10px] font-semibold ${row.hasAffirmation
                            ? 'border-emerald-500 bg-emerald-500 text-white'
                            : 'border-gray-300 bg-white text-gray-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'
                        }`}
                >
                    {userInitials(row.member.name)}
                    {row.hasAffirmation && (
                        <span className="absolute -right-1 -top-1 rounded-full bg-emerald-800 px-1 text-[8px] leading-3 text-white">
                            IN
                        </span>
                    )}
                </span>
            ))}
        </div>
    );

    if (!compact) {
        return (
            <div
                key={`${proposal.id}-${proposalFeedRefreshTick}`}
                className={`h-full min-h-full snap-start overflow-hidden rounded-[1rem] border-2 shadow ${theme.shell} flex flex-col`}
            >
                {imageHeader}
                <div className="flex flex-1 flex-col p-2.5">
                    {subscribedAvatars}
                    <div className="mt-2 space-y-2.5 rounded-lg border border-white/70 bg-white/70 p-2.5 text-sm leading-6 text-gray-800 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-200">
                        <div className="grid grid-cols-1 gap-2">
                            <div className="space-y-1">
                                <div>
                                    <span className="font-semibold">Date:</span> {baselineDateText || 'Not set'}
                                </div>
                                {dateChanges.length > 0 && (
                                    <div className="space-y-1 pl-2">
                                        {dateChanges.map((change) => {
                                            const optionId = `date-${change.id}`;
                                            return (
                                                <label key={`date-${change.id}`} className="flex items-start gap-2 text-xs">
                                                    <input
                                                        type="checkbox"
                                                        checked={Boolean(selectedAlternativeIds?.[optionId])}
                                                        onChange={() => toggleAlternativeSelection(proposal.id, optionId)}
                                                        className="mt-0.5 h-3.5 w-3.5 rounded border-gray-300"
                                                    />
                                                    <span>
                                                        <span className="font-medium">
                                                            {userInitials(userNames.get(change.userId) || '?')}:
                                                        </span>{' '}
                                                        {typeof change.value.dateText === 'string'
                                                            ? String(change.value.dateText)
                                                            : typeof change.value.text === 'string'
                                                                ? String(change.value.text)
                                                                : 'unspecified'}
                                                    </span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                            <div className="space-y-1">
                                <div>
                                    <span className="font-semibold">Time:</span>{' '}
                                    {formatTo24HourTimeText(proposal.specifics?.time || 'Not set')}
                                </div>
                                {timeChanges.length > 0 && (
                                    <div className="space-y-1 pl-2">
                                        {timeChanges.map((change) => {
                                            const optionId = `time-${change.id}`;
                                            return (
                                                <label key={`time-${change.id}`} className="flex items-start gap-2 text-xs">
                                                    <input
                                                        type="checkbox"
                                                        checked={Boolean(selectedAlternativeIds?.[optionId])}
                                                        onChange={() => toggleAlternativeSelection(proposal.id, optionId)}
                                                        className="mt-0.5 h-3.5 w-3.5 rounded border-gray-300"
                                                    />
                                                    <span>
                                                        <span className="font-medium">
                                                            {userInitials(userNames.get(change.userId) || '?')}:
                                                        </span>{' '}
                                                        {typeof change.value.text === 'string'
                                                            ? formatTo24HourTimeText(String(change.value.text))
                                                            : 'unspecified'}
                                                    </span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                            <div className="space-y-1">
                                <div>
                                    <span className="font-semibold">Place:</span>{' '}
                                    {proposal.specifics?.location || 'Not set'}
                                </div>
                                {placeChanges.length > 0 && (
                                    <div className="space-y-1 pl-2">
                                        {placeChanges.map((change) => {
                                            const optionId = `place-${change.id}`;
                                            return (
                                                <label key={`place-${change.id}`} className="flex items-start gap-2 text-xs">
                                                    <input
                                                        type="checkbox"
                                                        checked={Boolean(selectedAlternativeIds?.[optionId])}
                                                        onChange={() => toggleAlternativeSelection(proposal.id, optionId)}
                                                        className="mt-0.5 h-3.5 w-3.5 rounded border-gray-300"
                                                    />
                                                    <span>
                                                        <span className="font-medium">
                                                            {userInitials(userNames.get(change.userId) || '?')}:
                                                        </span>{' '}
                                                        {typeof change.value.text === 'string'
                                                            ? String(change.value.text)
                                                            : 'unspecified'}
                                                    </span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div>
                            <span className="font-semibold">Proposer notes:</span> {proposerNote}
                        </div>
                        <div>
                            <span className="font-semibold">Requirements:</span> {requirementsNote}
                        </div>
                        {resolverMetadata?.variantOfProposalId && (
                            <div>
                                <span className="font-semibold">Resolver fork:</span>{' '}
                                from {resolverMetadata.originalProposalTitle || 'original proposal'}
                                {resolverMetadata.chosenTimeLabel ? ` | Time: ${resolverMetadata.chosenTimeLabel}` : ''}
                                {resolverMetadata.chosenPlaceLabel ? ` | Place: ${resolverMetadata.chosenPlaceLabel}` : ''}
                            </div>
                        )}
                        <ProposalCommentsSection
                            proposal={proposal}
                            userNameById={userNameById}
                            commentDraftByProposalId={{ [proposal.id]: commentDraft }}
                            setCommentDraftByProposalId={(val) => {
                                if (typeof val === 'function') {
                                    const res = val({ [proposal.id]: commentDraft });
                                    setCommentDraft(res[proposal.id] || '');
                                } else {
                                    setCommentDraft(val[proposal.id] || '');
                                }
                            }}
                            handleAddProposalComment={handleAddProposalComment}
                            theme="gray"
                            containerClassName="mt-4"
                        />
                        {dateChanges.length === 0 &&
                            timeChanges.length === 0 &&
                            placeChanges.length === 0 && (
                                <p className="text-xs leading-5 text-gray-600 dark:text-slate-300">
                                    No alternatives suggested yet.
                                </p>
                            )}
                    </div>

                    {draft?.isSuggestModalOpen && (
                        <SuggestAlternativesModal
                            proposal={proposal}
                            draft={draft}
                            onDraftChange={handleUpdateDraft}
                            onSubmit={handleSubmitAlternatives}
                            onClose={closeSuggestAlternativesModal}
                        />
                    )}

                    <div className="mt-auto pt-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                            {shouldShowAffirmButton && (
                                <button
                                    type="button"
                                    onClick={() => handleAffirmAvailabilityAsProposed(proposal)}
                                    className="rounded bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                                >
                                    I&apos;m available as proposed
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() =>
                                    openCalendarPopup(proposal, originalCalendarDates, alternativeCalendarDates)
                                }
                                className="rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                                Calendar
                            </button>
                            <button
                                type="button"
                                onClick={() => handleAddToCalendar(proposal)}
                                className="rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                                To My Calendar
                            </button>
                            <button
                                type="button"
                                onClick={() => openSuggestAlternativesModal(proposal.id)}
                                className="rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                                Suggest Alternatives
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // COMPACT MODE
    return (
        <div
            key={`${proposal.id}-${proposalFeedRefreshTick}`}
            className={`snap-start overflow-hidden rounded-[1rem] border shadow-sm ${theme.shell} flex min-h-[70vh] flex-col`}
        >
            {imageHeader}
            <div className="flex flex-1 flex-col p-2.5">
                {subscribedAvatars}
                <div className="flex flex-wrap gap-1.5">
                    {resolverMetadata?.variantLabel && (
                        <ProposalFlag label={resolverMetadata.variantLabel} tone="info" />
                    )}
                    <ProposalFlag label="proposer auto-in" tone="good" />
                    {dateChanges.length > 0 && (
                        <ProposalFlag
                            label={`${dateChanges.length} date idea${dateChanges.length > 1 ? 's' : ''}`}
                            tone="warm"
                        />
                    )}
                    {timeChanges.length > 0 && (
                        <ProposalFlag
                            label={`${timeChanges.length} time idea${timeChanges.length > 1 ? 's' : ''}`}
                            tone="info"
                        />
                    )}
                    {placeChanges.length > 0 && (
                        <ProposalFlag
                            label={`${placeChanges.length} place idea${placeChanges.length > 1 ? 's' : ''}`}
                            tone="info"
                        />
                    )}
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {shouldShowAffirmButton ? (
                        <button
                            type="button"
                            onClick={() => handleAffirmAvailabilityAsProposed(proposal)}
                            className="rounded bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                        >
                            I&apos;m available as proposed
                        </button>
                    ) : (
                        <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-200">
                            You&apos;re in
                        </span>
                    )}

                    <button
                        type="button"
                        onClick={() => openSuggestAlternativesModal(proposal.id)}
                        className="rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                        Suggest Alternatives
                    </button>
                    <button
                        type="button"
                                    onClick={() => void handleGenerateProposalThumbnail(proposal)}
                        disabled={!canGenerateProposalThumbnail() || thumbnailBusy}
                        className="rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                        title={
                            canGenerateProposalThumbnail()
                                ? 'Generate thumbnail image'
                                : 'Set VITE_THUMBNAIL_OPENROUTER_API_KEY (or VITE_OPENROUTER_API_KEY) to enable thumbnail generation'
                        }
                    >
                        {thumbnailBusy ? 'Generating thumbnail...' : 'Generate Thumbnail'}
                    </button>
                </div>

                {thumbnailError && (
                    <p className="mt-2 text-[11px] text-red-700 dark:text-red-300">{thumbnailError}</p>
                )}
                {!canGenerateProposalThumbnail() && (
                    <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-300">
                        Thumbnail config: provider={thumbnailDebug.provider}, apiKey=
                        {thumbnailDebug.hasApiKey ? 'yes' : 'no'}, model=
                        {thumbnailDebug.hasModel ? 'yes' : 'no'}
                    </p>
                )}

                <div className="mt-2 flex flex-wrap gap-1.5">
                    <details className="group rounded-full">
                        <summary
                            className={`cursor-pointer list-none rounded-full border px-2.5 py-1 text-[11px] ${theme.accent}`}
                        >
                            Plan
                        </summary>
                        <div className="mt-2 rounded-xl border border-white/70 bg-white/80 px-2.5 py-2 text-xs text-gray-700 shadow-sm dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-200">
                            {formatProposalBaseline(proposal)}
                        </div>
                    </details>

                    <details className="group rounded-full">
                        <summary className="cursor-pointer list-none rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] text-gray-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                            Crew
                        </summary>
                        <div className="mt-2 flex flex-wrap gap-1.5 rounded-xl border border-white/70 bg-white/80 p-2 shadow-sm dark:border-slate-700 dark:bg-slate-950/70">
                            {participantRows.map((row) => (
                                <span
                                    key={row.member.id}
                                    className={`rounded-full border px-2 py-1 text-[11px] ${row.member.id === userId
                                            ? 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-200'
                                            : 'border-gray-200 bg-white text-gray-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200'
                                        }`}
                                >
                                    {row.member.name}
                                    {row.hasDateDelta
                                        ? ' • date idea'
                                        : row.hasAffirmation
                                            ? ' • in'
                                            : ' • waiting'}
                                </span>
                            ))}
                        </div>
                    </details>

                    <details className="group rounded-full">
                        <summary className="cursor-pointer list-none rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] text-gray-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                            Changes
                        </summary>
                        <div className="mt-2 space-y-1.5 rounded-xl border border-white/70 bg-white/80 p-2 shadow-sm dark:border-slate-700 dark:bg-slate-950/70">
                            {fieldChanges.length === 0 ? (
                                <p className="text-xs text-gray-600 dark:text-slate-300">No alternatives yet.</p>
                            ) : (
                                fieldChanges
                                    .slice()
                                    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                                    .map((change) => (
                                        <div
                                            key={change.id}
                                            className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200"
                                        >
                                            <span className="font-medium">
                                                {userNames.get(change.userId) || 'Someone'}
                                            </span>{' '}
                                            <span className="uppercase text-[10px] opacity-80">
                                                {change.field || 'change'}
                                            </span>{' '}
                                            {typeof change.value.dateText === 'string'
                                                ? String(change.value.dateText)
                                                : typeof change.value.text === 'string'
                                                    ? String(change.value.text)
                                                    : 'unspecified'}
                                        </div>
                                    ))
                            )}
                        </div>
                    </details>
                </div>

                {draft?.isSuggestModalOpen && (
                    <SuggestAlternativesModal
                        proposal={proposal}
                        draft={draft}
                        onDraftChange={handleUpdateDraft}
                        onSubmit={handleSubmitAlternatives}
                        onClose={closeSuggestAlternativesModal}
                    />
                )}
            </div>
        </div>
    );
}
