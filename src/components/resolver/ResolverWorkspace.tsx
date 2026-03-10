import { useMemo, useState } from 'react';
import { ResolverAlternativesPanel } from '@/components/resolver/ResolverAlternativesPanel';
import { ResolverAvailabilityPanel } from '@/components/resolver/ResolverAvailabilityPanel';
import { ResolverCommentsPanel } from '@/components/resolver/ResolverCommentsPanel';
import { ResolverDecisionPanel } from '@/components/resolver/ResolverDecisionPanel';
import { ResolverSummaryCard } from '@/components/resolver/ResolverSummaryCard';
import { useProposals } from '@/lib/ProposalContext';
import { canConfirmDecision } from '@/lib/permissions';
import { buildResolverVariantPlan, getConsensusAssessment } from '@/lib/resolverUtils';
import { generateId } from '@/lib/utils';
import type { Availability, DecisionDimension, Proposal, User, VotingMode } from '@/types';

type ResolverWorkspaceProps = {
  proposal: Proposal | null;
  proposals: Proposal[];
  currentUser: User;
  availabilities: Availability[];
  userNameById: Map<string, string>;
  alternativeCount: number;
  commentCount: number;
  onAddComment: (proposalId: string, text: string) => void;
};

const RESOLVER_DIMENSIONS: DecisionDimension[] = ['time', 'place', 'requirement'];

function getDefaultMode(dimension: DecisionDimension): VotingMode {
  return dimension === 'requirement' ? 'multi' : 'single';
}

function buildFinalizationNotice({
  proposal,
  currentUser,
  memberCount,
}: {
  proposal: Proposal;
  currentUser: User;
  memberCount: number;
}) {
  const timeSummary = proposal.type === 'sejour'
    ? [proposal.specifics?.startTime, proposal.specifics?.endTime].filter(Boolean).join(' - ')
    : proposal.specifics?.time || '';
  const summaryBits = [
    proposal.specifics?.date ? `Date: ${proposal.specifics.date}` : null,
    timeSummary ? `Time: ${timeSummary}` : null,
    proposal.specifics?.location ? `Place: ${proposal.specifics.location}` : null,
  ].filter(Boolean);

  return `[Finalized notice] ${proposal.title} was confirmed by ${currentUser.name} on ${new Date().toLocaleString()}. ${summaryBits.join(' • ')}. Notice sent to ${memberCount} member${memberCount === 1 ? '' : 's'}.`;
}

