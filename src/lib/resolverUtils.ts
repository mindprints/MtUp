import { computeFirstChoiceCounts, computeRankedScores, getTopCandidates } from '@/lib/decisionUtils';
import { computeSejourOverlapWindows } from '@/lib/sejourUtils';
import type {
  Availability,
  DecisionDimension,
  DecisionOption,
  DecisionStatus,
  DecisionVote,
  Proposal,
  ProposalContribution,
  VotingMode,
} from '@/types';

export type ResolverConsensusTone = 'good' | 'info' | 'warm' | 'neutral';

export type ResolverConsensusAssessment = {
  winners: DecisionOption[];
  supportByOptionId: Map<string, number>;
  supportPercent: number;
  label: string;
  tone: ResolverConsensusTone;
  detail: string;
  voteCount: number;
  optionCount: number;
};

export type ResolverVariantDimensionSnapshot = {
  dimension: DecisionDimension;
  mode: VotingMode;
  status: DecisionStatus;
  options: DecisionOption[];
  votes: DecisionVote[];
};

export type ResolverVariantDraft = {
  title: string;
  specifics: Proposal['specifics'];
  variantLabel: string;
  chosenTimeLabel?: string;
  chosenPlaceLabel?: string;
};

export type ResolverVariantPlan = {
  drafts: ResolverVariantDraft[];
  reason: string | null;
};

export type ResolverSeedCandidate = {
  label: string;
  metadata?: Record<string, string>;
};

function parseDateRangeLabel(input: string): { startDate: string; endDate: string } | null {
  const normalized = normalizeResolverLabel(input);
  const rangeMatch = normalized.match(/^(\d{4}-\d{2}-\d{2})(?:\s+to\s+(\d{4}-\d{2}-\d{2}))?$/i);
  if (!rangeMatch) return null;
  return {
    startDate: rangeMatch[1],
    endDate: rangeMatch[2] || rangeMatch[1],
  };
}

function normalizeResolverLabel(input: string): string {
  return input.trim().replace(/\s+/g, ' ');
}

function splitRequirementValues(input: string): string[] {
  return input
    .split(/\r?\n|[;,]/)
    .map((part) => normalizeResolverLabel(part.replace(/^(?:requirements?|needs?|must)\s*:\s*/i, '')))
    .filter(Boolean);
}

function extractPrefixedValues(input: string, prefixes: string[]): string[] {
  const prefixPattern = prefixes.join('|');
  return input
    .split(/\r?\n|;/)
    .map((segment) => segment.trim())
    .flatMap((segment) => {
      const match = segment.match(new RegExp(`^(?:[-*•]\\s*)?(?:${prefixPattern})\\s*:\\s*(.+)$`, 'i'));
      if (!match) return [];
      return match[1]
        .split(/\s*\|\s*|\s+or\s+/i)
        .map((part) => normalizeResolverLabel(part))
        .filter(Boolean);
    });
}

