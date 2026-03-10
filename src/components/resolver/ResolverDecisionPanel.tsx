import { useEffect, useMemo, useState } from 'react';
import { DecisionOptionList } from '@/components/DecisionOptionList';
import { useProposals } from '@/lib/ProposalContext';
import { canConfirmDecision } from '@/lib/permissions';
import {
  collectResolverSeedCandidates,
  formatResolverOptionLabel,
  getConsensusAssessment,
  getDecisionSummary,
} from '@/lib/resolverUtils';
import { computeSejourOverlapWindows } from '@/lib/sejourUtils';
import { storage } from '@/lib/storage';
import { proposalThreadStore } from '@/lib/proposalThreadStore';
import { generateId } from '@/lib/utils';
import type {
  DecisionDimension,
  DecisionOption,
  DecisionVote,
  Proposal,
  User,
  VotingMode,
} from '@/types';

type ResolverDecisionPanelProps = {
  proposal: Proposal;
  dimension: DecisionDimension;
  currentUser: User;
};

function getDefaultMode(dimension: DecisionDimension): VotingMode {
  if (dimension === 'requirement') return 'multi';
  return 'single';
}

const DIMENSION_LABELS: Record<DecisionDimension, string> = {
  time: 'Time',
  place: 'Place',
  requirement: 'Requirements',
};