export function ResolverWorkspace({
  proposal,
  proposals,
  currentUser,
  availabilities,
  userNameById,
  alternativeCount,
  commentCount,
  onAddComment,
}: ResolverWorkspaceProps) {
  const {
    getDecisionConfig,
    getOptionsForProposalDimension,
    getVotesForProposalDimension,
    addDecisionConfirmation,
    setDecisionConfig,
    updateProposal,
    addProposal,
  } = useProposals();
  const [majorityLockMessage, setMajorityLockMessage] = useState<string | null>(null);
  const [isLockingMajority, setIsLockingMajority] = useState(false);
  const [finalizeMessage, setFinalizeMessage] = useState<string | null>(null);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [variantMessage, setVariantMessage] = useState<string | null>(null);
  const [isCreatingVariants, setIsCreatingVariants] = useState(false);
  const canConfirm = proposal ? canConfirmDecision(currentUser, proposal) : false;

  const resolverSnapshots = useMemo(
    () => {
      if (!proposal) return [];
      return RESOLVER_DIMENSIONS.map((dimension) => {
        const config = getDecisionConfig(proposal.id, dimension);
        const mode = config?.mode ?? getDefaultMode(dimension);
        const options = getOptionsForProposalDimension(proposal.id, dimension);
        const votes = getVotesForProposalDimension(proposal.id, dimension);
        return {
          dimension,
          mode,
          status: config?.status ?? 'open',
          options,
          votes,
        };
      });
    },
    [
      getDecisionConfig,
      getOptionsForProposalDimension,
      getVotesForProposalDimension,
      proposal,
    ]
  );

  const majorityPreview = useMemo(
    () =>
      resolverSnapshots.map((entry) => ({
        ...entry,
        ...getConsensusAssessment(entry.options, entry.votes, entry.mode),
      })),
    [resolverSnapshots]
  );

  const actionablePreview = majorityPreview.filter((entry) => entry.winners.length > 0);
  const variantPlan = useMemo(
    () =>
      proposal
        ? buildResolverVariantPlan(proposal, resolverSnapshots, proposals)
        : { drafts: [], reason: null },
    [proposal, proposals, resolverSnapshots]
  );

  if (!proposal) {
    return (
      <div className="flex min-h-0 min-w-0 w-full items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
        Select a proposal to begin resolving it.
      </div>
    );
  }

  const applyResolverOutcome = async ({ finalize }: { finalize: boolean }) => {
    const nextSpecifics = { ...(proposal.specifics || {}) };
    let confirmedDimensions = 0;
    if (finalize) {
      setIsFinalizing(true);
      setFinalizeMessage(null);
    } else {
      setIsLockingMajority(true);
      setMajorityLockMessage(null);
    }

    try {
      const pendingUpdates: Array<{
        dimension: string;
        confirmation: any;
        config: any;
        applySpecifics: (spec: any) => void;
      }> = [];

      majorityPreview.forEach((entry) => {
        if (entry.winners.length === 0) return;

        pendingUpdates.push({
          dimension: entry.dimension,
          confirmation: {
            id: generateId(),
            proposalId: proposal.id,
            dimension: entry.dimension,
            optionIds: entry.winners.map((option) => option.id),
            confirmedBy: currentUser.id,
            confirmedAt: new Date().toISOString(),
            note: 'Locked in by majority from Resolver workspace.',
          },
          config: {
            proposalId: proposal.id,
            dimension: entry.dimension,
            mode: entry.mode,
            status: 'confirmed',
          },
          applySpecifics: (spec: any) => {
            if (entry.dimension === 'time') {
              spec.time = entry.winners.map((option) => option.label).join(', ');
              const first = entry.winners[0];
              const startDate = first?.metadata?.startDate;
              const endDate = first?.metadata?.endDate;
              if (startDate && endDate) {
                spec.date = startDate === endDate ? startDate : `${startDate} to ${endDate}`;
              }
            }
            if (entry.dimension === 'place') {
              spec.location = entry.winners.map((option) => option.label).join(', ');
            }
            if (entry.dimension === 'requirement') {
              spec.requirements = entry.winners.map((option) => option.label).join(', ');
            }
          },
        });
      });

      if (pendingUpdates.length === 0 && !finalize) {
        setMajorityLockMessage('No majority selection available yet.');
        return;
      }

      const failures: string[] = [];
      pendingUpdates.forEach((update) => {
        try {
          addDecisionConfirmation(update.confirmation);
          setDecisionConfig(update.config);
          update.applySpecifics(nextSpecifics);
          confirmedDimensions += 1;
        } catch (err) {
          console.error(`Error applying updates for dimension: ${update.dimension}`, err);
          failures.push(update.dimension);
        }
      });

      if (failures.length > 0 && confirmedDimensions === 0) {
        setMajorityLockMessage(`Failed to lock in selections. Errors in: ${failures.join(', ')}`);
        return;
      }

      const requiredDimensions = Object.keys(proposal.specifics || {}).filter(
        (key) => key !== 'resolver'
      );
      const allRequiredDecided = requiredDimensions.every((d) =>
        Boolean(nextSpecifics[d as keyof typeof nextSpecifics])
      );

      const nextComments = finalize
        ? [
          ...(proposal.comments || []),
          {
            id: generateId(),
            userId: currentUser.id,
            proposalId: proposal.id,
            text: buildFinalizationNotice({
              proposal: { ...proposal, specifics: nextSpecifics },
              currentUser,
              memberCount: userNameById.size,
            }),
            createdAt: new Date().toISOString(),
          },
        ]
        : proposal.comments;

      await updateProposal(proposal.id, {
        status: finalize || allRequiredDecided ? 'confirmed' : proposal.status,
        specifics: nextSpecifics,
        ...(nextComments ? { comments: nextComments } : {}),
      });

      if (finalize) {
        if (failures.length > 0) {
          setFinalizeMessage(
            `Finalized activity and posted notice, but some resolver dimensions did not save cleanly: ${failures.join(', ')}.`
          );
        } else {
          setFinalizeMessage('Finalized activity and posted a notice to the group notes.');
        }
        return;
      }

      if (failures.length > 0) {
        setMajorityLockMessage(
          `Partially locked in ${confirmedDimensions} dimension(s), but failed to lock in: ${failures.join(', ')}.`
        );
      } else {
        setMajorityLockMessage(
          `Locked in majority selections for ${confirmedDimensions} dimension${confirmedDimensions === 1 ? '' : 's'}.`
        );
      }
    } finally {
      if (finalize) {
        setIsFinalizing(false);
      } else {
        setIsLockingMajority(false);
      }
    }
  };

  const handleLockInMajority = async () => {
    if (!canConfirm || isLockingMajority) return;
    await applyResolverOutcome({ finalize: false });
  };

  const handleFinalizeActivity = async () => {
    if (!canConfirm || isFinalizing || proposal.status === 'confirmed') return;
    await applyResolverOutcome({ finalize: true });
  };

  const handleCreateVariants = () => {
    if (!proposal || !canConfirm || isCreatingVariants || variantPlan.drafts.length === 0) return;

    setIsCreatingVariants(true);
    setVariantMessage(null);

    try {
      variantPlan.drafts.forEach((draft) => {
        const proposalId = generateId();
        const forkedAt = new Date().toISOString();
        addProposal({
          id: proposalId,
          groupId: proposal.groupId,
          title: draft.title,
          type: proposal.type,
          emoji: proposal.emoji,
          createdBy: currentUser.id,
          authoredBy: proposal.authoredBy || proposal.createdBy,
          createdAt: forkedAt,
          status: 'proposed',
          specifics: {
            ...(draft.specifics || {}),
            resolver: {
              variantOfProposalId: proposal.id,
              variantLabel: draft.variantLabel,
              originalProposalTitle: proposal.title,
              originalProposalCreatedBy: proposal.createdBy,
              forkedAt,
              forkedBy: currentUser.id,
              chosenTimeLabel: draft.chosenTimeLabel,
              chosenPlaceLabel: draft.chosenPlaceLabel,
            },
          },
          comments: proposal.comments?.map((comment) => ({
            ...comment,
            id: generateId(),
            proposalId,
          })),
        });
      });

      setVariantMessage(
        `Created ${variantPlan.drafts.length} variant proposal${variantPlan.drafts.length === 1 ? '' : 's'}.`
      );
    } finally {
      setIsCreatingVariants(false);
    }
  };

  return (
    <div
      data-screen-scroll-root="true"
      className="hide-scrollbar h-full min-h-0 min-w-0 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="space-y-3">
        <ResolverSummaryCard
          proposal={proposal}
          creatorName={userNameById.get(proposal.authoredBy || proposal.createdBy) || 'Unknown'}
          alternativeCount={alternativeCount}
          commentCount={commentCount}
        />
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-emerald-900 dark:text-emerald-200">
                Resolver Actions
              </h3>
              <p className="text-sm text-emerald-800 dark:text-emerald-300">
                Lock the current majority picks or fork the strongest unresolved paths into capped proposal variants.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleFinalizeActivity()}
                disabled={!canConfirm || isFinalizing || proposal.status === 'confirmed'}
                className="rounded-md bg-amber-500 px-3 py-2 text-sm font-medium text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {proposal.status === 'confirmed'
                  ? 'Already Finalized'
                  : isFinalizing
                    ? 'Finalizing...'
                    : 'Finalize + Notify'}
              </button>
              <button
                type="button"
                onClick={handleCreateVariants}
                disabled={!canConfirm || isCreatingVariants || variantPlan.drafts.length === 0}
                className="rounded-md bg-white px-3 py-2 text-sm font-medium text-emerald-900 ring-1 ring-inset ring-emerald-300 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-900 dark:text-emerald-200 dark:ring-emerald-800 dark:hover:bg-emerald-950/40"
              >
                {isCreatingVariants ? 'Creating...' : 'Create Variants'}
              </button>
              <button
                type="button"
                onClick={() => void handleLockInMajority()}
                disabled={!canConfirm || isLockingMajority || actionablePreview.length === 0}
                className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLockingMajority ? 'Locking...' : 'Lock In Majority'}
              </button>
            </div>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            {majorityPreview.map((entry) => (
              <div
                key={`majority-preview-${entry.dimension}`}
                className="rounded-lg border border-emerald-200 bg-white p-3 text-sm dark:border-emerald-900/40 dark:bg-slate-900"
              >
                <div className="text-[11px] uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                  {entry.dimension}
                </div>
                <div className="mt-1 text-gray-900 dark:text-slate-100">
                  {entry.winners.length > 0
                    ? entry.winners.map((option) => option.label).join(', ')
                    : 'No majority pick yet'}
                </div>
                <div className="mt-1 text-xs text-gray-600 dark:text-slate-400">
                  {entry.label} • {entry.optionCount} options, {entry.voteCount} votes
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-lg border border-emerald-200 bg-white p-3 text-sm dark:border-emerald-900/40 dark:bg-slate-900">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                  Variant Preview
                </div>
                <div className="mt-1 text-gray-900 dark:text-slate-100">
                  {variantPlan.drafts.length > 0
                    ? `${variantPlan.drafts.length} variant paths ready`
                    : 'No variant fork available yet'}
                </div>
              </div>
              {variantPlan.reason && (
                <div className="text-xs text-gray-600 dark:text-slate-400">{variantPlan.reason}</div>
              )}
            </div>
            {variantPlan.drafts.length > 0 && (
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {variantPlan.drafts.map((draft) => (
                  <div
                    key={draft.title}
                    className="rounded-lg border border-gray-200 bg-stone-50 p-3 dark:border-slate-700 dark:bg-slate-950"
                  >
                    <div className="font-medium text-gray-900 dark:text-slate-100">{draft.title}</div>
                    <div className="mt-2 space-y-1 text-xs text-gray-600 dark:text-slate-400">
                      <div>Time: {draft.chosenTimeLabel || draft.specifics?.time || 'Keep current'}</div>
                      <div>Place: {draft.chosenPlaceLabel || draft.specifics?.location || 'Keep current'}</div>
                      <div>
                        Requirements: {draft.specifics?.requirements || 'None carried over'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {!canConfirm && (
            <p className="mt-3 text-xs text-emerald-800 dark:text-emerald-300">
              Only this proposal&apos;s creator or an admin can lock in majority selections or create variants.
            </p>
          )}
          {majorityLockMessage && (
            <p className="mt-3 text-xs text-emerald-800 dark:text-emerald-300">
              {majorityLockMessage}
            </p>
          )}
          {finalizeMessage && (
            <p className="mt-3 text-xs text-emerald-800 dark:text-emerald-300">
              {finalizeMessage}
            </p>
          )}
          {variantMessage && (
            <p className="mt-3 text-xs text-emerald-800 dark:text-emerald-300">{variantMessage}</p>
          )}
        </section>
        <ResolverAlternativesPanel proposalId={proposal.id} userNameById={userNameById} />
        <ResolverAvailabilityPanel
          proposal={proposal}
          availabilities={availabilities}
          userNameById={userNameById}
        />
        <ResolverDecisionPanel proposal={proposal} dimension="time" currentUser={currentUser} />
        <ResolverDecisionPanel proposal={proposal} dimension="place" currentUser={currentUser} />
        <ResolverDecisionPanel
          proposal={proposal}
          dimension="requirement"
          currentUser={currentUser}
        />
        <ResolverCommentsPanel
          proposal={proposal}
          currentUserId={currentUser.id}
          userNameById={userNameById}
          onAddComment={onAddComment}
        />
      </div>
    </div>
  );
}
