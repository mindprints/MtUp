import { computeFirstChoiceCounts, computeRankedScores, getTopCandidates } from '@/lib/decisionUtils';
import { computeSejourOverlapWindows } from '@/lib/sejourUtils';
import type { Availability, DecisionOption, DecisionVote, Proposal } from '@/types';

export function getAvailabilitySummaryForEvent(
  proposal: Proposal,
  availabilities: Availability[]
): {
  participantUserIds: string[];
  dateCount: number;
  baselineDate: string | null;
} {
  const proposalAvailabilities = availabilities.filter(
    (availability) => availability.proposalId === proposal.id
  );
  const participantUserIds = Array.from(
    new Set(proposalAvailabilities.map((availability) => availability.userId))
  ).sort();
  const dateCount = Array.from(
    new Set(proposalAvailabilities.flatMap((availability) => availability.dates))
  ).length;

  return {
    participantUserIds,
    dateCount,
    baselineDate: proposal.specifics?.date || null,
  };
}

export function getAvailabilitySummaryForSejour(
  proposal: Proposal,
  availabilities: Availability[]
) {
  return computeSejourOverlapWindows(availabilities, proposal.id, {
    minNights: 2,
    minParticipants: 2,
    maxWindows: 8,
  });
}

export function getDecisionSummary(
  options: DecisionOption[],
  votes: DecisionVote[],
  limit = 3
) {
  const firstChoiceCounts = computeFirstChoiceCounts(options, votes);
  const rankedScores = computeRankedScores(options, votes);
  const topCandidates = getTopCandidates(options, rankedScores, firstChoiceCounts, limit);

  return {
    firstChoiceCounts,
    rankedScores,
    topCandidates,
  };
}