function format12HourTo24Hour(hourText: string, minuteText: string | undefined, meridiem: string): string {
  const rawHour = Number(hourText);
  if (Number.isNaN(rawHour)) return '';
  const minute = minuteText ? Number(minuteText) : 0;
  if (Number.isNaN(minute) || minute < 0 || minute > 59) return '';
  const normalizedHour = meridiem.toLowerCase() === 'p' ? (rawHour % 12) + 12 : rawHour % 12;
  return `${String(normalizedHour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function extractTimeCandidatesFromText(input: string): string[] {
  const out = new Set<string>();
  extractPrefixedValues(input, ['time', 'when']).forEach((value) => {
    const normalized = normalizeResolverLabel(value);
    if (normalized) out.add(normalized);
  });

  const twentyFourHourMatches = input.matchAll(/\b([01]?\d|2[0-3]):([0-5]\d)\b/g);
  for (const match of twentyFourHourMatches) {
    out.add(`${String(Number(match[1])).padStart(2, '0')}:${match[2]}`);
  }

  const twelveHourMatches = input.matchAll(/\b(1[0-2]|0?\d)(?::([0-5]\d))?\s*([ap])(?:\.?m\.?)\b/gi);
  for (const match of twelveHourMatches) {
    const formatted = format12HourTo24Hour(match[1], match[2], match[3]);
    if (formatted) out.add(formatted);
  }

  return Array.from(out);
}

function extractPlaceCandidatesFromText(input: string): string[] {
  return extractPrefixedValues(input, ['place', 'location', 'where', 'venue']);
}

function findNearbyTimeLabel(
  contributionEntries: ProposalContribution[],
  startIndex: number,
  userId: string
): string | null {
  const origin = contributionEntries[startIndex];
  if (!origin) return null;
  const originTime = new Date(origin.createdAt).getTime();

  for (let index = startIndex + 1; index < contributionEntries.length; index += 1) {
    const candidate = contributionEntries[index];
    if (!candidate) continue;
    if (candidate.userId !== userId) break;
    const deltaMs = Math.abs(new Date(candidate.createdAt).getTime() - originTime);
    if (Number.isFinite(deltaMs) && deltaMs > 2 * 60 * 1000) break;
    if (candidate.field === 'time' && typeof candidate.value.text === 'string') {
      return normalizeResolverLabel(candidate.value.text);
    }
  }

  return null;
}

export function formatResolverOptionLabel(option: DecisionOption, dimension: DecisionDimension): string {
  if (dimension !== 'time') return option.label;

  const startDate = option.metadata?.startDate;
  const endDate = option.metadata?.endDate;
  if (!startDate && !endDate) return option.label;

  const normalizedLabel = normalizeResolverLabel(option.label);
  const rangeText = startDate && endDate && startDate !== endDate ? `${startDate} to ${endDate}` : startDate || endDate || '';
  if (!rangeText) return normalizedLabel;
  if (normalizedLabel === rangeText) return normalizedLabel;
  return `${rangeText} | ${normalizedLabel}`;
}

export function collectResolverSeedCandidates(
  proposal: Proposal,
  dimension: DecisionDimension,
  contributionEntries: ProposalContribution[]
): ResolverSeedCandidate[] {
  const seeds: ResolverSeedCandidate[] = [];
  const seen = new Set<string>();

  const pushSeed = (label: string, metadata?: Record<string, string>) => {
    const normalizedLabel = normalizeResolverLabel(label);
    if (!normalizedLabel) return;
    const key = metadata?.startDate || metadata?.endDate
      ? `${dimension}|${normalizedLabel}|${metadata?.startDate || ''}|${metadata?.endDate || ''}`
      : `${dimension}|${normalizedLabel}`;
    if (seen.has(key)) return;
    seen.add(key);
    seeds.push({ label: normalizedLabel, ...(metadata ? { metadata } : {}) });
  };

  if (dimension === 'time') {
    if (proposal.specifics?.date) {
      const dateText = normalizeResolverLabel(proposal.specifics.date);
      const rangeMatch = parseDateRangeLabel(dateText);
      const baselineLabel =
        proposal.type === 'event' && proposal.specifics?.time
          ? normalizeResolverLabel(proposal.specifics.time)
          : dateText;
      pushSeed(
        baselineLabel,
        rangeMatch
          ? {
              startDate: rangeMatch.startDate,
              endDate: rangeMatch.endDate,
              source: 'proposal-baseline',
            }
          : { source: 'proposal-baseline' }
      );
    }

    if (proposal.specifics?.time) {
      pushSeed(proposal.specifics.time, { source: 'proposal-baseline' });
    }

    contributionEntries.forEach((entry, index) => {
      if (entry.field === 'time' && typeof entry.value.text === 'string') {
        pushSeed(entry.value.text, { source: 'proposal-thread' });
      }
      if (
        entry.field === 'date' &&
        (typeof entry.value.dateText === 'string' || typeof entry.value.text === 'string')
      ) {
        const dateText =
          typeof entry.value.dateText === 'string' ? entry.value.dateText : String(entry.value.text);
        const normalized = normalizeResolverLabel(dateText);
        const rangeMatch = parseDateRangeLabel(normalized);
        const dateAwareLabel =
          proposal.type === 'event'
            ? findNearbyTimeLabel(contributionEntries, index, entry.userId) ||
              normalizeResolverLabel(proposal.specifics?.time || '') ||
              normalized
            : normalized;
        pushSeed(
          dateAwareLabel,
          rangeMatch
            ? {
                startDate: rangeMatch.startDate,
                endDate: rangeMatch.endDate,
                source: 'proposal-thread',
              }
            : { source: 'proposal-thread' }
        );
      }
    });

    (proposal.comments || []).forEach((comment) => {
      extractTimeCandidatesFromText(comment.text).forEach((label) =>
        pushSeed(label, { source: 'proposal-comments' })
      );
    });
  }

  if (dimension === 'place') {
    if (proposal.specifics?.location) {
      pushSeed(proposal.specifics.location, { source: 'proposal-baseline' });
    }

    contributionEntries.forEach((entry) => {
      if (entry.field === 'place' && typeof entry.value.text === 'string') {
        pushSeed(entry.value.text, { source: 'proposal-thread' });
      }
    });

    (proposal.comments || []).forEach((comment) => {
      extractPlaceCandidatesFromText(comment.text).forEach((label) =>
        pushSeed(label, { source: 'proposal-comments' })
      );
    });
  }

  if (dimension === 'requirement') {
    splitRequirementValues(proposal.specifics?.requirements || '').forEach((label) =>
      pushSeed(label, { source: 'proposal-baseline' })
    );

    (proposal.comments || []).forEach((comment) => {
      if (!/requirement|require|need|must/i.test(comment.text)) return;
      splitRequirementValues(comment.text).forEach((label) =>
        pushSeed(label, { source: 'proposal-comments' })
      );
    });

    contributionEntries.forEach((entry) => {
      if (entry.field === 'requirements' && typeof entry.value.text === 'string') {
        splitRequirementValues(entry.value.text).forEach((label) =>
          pushSeed(label, { source: 'proposal-thread' })
        );
      }
    });
  }

  return seeds;
}

function getVariantSignature(input: {
  parentProposalId: string;
  timeLabel?: string;
  placeLabel?: string;
}) {
  return [
    input.parentProposalId,
    input.timeLabel?.trim().toLowerCase() || '',
    input.placeLabel?.trim().toLowerCase() || '',
  ].join('|');
}

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

export function getMajoritySelection(
  options: DecisionOption[],
  votes: DecisionVote[],
  mode: VotingMode
): DecisionOption[] {
  if (options.length === 0) return [];

  if (mode === 'multi') {
    const supportCounts = new Map<string, number>();
    options.forEach((option) => supportCounts.set(option.id, 0));

    votes.forEach((vote) => {
      (vote.selectedOptionIds || []).forEach((optionId) => {
        if (!supportCounts.has(optionId)) return;
        supportCounts.set(optionId, (supportCounts.get(optionId) || 0) + 1);
      });
    });

    const majorityThreshold = votes.length > 0 ? Math.ceil(votes.length / 2) : 1;
    const majorityWinners = options.filter(
      (option) => (supportCounts.get(option.id) || 0) >= majorityThreshold
    );

    if (majorityWinners.length > 0) {
      return majorityWinners.sort(
        (a, b) => (supportCounts.get(b.id) || 0) - (supportCounts.get(a.id) || 0)
      );
    }

    const topSupport = Math.max(...options.map((option) => supportCounts.get(option.id) || 0));
    if (topSupport <= 0) return [];
    return options.filter((option) => (supportCounts.get(option.id) || 0) === topSupport);
  }

  const { topCandidates } = getDecisionSummary(options, votes, 1);
  return topCandidates[0] ? [topCandidates[0].option] : options[0] ? [options[0]] : [];
}

export function getSupportCounts(
  options: DecisionOption[],
  votes: DecisionVote[],
  mode: VotingMode
): Map<string, number> {
  const counts = new Map<string, number>();
  options.forEach((option) => counts.set(option.id, 0));

  if (mode === 'multi') {
    votes.forEach((vote) => {
      (vote.selectedOptionIds || []).forEach((optionId) => {
        if (!counts.has(optionId)) return;
        counts.set(optionId, (counts.get(optionId) || 0) + 1);
      });
    });
    return counts;
  }

  votes.forEach((vote) => {
    const optionId = vote.rankedOptionIds?.[0];
    if (!optionId || !counts.has(optionId)) return;
    counts.set(optionId, (counts.get(optionId) || 0) + 1);
  });
  return counts;
}

export function getConsensusAssessment(
  options: DecisionOption[],
  votes: DecisionVote[],
  mode: VotingMode
): ResolverConsensusAssessment {
  const winners = getMajoritySelection(options, votes, mode);
  const supportByOptionId = getSupportCounts(options, votes, mode);
  const leaderIds = winners.map((option) => option.id);
  const leaderSupport = leaderIds.length > 0
    ? Math.max(...leaderIds.map((id) => supportByOptionId.get(id) || 0))
    : 0;
  const supportPercent = votes.length > 0 ? Math.round((leaderSupport / votes.length) * 100) : 0;

  if (votes.length === 0 || leaderIds.length === 0) {
    return {
      winners,
      supportByOptionId,
      supportPercent: 0,
      label: 'No signal yet',
      tone: 'neutral',
      detail: 'Waiting for votes to establish a leading option.',
      voteCount: votes.length,
      optionCount: options.length,
    };
  }

  if (leaderIds.length > 1) {
    return {
      winners,
      supportByOptionId,
      supportPercent,
      label: 'Split decision',
      tone: 'warm',
      detail: `${leaderIds.length} options are tied at ${supportPercent}%.`,
      voteCount: votes.length,
      optionCount: options.length,
    };
  }

  if (supportPercent >= 75) {
    return {
      winners,
      supportByOptionId,
      supportPercent,
      label: 'Strong consensus',
      tone: 'good',
      detail: `${winners[0].label} leads with ${supportPercent}% support.`,
      voteCount: votes.length,
      optionCount: options.length,
    };
  }

  if (supportPercent >= 60) {
    return {
      winners,
      supportByOptionId,
      supportPercent,
      label: 'Emerging majority',
      tone: 'info',
      detail: `${winners[0].label} leads with ${supportPercent}% support.`,
      voteCount: votes.length,
      optionCount: options.length,
    };
  }

  return {
    winners,
    supportByOptionId,
    supportPercent,
    label: 'Close call',
    tone: 'warm',
    detail: `${winners[0].label} leads with ${supportPercent}% support.`,
    voteCount: votes.length,
    optionCount: options.length,
  };
}

function getVariantCandidatesForDimension(
  snapshot: ResolverVariantDimensionSnapshot | undefined,
  limit = 2
): DecisionOption[] {
  if (!snapshot || snapshot.status === 'confirmed' || snapshot.options.length < 2) {
    return [];
  }

  if (snapshot.mode === 'multi') {
    const supportCounts = getSupportCounts(snapshot.options, snapshot.votes, snapshot.mode);
    return snapshot.options
      .map((option) => ({
        option,
        support: supportCounts.get(option.id) || 0,
      }))
      .sort((a, b) => {
        if (b.support !== a.support) return b.support - a.support;
        return a.option.label.localeCompare(b.option.label);
      })
      .slice(0, limit)
      .map((entry) => entry.option);
  }

  if (snapshot.votes.length === 0) {
    return snapshot.options.slice(0, limit);
  }

  return getDecisionSummary(snapshot.options, snapshot.votes, limit).topCandidates.map(
    (candidate) => candidate.option
  );
}

function buildVariantSpecifics(
  proposal: Proposal,
  timeOption?: DecisionOption,
  placeOption?: DecisionOption,
  requirementText?: string
): Proposal['specifics'] {
  const specifics: Proposal['specifics'] = {
    ...(proposal.specifics || {}),
  };

  if (timeOption) {
    specifics.time = timeOption.label;

    const startDate = timeOption.metadata?.startDate;
    const endDate = timeOption.metadata?.endDate;
    if (startDate && endDate) {
      specifics.date = startDate === endDate ? startDate : `${startDate} to ${endDate}`;
    }
  }

  if (placeOption) {
    specifics.location = placeOption.label;
  }

  if (requirementText) {
    specifics.requirements = requirementText;
  }

  return specifics;
}

export function buildResolverVariantPlan(
  proposal: Proposal,
  snapshots: ResolverVariantDimensionSnapshot[],
  existingProposals: Proposal[] = [],
  limit = 2
): ResolverVariantPlan {
  const timeSnapshot = snapshots.find((entry) => entry.dimension === 'time');
  const placeSnapshot = snapshots.find((entry) => entry.dimension === 'place');
  const requirementSnapshot = snapshots.find((entry) => entry.dimension === 'requirement');

  const timeCandidates = getVariantCandidatesForDimension(timeSnapshot, 2);
  const placeCandidates = getVariantCandidatesForDimension(placeSnapshot, 2);
  const requirementText =
    proposal.specifics?.requirements ||
    getMajoritySelection(
      requirementSnapshot?.options || [],
      requirementSnapshot?.votes || [],
      requirementSnapshot?.mode || 'multi'
    )
      .map((option) => option.label)
      .join(', ');

  if (timeCandidates.length === 0 && placeCandidates.length === 0) {
    return {
      drafts: [],
      reason: 'Need at least one unresolved dimension with two viable options.',
    };
  }

  const baseTitle = proposal.title.replace(/\s+\(Variant [A-Z]\)$/i, '').trim();
  const comboInputs =
    timeCandidates.length > 0 && placeCandidates.length > 0
      ? timeCandidates.flatMap((timeOption) =>
          placeCandidates.map((placeOption) => ({ timeOption, placeOption }))
        )
      : timeCandidates.length > 0
        ? timeCandidates.map((timeOption) => ({ timeOption, placeOption: undefined }))
        : placeCandidates.map((placeOption) => ({ timeOption: undefined, placeOption }));

  const drafts = comboInputs.slice(0, limit).map((combo, index) => {
    const variantLabel = `Variant ${String.fromCharCode(65 + index)}`;
    return {
      title: `${baseTitle} (${variantLabel})`,
      variantLabel,
      specifics: buildVariantSpecifics(
        proposal,
        combo.timeOption,
        combo.placeOption,
        requirementText || undefined
      ),
      chosenTimeLabel: combo.timeOption?.label,
      chosenPlaceLabel: combo.placeOption?.label,
    };
  });

  const existingVariantSignatures = new Set(
    existingProposals
      .filter((entry) => entry.specifics?.resolver?.variantOfProposalId === proposal.id)
      .map((entry) =>
        getVariantSignature({
          parentProposalId: proposal.id,
          timeLabel: entry.specifics?.resolver?.chosenTimeLabel || entry.specifics?.time,
          placeLabel: entry.specifics?.resolver?.chosenPlaceLabel || entry.specifics?.location,
        })
      )
  );

  const uniqueDrafts = drafts.filter(
    (draft) =>
      !existingVariantSignatures.has(
        getVariantSignature({
          parentProposalId: proposal.id,
          timeLabel: draft.chosenTimeLabel || draft.specifics?.time,
          placeLabel: draft.chosenPlaceLabel || draft.specifics?.location,
        })
      )
  );

  if (uniqueDrafts.length < 2) {
    return {
      drafts: [],
      reason:
        drafts.length >= 2
          ? 'Matching variants already exist for the strongest current paths.'
          : 'Need at least two distinct variant paths before forking proposals.',
    };
  }

  return {
    drafts: uniqueDrafts,
    reason: null,
  };
}