function sameOptionIdList(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

export function ResolverDecisionPanel({
  proposal,
  dimension,
  currentUser,
}: ResolverDecisionPanelProps) {
  const {
    availabilities,
    getDecisionConfig,
    setDecisionConfig,
    getOptionsForProposalDimension,
    getVotesForProposalDimension,
    getDecisionConfirmations,
    addDecisionOption,
    deleteDecisionOption,
    setDecisionVote,
    addDecisionConfirmation,
    updateProposal,
  } = useProposals();

  const [newOptionLabel, setNewOptionLabel] = useState('');
  const [confirmationOptionIds, setConfirmationOptionIds] = useState<string[]>([]);
  const [confirmationNote, setConfirmationNote] = useState('');
  const [sejourMessage, setSejourMessage] = useState<string | null>(null);

  const config = getDecisionConfig(proposal.id, dimension);
  const mode = config?.mode ?? getDefaultMode(dimension);
  const canConfirm = canConfirmDecision(currentUser, proposal);
  const usersById = new Map(storage.getData().users.map((user) => [user.id, user]));
  const options = getOptionsForProposalDimension(proposal.id, dimension);
  const votes = getVotesForProposalDimension(proposal.id, dimension);
  const confirmations = getDecisionConfirmations(proposal.id, dimension)
    .slice()
    .sort((a, b) => new Date(b.confirmedAt).getTime() - new Date(a.confirmedAt).getTime());
  const latestConfirmation = confirmations[0] || null;
  const contributionEntries = useMemo(
    () =>
      proposalThreadStore
        .listForProposal(proposal.id)
        .filter((entry) => entry.kind === 'field_change'),
    [proposal.id]
  );

  const currentUserVote = useMemo(
    () => votes.find((vote) => vote.userId === currentUser.id) || null,
    [votes, currentUser.id]
  );
  const { topCandidates } = useMemo(() => getDecisionSummary(options, votes), [options, votes]);
  const consensusState = useMemo(
    () => getConsensusAssessment(options, votes, mode),
    [mode, options, votes]
  );

  useEffect(() => {
    const existing = getDecisionConfig(proposal.id, dimension);
    if (!existing) {
      setDecisionConfig({
        proposalId: proposal.id,
        dimension,
        mode: getDefaultMode(dimension),
        status: 'open',
      });
    }
  }, [dimension, getDecisionConfig, proposal.id, setDecisionConfig]);

  useEffect(() => {
    const existingKeys = new Set(
      options.map((option) => {
        const startDate = option.metadata?.startDate;
        const endDate = option.metadata?.endDate;
        return startDate || endDate
          ? `${dimension}|${option.label.trim().toLowerCase()}|${startDate || ''}|${endDate || ''}`
          : `${dimension}|${option.label.trim().toLowerCase()}`;
      })
    );

    const seeds = collectResolverSeedCandidates(proposal, dimension, contributionEntries)
      .filter((seed) => {
        const key = seed.metadata?.startDate || seed.metadata?.endDate
          ? `${dimension}|${seed.label.trim().toLowerCase()}|${seed.metadata?.startDate || ''}|${seed.metadata?.endDate || ''}`
          : `${dimension}|${seed.label.trim().toLowerCase()}`;
        if (existingKeys.has(key)) return false;
        existingKeys.add(key);
        return true;
      })
      .map((seed) => ({
        id: generateId(),
        proposalId: proposal.id,
        dimension,
        label: seed.label,
        createdBy: proposal.createdBy,
        createdAt: proposal.createdAt,
        ...(seed.metadata ? { metadata: seed.metadata } : {}),
      }));

    if (seeds.length > 0) {
      seeds.forEach((seed) => addDecisionOption(seed));
    }
  }, [
    addDecisionOption,
    contributionEntries,
    dimension,
    options,
    proposal.comments,
    proposal.createdAt,
    proposal.createdBy,
    proposal.id,
    proposal.specifics,
    proposal.type,
  ]);

  useEffect(() => {
    const seen = new Set<string>();
    const duplicateIds = options
      .filter((option) => {
        const startDate = option.metadata?.startDate;
        const endDate = option.metadata?.endDate;
        const key = startDate || endDate
          ? `${dimension}|${option.label.trim().toLowerCase()}|${startDate || ''}|${endDate || ''}`
          : `${dimension}|${option.label.trim().toLowerCase()}`;
        if (seen.has(key)) return true;
        seen.add(key);
        return false;
      })
      .map((option) => option.id);

    if (duplicateIds.length === 0) return;
    duplicateIds.forEach((optionId) => deleteDecisionOption(optionId));
  }, [deleteDecisionOption, dimension, options]);

  useEffect(() => {
    let nextOptionIds: string[] = [];

    if (mode === 'multi') {
      nextOptionIds = currentUserVote?.selectedOptionIds || [];
    } else {
      const ranked = currentUserVote?.rankedOptionIds || [];
      if (ranked.length > 0) {
        nextOptionIds = [ranked[0]];
      } else {
        nextOptionIds = options[0] ? [options[0].id] : [];
      }
    }

    setConfirmationOptionIds((previous) =>
      sameOptionIdList(previous, nextOptionIds) ? previous : nextOptionIds
    );
  }, [currentUserVote, mode, options]);

  const handleModeChange = (nextMode: VotingMode) => {
    setDecisionConfig({
      proposalId: proposal.id,
      dimension,
      mode: nextMode,
      status: config?.status ?? 'open',
    });
  };

  const handleAddOption = () => {
    const label = newOptionLabel.trim();
    if (!label) return;

    const newOption: DecisionOption = {
      id: generateId(),
      proposalId: proposal.id,
      dimension,
      label,
      createdBy: currentUser.id,
      createdAt: new Date().toISOString(),
    };
    addDecisionOption(newOption);
    setNewOptionLabel('');
  };

  const updateVote = (nextVote: Partial<DecisionVote>) => {
    setDecisionVote({
      id: currentUserVote?.id || generateId(),
      proposalId: proposal.id,
      dimension,
      userId: currentUser.id,
      rankedOptionIds: nextVote.rankedOptionIds,
      selectedOptionIds: nextVote.selectedOptionIds,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleSingleVote = (optionId: string) => {
    updateVote({ rankedOptionIds: [optionId], selectedOptionIds: undefined });
  };

  const handleMultiVoteToggle = (optionId: string) => {
    const existing = currentUserVote?.selectedOptionIds || [];
    const next = existing.includes(optionId)
      ? existing.filter((id) => id !== optionId)
      : [...existing, optionId];
    updateVote({ selectedOptionIds: next, rankedOptionIds: undefined });
  };

  const handleRankedMove = (optionId: string, direction: 'up' | 'down') => {
    const currentRanking = currentUserVote?.rankedOptionIds || [];
    const fullRanking = [
      ...currentRanking,
      ...options.map((option) => option.id).filter((id) => !currentRanking.includes(id)),
    ];

    const index = fullRanking.indexOf(optionId);
    if (index === -1) return;
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= fullRanking.length) return;

    const nextRanking = [...fullRanking];
    const temp = nextRanking[index];
    nextRanking[index] = nextRanking[swapIndex];
    nextRanking[swapIndex] = temp;
    updateVote({ rankedOptionIds: nextRanking, selectedOptionIds: undefined });
  };

  const toggleConfirmationOption = (optionId: string) => {
    if (mode !== 'multi') {
      setConfirmationOptionIds([optionId]);
      return;
    }
    setConfirmationOptionIds((previous) =>
      previous.includes(optionId)
        ? previous.filter((id) => id !== optionId)
        : [...previous, optionId]
    );
  };

  const handleConfirmSelection = async () => {
    if (confirmationOptionIds.length === 0) return;

    addDecisionConfirmation({
      id: generateId(),
      proposalId: proposal.id,
      dimension,
      optionIds: confirmationOptionIds,
      confirmedBy: currentUser.id,
      confirmedAt: new Date().toISOString(),
      note: confirmationNote.trim() || undefined,
    });

    setDecisionConfig({
      proposalId: proposal.id,
      dimension,
      mode,
      status: 'confirmed',
    });

    const selectedOptions = options.filter((option) => confirmationOptionIds.includes(option.id));
    const nextSpecifics = { ...(proposal.specifics || {}) };

    if (dimension === 'time' && selectedOptions.length > 0) {
      nextSpecifics.time = selectedOptions.map((option) => option.label).join(', ');
      const first = selectedOptions[0];
      const startDate = first.metadata?.startDate;
      const endDate = first.metadata?.endDate;
      if (startDate && endDate) {
        nextSpecifics.date = startDate === endDate ? startDate : `${startDate} to ${endDate}`;
      }
    }

    if (dimension === 'place' && selectedOptions.length > 0) {
      nextSpecifics.location = selectedOptions.map((option) => option.label).join(', ');
    }

    if (dimension === 'requirement' && selectedOptions.length > 0) {
      nextSpecifics.requirements = selectedOptions.map((option) => option.label).join(', ');
    }

    const p = proposal as any;
    const requiredDimensions: string[] =
      p.requiredDimensions ||
      p.dimensions ||
      Object.keys(p.proposalSpecificRequirements || proposal.specifics || {});

    const allRequiredDecided = requiredDimensions.every((d) => Boolean((nextSpecifics as any)[d]));

    await updateProposal(proposal.id, {
      status: allRequiredDecided ? 'confirmed' : proposal.status || 'pending',
      specifics: nextSpecifics,
    });
    setConfirmationNote('');
  };

  const handleGenerateSejourWindows = () => {
    const windows = computeSejourOverlapWindows(availabilities, proposal.id, {
      minNights: 2,
      minParticipants: 2,
      maxWindows: 8,
    });

    if (windows.length === 0) {
      setSejourMessage('No overlap windows found yet. Add more date availability first.');
      return;
    }

    const existingWindowKeys = new Set(
      options
        .map((option) => option.metadata?.windowKey)
        .filter((key): key is string => Boolean(key))
    );

    let createdCount = 0;
    windows.forEach((window) => {
      const windowKey = `${window.startDate}|${window.endDate}|${window.participantUserIds.join(',')}`;
      if (existingWindowKeys.has(windowKey)) return;

      addDecisionOption({
        id: generateId(),
        proposalId: proposal.id,
        dimension: 'time',
        label: window.label,
        createdBy: currentUser.id,
        createdAt: new Date().toISOString(),
        metadata: {
          windowKey,
          startDate: window.startDate,
          endDate: window.endDate,
          nights: String(window.nights),
          participantCount: String(window.participantCount),
          participantUserIds: window.participantUserIds.join(','),
          source: 'sejour-overlap',
        },
      });
      createdCount += 1;
    });

    setSejourMessage(
      createdCount === 0
        ? 'Overlap windows are already generated.'
        : `Generated ${createdCount} overlap window option${createdCount === 1 ? '' : 's'}.`
    );
  };

  return (
    <section className="rounded-xl border border-gray-200 bg-stone-50 p-4 dark:border-slate-700 dark:bg-slate-950">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100">
          {DIMENSION_LABELS[dimension]}
        </h3>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] ${(config?.status ?? 'open') === 'confirmed'
            ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
            : 'bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-slate-300'
            }`}
        >
          {(config?.status ?? 'open').replace('_', ' ')}
        </span>
      </div>

      <div className="space-y-3">
        <div
          className={`rounded-md border p-3 ${
            consensusState.tone === 'good'
              ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20'
              : consensusState.tone === 'info'
                ? 'border-sky-200 bg-sky-50 dark:border-sky-900/40 dark:bg-sky-950/20'
                : consensusState.tone === 'warm'
                  ? 'border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20'
                  : 'border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-900'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                {consensusState.label}
              </p>
              <p className="mt-1 text-xs text-gray-600 dark:text-slate-300">
                {consensusState.detail}
              </p>
            </div>
            <div className="min-w-[7rem]">
              <div className="text-right text-[11px] font-medium text-gray-600 dark:text-slate-300">
                {votes.length} vote{votes.length === 1 ? '' : 's'}
              </div>
              <div className="mt-1 h-2 rounded-full bg-gray-200 dark:bg-slate-700">
                <div
                  className={`h-2 rounded-full ${
                    consensusState.tone === 'good'
                      ? 'bg-emerald-500'
                      : consensusState.tone === 'info'
                        ? 'bg-sky-500'
                        : consensusState.tone === 'warm'
                          ? 'bg-amber-500'
                          : 'bg-gray-400'
                  }`}
                  style={{ width: `${consensusState.supportPercent}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-700 dark:text-slate-200">Voting mode:</label>
          <select
            value={mode}
            onChange={(e) => handleModeChange(e.target.value as VotingMode)}
            className="rounded-md border border-gray-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          >
            <option value="single">Single choice</option>
            <option value="multi">Multi choice</option>
            <option value="ranked">Ranked choice</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newOptionLabel}
            onChange={(e) => setNewOptionLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddOption();
              }
            }}
            placeholder={`Add ${dimension} option`}
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
          <button
            type="button"
            onClick={handleAddOption}
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Add
          </button>
        </div>
        <p className="text-xs text-gray-500 dark:text-slate-400">
          Tip: notes like `time: 19:00`, `place: Hornstull`, or `requirements: quiet table`
          are auto-imported into resolver options.
        </p>

        {proposal.type === 'sejour' && dimension === 'time' && (
          <div className="rounded-md border border-indigo-200 bg-indigo-50 p-3 dark:border-indigo-900 dark:bg-indigo-950/30">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-indigo-900 dark:text-indigo-200">
                Generate candidate date windows from overlapping availability.
              </p>
              <button
                type="button"
                onClick={handleGenerateSejourWindows}
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Generate Overlap Windows
              </button>
            </div>
            {sejourMessage && (
              <p className="mt-2 text-xs text-indigo-700 dark:text-indigo-300">{sejourMessage}</p>
            )}
          </div>
        )}

        <DecisionOptionList
          mode={mode}
          options={options}
          votes={votes}
          currentUserVote={currentUserVote}
          currentUserId={currentUser.id}
          currentUserIsAdmin={currentUser.isAdmin}
          onSingleVote={handleSingleVote}
          onMultiVoteToggle={handleMultiVoteToggle}
          onRankedMove={handleRankedMove}
          onDeleteOption={deleteDecisionOption}
          highlightedOptionIds={consensusState.winners.map((option) => option.id)}
        />

        {mode !== 'multi' && options.length > 0 && (
          <div className="rounded-md border border-gray-200 p-3 dark:border-slate-700">
            <p className="mb-2 text-sm font-semibold text-gray-900 dark:text-slate-100">
              Top Candidates
            </p>
            <div className="space-y-1">
              {topCandidates.map((candidate) => (
                <div
                  key={candidate.option.id}
                  className="flex items-center justify-between text-xs text-gray-700 dark:text-slate-300"
                >
                  <span>{formatResolverOptionLabel(candidate.option, dimension)}</span>
                  <span>
                    Score: {candidate.score} | First-choice: {candidate.firstChoiceCount}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-md border border-gray-200 p-3 dark:border-slate-700">
          <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">Confirmation</p>

          {options.length > 0 && (
            <div className="mt-2 space-y-1">
              {options.map((option) => (
                <label
                  key={option.id}
                  className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-200"
                >
                  <input
                    type={mode === 'multi' ? 'checkbox' : 'radio'}
                    name={`confirm-${dimension}`}
                    checked={confirmationOptionIds.includes(option.id)}
                    onChange={() => toggleConfirmationOption(option.id)}
                    className="h-4 w-4"
                  />
                  <span>{formatResolverOptionLabel(option, dimension)}</span>
                </label>
              ))}
            </div>
          )}

          {canConfirm ? (
            <div className="mt-3 space-y-2">
              <input
                type="text"
                value={confirmationNote}
                onChange={(e) => setConfirmationNote(e.target.value)}
                placeholder="Optional confirmation note"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={handleConfirmSelection}
                disabled={confirmationOptionIds.length === 0}
                className="rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Confirm Selection
              </button>
            </div>
          ) : (
            <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">
              Only this proposal's creator or an admin can confirm selections.
            </p>
          )}

          {latestConfirmation && (
            <div className="mt-3 text-xs text-gray-600 dark:text-slate-300">
              <p>
                Latest confirmation by{' '}
                <strong>
                  {latestConfirmation.confirmedBy === currentUser.id
                    ? 'Me'
                    : usersById.get(latestConfirmation.confirmedBy)?.name ||
                    latestConfirmation.confirmedBy}
                </strong>{' '}
                on {new Date(latestConfirmation.confirmedAt).toLocaleString()}.
              </p>
              {latestConfirmation.note && (
                <p className="mt-1 text-gray-500 dark:text-slate-400">
                  Note: {latestConfirmation.note}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
