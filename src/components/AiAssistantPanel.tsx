import { FormEvent, useEffect, useState } from 'react';
import { sendAiMessage } from '@/lib/aiClient';
import { memoryStore } from '@/lib/memoryStore';
import { buildStockholmSeedMemoryRecords } from '@/lib/memorySeeds';
import { proposalThreadStore } from '@/lib/proposalThreadStore';
import { proposalThumbnailStore } from '@/lib/proposalThumbnailStore';
import {
  canGenerateProposalThumbnail,
  generateProposalThumbnail,
} from '@/lib/thumbnailGenerator';
import { useProposals } from '@/lib/ProposalContext';
import { generateId } from '@/lib/utils';
import type {
  AiActionProposal,
  AiMessage,
  AiProposalDraft,
  Availability,
  MemoryRecord,
  Proposal,
} from '@/types';
import { AiProposalFormCard, type AiProposalFormValues } from '@/components/AiProposalFormCard';
import { MemoryExplorer } from '@/components/ai-assistant/MemoryExplorer';
import { CalendarModal, type CalendarPopupState } from '@/components/ai-assistant/CalendarModal';
import { ProposalCard } from '@/components/ai-assistant/ProposalCard';
import {
  ProposalCardDrafts,
  SejourDateTimeRow,
  formatSejourTimeText,
  getProposalEndTime,
  getProposalStartTime,
  parseIsoDatesFromText,
  parseDateRangeFromText,
  parseSejourTimeText,
  formatDateRangeText,
  formatTo24HourTimeText,
  normalizeTimeInputValue,
  QuarterHourTimeSelect,
} from '@/components/ai-assistant/shared';

type AiAssistantPanelProps = {
  userId: string;
  activeGroupId: string | null;
  compact?: boolean;
  showInlineChatbox?: boolean;
  proposalFlow?: boolean;
  onProposalFlowGoActivities?: () => void;
};

const EXPECTED_GROUP_MEMBER_NAMES = ['Alice', 'Bob', 'Charlie', 'Denise', 'Eve'] as const;

type ProposalFlowAlternativeDraft = {
  startDate: string;
  endDate: string;
  time: string;
  startTime: string;
  endTime: string;
  place: string;
};

type PendingAlternativeSuggestion = {
  id: string;
  dateText: string;
  timeText: string;
  placeText: string;
};

const EMPTY_PROPOSAL_FLOW_ALTERNATIVE_DRAFT: ProposalFlowAlternativeDraft = {
  startDate: '',
  endDate: '',
  time: '',
  startTime: '',
  endTime: '',
  place: '',
};

function getActionProposalDrafts(proposal: AiActionProposal): AiProposalDraft[] {
  const drafts = proposal.payload?.proposalDrafts;
  if (Array.isArray(drafts) && drafts.length > 0) {
    return drafts;
  }
  const draft = proposal.payload?.proposalDraft;
  return draft ? [draft] : [];
}

function getScopedDraftKey(messageId: string, draftId: string): string {
  return `${messageId}:${draftId}`;
}

function getScopedActionProposal(
  proposal: AiActionProposal,
  draft: AiProposalDraft,
  draftCount: number
): AiActionProposal {
  return {
    ...proposal,
    summary: draftCount > 1 ? `Propose ${draft.title}` : proposal.summary,
    payload:
      proposal.payload?.kind === 'create_proposal'
        ? {
          ...proposal.payload,
          proposalDraft: draft,
        }
        : proposal.payload,
  };
}

function removeDraftFromActionProposal(
  proposal: AiActionProposal,
  draftId: string
): AiActionProposal | null {
  if (proposal.payload?.kind !== 'create_proposal') {
    return proposal;
  }
  const remainingDrafts = getActionProposalDrafts(proposal).filter((draft) => draft.id !== draftId);
  if (remainingDrafts.length === 0) {
    return null;
  }
  return {
    ...proposal,
    payload: {
      ...proposal.payload,
      proposalDraft: remainingDrafts[0],
      ...(remainingDrafts.length > 1 ? { proposalDrafts: remainingDrafts } : {}),
    },
  };
}

function pruneDraftConversation(messages: AiMessage[], assistantMessageId: string): AiMessage[] {
  const assistantIndex = messages.findIndex((message) => message.id === assistantMessageId);
  if (assistantIndex === -1) return messages;
  const next = [...messages];
  next.splice(assistantIndex, 1);
  const previous = next[assistantIndex - 1];
  if (previous?.role === 'user') {
    next.splice(assistantIndex - 1, 1);
  }
  return next;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function parseFirstTime24h(input: string): { hour: number; minute: number } | null {
  const normalized = formatTo24HourTimeText(input || '');
  const match = normalized.match(/\b([01]\d|2[0-3]):([0-5]\d)\b/);
  if (!match) return null;
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

function formatIcsDatePart(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function formatIcsDateTimePart(date: Date): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${formatIcsDatePart(date)}T${hh}${mm}00`;
}

function escapeIcsText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}


function summarizeMemoryRecord(record: MemoryRecord): string {
  const availabilityLabel =
    record.value.availability === 'available'
      ? 'Available'
      : record.value.availability === 'unavailable'
        ? 'Unavailable'
        : 'Availability';
  const modalityValue =
    record.value.modality === 'in_person'
      ? 'in-person'
      : record.value.modality === 'online'
        ? 'online'
        : 'general';
  if (record.factType === 'availability_recurring_constraint') {
    const weekday =
      typeof record.value.weekday === 'string' ? String(record.value.weekday) : 'unspecified day';
    const timeQualifier =
      typeof record.value.after === 'string'
        ? ` after ${String(record.value.after)}`
        : typeof record.value.before === 'string'
          ? ` before ${String(record.value.before)}`
          : '';
    return `${availabilityLabel} (${modalityValue}) on ${weekday}s${timeQualifier}`;
  }
  if (record.factType === 'availability_constraint') {
    const monthLabel =
      typeof record.value.month === 'string'
        ? String(record.value.month)
        : record.validFrom || 'unspecified';
    const rangeLabel =
      record.validFrom && record.validTo ? ` (${record.validFrom} to ${record.validTo})` : '';
    const timeQualifier =
      typeof record.value.after === 'string'
        ? ` after ${String(record.value.after)}`
        : typeof record.value.before === 'string'
          ? ` before ${String(record.value.before)}`
          : '';
    return `${availabilityLabel} (${modalityValue}) in ${monthLabel}${timeQualifier}${rangeLabel}`;
  }
  if (record.factType === 'availability_time_preference') {
    const after = typeof record.value.after === 'string' ? `after ${String(record.value.after)}` : '';
    const before =
      typeof record.value.before === 'string' ? `before ${String(record.value.before)}` : '';
    const qualifier = [after, before].filter(Boolean).join(' and ') || 'unspecified time';
    return `${availabilityLabel} (${modalityValue}) ${qualifier}`;
  }
  if (record.factType === 'food_preference') {
    const likes = readStringArray(record.value.likes);
    const dislikes = readStringArray(record.value.dislikes);
    const budgetBand = typeof record.value.budgetBand === 'string' ? `, budget ${record.value.budgetBand}` : '';
    const likesText = likes.length > 0 ? `Likes ${likes.join(', ')}` : 'Food preferences';
    const dislikesText = dislikes.length > 0 ? `; avoids ${dislikes.join(', ')}` : '';
    return `${likesText}${dislikesText}${budgetBand}`;
  }
  if (record.factType === 'venue_preference') {
    const likes = readStringArray(record.value.likes);
    const priorities = readStringArray(record.value.priorities);
    const city = typeof record.value.city === 'string' ? ` in ${record.value.city}` : '';
    if (priorities.length > 0) return `Venue priorities: ${priorities.join(', ')}${city}`;
    if (likes.length > 0) return `Likes venues: ${likes.join(', ')}${city}`;
  }
  if (record.factType === 'budget_preference') {
    const level = typeof record.value.level === 'string' ? record.value.level : 'unspecified';
    return `Budget preference: ${level}`;
  }
  if (record.factType === 'group_budget_norm') {
    const range =
      typeof record.value.defaultDinnerBudgetSek === 'string'
        ? `${record.value.defaultDinnerBudgetSek} SEK`
        : 'unspecified';
    return `Group dinner budget norm: ${range}`;
  }
  if (record.factType === 'group_location_cluster') {
    const areas = readStringArray(record.value.commonAreas);
    return areas.length > 0 ? `Common meetup areas: ${areas.join(', ')}` : 'Group location cluster';
  }
  if (record.factType === 'activity_preference') {
    const likes = readStringArray(record.value.likes);
    return likes.length > 0 ? `Likes activities: ${likes.join(', ')}` : 'Activity preference';
  }
  if (record.factType === 'location_preference') {
    const city = typeof record.value.city === 'string' ? String(record.value.city) : 'unspecified';
    return `Location preference: ${city}`;
  }
  if (record.factType === 'home_area') {
    const city = typeof record.value.city === 'string' ? String(record.value.city) : '';
    const area = typeof record.value.area === 'string' ? String(record.value.area) : '';
    return `Home area: ${[area, city].filter(Boolean).join(', ') || 'unspecified'}`;
  }
  if (record.factType === 'trip_style_preference') {
    const likes = readStringArray(record.value.likes);
    return likes.length > 0 ? `Trip style: ${likes.join(', ')}` : 'Trip style preference';
  }
  if (record.factType === 'group_planning_norm') {
    return typeof record.value.note === 'string'
      ? `Group planning norm: ${record.value.note}`
      : 'Group planning norm';
  }
  return record.factType.split('_').join(' ');
}



export function AiAssistantPanel({
  userId,
  activeGroupId,
  compact = false,
  showInlineChatbox = false,
  proposalFlow = false,
  onProposalFlowGoActivities,
}: AiAssistantPanelProps) {
  const {
    addProposal,
    addProposalContributions,
    updateProposal,
    proposals,
    groupUsers,
    getProposalAvailabilities,
    getAvailability,
    setAvailability,
  } = useProposals();
  const [threadId, setThreadId] = useState<string | undefined>(undefined);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [actionProposalsByMessageId, setActionProposalsByMessageId] = useState<
    Record<string, AiActionProposal>
  >({});
  const [hiddenActionMessageIds, setHiddenActionMessageIds] = useState<Record<string, boolean>>({});
  const [executingActionKey, setExecutingActionKey] = useState<string | null>(null);
  const [completedActionKeys, setCompletedActionKeys] = useState<Record<string, boolean>>(
    {}
  );
  const [proposalFlowDraftValuesByDraftKey, setProposalFlowDraftValuesByDraftKey] = useState<
    Record<string, AiProposalFormValues>
  >({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentMemories, setRecentMemories] = useState<MemoryRecord[]>(() =>
    memoryStore.listForUser(userId, activeGroupId).slice(0, 4)
  );
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null);
  const [memoryNoteDraft, setMemoryNoteDraft] = useState('');
  const [memoryCitationsByMessageId, setMemoryCitationsByMessageId] = useState<
    Record<string, MemoryRecord[]>
  >({});
  const [showMemoryExplorer, setShowMemoryExplorer] = useState(false);

  const [memorySeedStatus, setMemorySeedStatus] = useState<string | null>(null);
  const [proposalCardDrafts, setProposalCardDrafts] = useState<ProposalCardDrafts>({});
  const [proposalFeedRefreshTick, setProposalFeedRefreshTick] = useState(0);
  const [proposalThumbnailUrls, setProposalThumbnailUrls] = useState<Record<string, string>>({});
  const [thumbnailGeneratingByProposalId, setThumbnailGeneratingByProposalId] = useState<
    Record<string, boolean>
  >({});
  const [thumbnailErrorByProposalId, setThumbnailErrorByProposalId] = useState<Record<string, string>>({});
  const [selectedAlternativeIdsByProposal, setSelectedAlternativeIdsByProposal] = useState<
    Record<string, Record<string, boolean>>
  >({});
  const [calendarPopup, setCalendarPopup] = useState<CalendarPopupState | null>(null);
  const [proposalFlowAlternativeDraftsByDraftKey, setProposalFlowAlternativeDraftsByDraftKey] =
    useState<Record<string, ProposalFlowAlternativeDraft>>({});
  const [pendingAlternativeSuggestionsByDraftKey, setPendingAlternativeSuggestionsByDraftKey] =
    useState<Record<string, PendingAlternativeSuggestion[]>>({});
  const [commentDraftByProposalId, setCommentDraftByProposalId] = useState<Record<string, string>>({});

  useEffect(() => {
    setRecentMemories(memoryStore.listForUser(userId, activeGroupId).slice(0, 4));
  }, [userId, activeGroupId]);

  useEffect(() => {
    proposalThreadStore.ensureImplicitAffirmationsForProposals(proposals);
    setProposalFeedRefreshTick((tick) => tick + 1);
  }, [proposals]);

  useEffect(() => {
    if (proposals.length === 0) {
      setProposalThumbnailUrls({});
      setThumbnailErrorByProposalId({});
      return;
    }
    const stored = proposalThumbnailStore.getMany(proposals.map((p) => p.id));
    const next: Record<string, string> = {};
    for (const [proposalId, record] of Object.entries(stored)) {
      next[proposalId] = record.imageUrl;
    }
    setProposalThumbnailUrls(next);
    if (canGenerateProposalThumbnail()) {
      setThumbnailErrorByProposalId({});
    }
  }, [proposals]);

  const handleProposeFromDraft = async (
    messageId: string,
    draftKey: string,
    proposal: AiActionProposal,
    formValues: AiProposalFormValues
  ) => {
    if (executingActionKey) return;
    if (proposal.payload?.kind !== 'create_proposal') {
      setError('Unsupported AI action payload');
      return;
    }

    setError(null);
    setExecutingActionKey(draftKey);

    try {
      const draft = proposal.payload.proposalDraft;
      const draftId = draft.id;
      const dateValue = formValues.dates.trim();
      const timeValue = formValues.times.trim();
      const startTimeValue = normalizeTimeInputValue(formValues.startTime.trim());
      const endTimeValue = normalizeTimeInputValue(formValues.endTime.trim());
      const placeValue = formValues.place.trim();
      const requirementsValue = formValues.requirements.trim();
      const commentsValue = formValues.comments.trim();
      const createdAt = new Date().toISOString();
      const createdProposalId = generateId();
      const createdComments = [
        ...(requirementsValue
          ? [
            {
              id: generateId(),
              userId,
              proposalId: createdProposalId,
              text: `Requirements: ${requirementsValue}`,
              createdAt,
            },
          ]
          : []),
        ...(commentsValue
          ? [
            {
              id: generateId(),
              userId,
              proposalId: createdProposalId,
              text: commentsValue,
              createdAt,
            },
          ]
          : []),
      ];
      const createdProposal: Proposal = {
        id: createdProposalId,
        title: formValues.title.trim(),
        type: draft.type,
        emoji: draft.emoji || '🎉',
        createdBy: userId,
        authoredBy: userId,
        createdAt,
        status: 'proposed',
        specifics: {
          ...(dateValue ? { date: dateValue } : {}),
          ...(draft.type === 'sejour'
            ? {
              ...(startTimeValue ? { startTime: startTimeValue } : {}),
              ...(endTimeValue ? { endTime: endTimeValue } : {}),
            }
            : timeValue
              ? { time: timeValue }
              : {}),
          ...(placeValue ? { location: placeValue } : {}),
          ...(requirementsValue ? { requirements: requirementsValue } : {}),
        },
        ...(createdComments.length > 0 ? { comments: createdComments } : {}),
      };

      addProposal(createdProposal);
      const implicitAffirmation = proposalThreadStore.addImplicitProposerAffirmation(createdProposal);
      if (implicitAffirmation) {
        void addProposalContributions(implicitAffirmation);
      }
      const pendingAlternatives = pendingAlternativeSuggestionsByDraftKey[draftKey] || [];
      let nextAvailability = getAvailability(userId, createdProposal.id);
      pendingAlternatives.forEach((suggestion) => {
        if (suggestion.dateText) {
          const { contribution, auditContribution, impliedDates } = proposalThreadStore.addDateFieldChange(
            createdProposal.id,
            userId,
            suggestion.dateText
          );
          void addProposalContributions([contribution, auditContribution]);
          if (impliedDates.length > 0) {
            const mergedDates = Array.from(
              new Set([...(nextAvailability?.dates || []), ...impliedDates])
            ).sort();
            nextAvailability = {
              id: nextAvailability?.id || generateId(),
              userId,
              proposalId: createdProposal.id,
              dates: mergedDates,
              timeSlots: nextAvailability?.timeSlots,
            };
          }
        }
        if (suggestion.timeText) {
          const contribution = proposalThreadStore.addFieldChange(
            createdProposal.id,
            userId,
            'time',
            suggestion.timeText
          );
          void addProposalContributions(contribution);
        }
        if (suggestion.placeText) {
          const contribution = proposalThreadStore.addFieldChange(
            createdProposal.id,
            userId,
            'place',
            suggestion.placeText
          );
          void addProposalContributions(contribution);
        }
      });
      if (nextAvailability) {
        setAvailability(nextAvailability);
      }
      setProposalFeedRefreshTick((tick) => tick + 1);
      if (canGenerateProposalThumbnail()) {
        void handleGenerateProposalThumbnail(createdProposal);
      }

      setActionProposalsByMessageId((prev) => {
        const current = prev[messageId];
        if (!current) return prev;
        const nextProposal = removeDraftFromActionProposal(current, draftId);
        if (!nextProposal) {
          const { [messageId]: _removed, ...rest } = prev;
          return rest;
        }
        return {
          ...prev,
          [messageId]: nextProposal,
        };
      });
      setProposalFlowDraftValuesByDraftKey((prev) => {
        const next = { ...prev };
        delete next[draftKey];
        return next;
      });
      setPendingAlternativeSuggestionsByDraftKey((prev) => {
        const next = { ...prev };
        delete next[draftKey];
        return next;
      });
      setProposalFlowAlternativeDraftsByDraftKey((prev) => {
        const next = { ...prev };
        delete next[draftKey];
        return next;
      });
      setCompletedActionKeys((prev) => {
        const next = { ...prev };
        delete next[draftKey];
        return next;
      });
      if (getActionProposalDrafts(proposal).length <= 1) {
        setHiddenActionMessageIds((prev) => ({ ...prev, [messageId]: true }));
        setMessages((prev) => pruneDraftConversation(prev, messageId));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to execute AI action');
    } finally {
      setExecutingActionKey(null);
    }
  };

  const handleCancelAction = (messageId: string) => {
    setHiddenActionMessageIds((prev) => ({ ...prev, [messageId]: true }));
    setMessages((prev) => pruneDraftConversation(prev, messageId));
    setActionProposalsByMessageId((prev) => {
      const { [messageId]: _removed, ...rest } = prev;
      return rest;
    });
  };

  const refreshRecentMemories = () => {
    setRecentMemories(memoryStore.listForUser(userId, activeGroupId).slice(0, 4));
  };


  const handleConfirmMemory = (recordId: string) => {
    memoryStore.update(recordId, { status: 'confirmed' });
    refreshRecentMemories();
  };

  const handleDismissMemory = (recordId: string) => {
    memoryStore.remove(recordId);
    if (editingMemoryId === recordId) {
      setEditingMemoryId(null);
      setMemoryNoteDraft('');
    }
    refreshRecentMemories();
  };

  const handleStartEditMemory = (record: MemoryRecord) => {
    setEditingMemoryId(record.id);
    setMemoryNoteDraft(
      typeof record.value.note === 'string' ? String(record.value.note) : ''
    );
  };

  const handleSaveMemoryNote = (record: MemoryRecord) => {
    memoryStore.update(record.id, {
      value: {
        ...record.value,
        note: memoryNoteDraft.trim(),
      },
    });
    setEditingMemoryId(null);
    setMemoryNoteDraft('');
    refreshRecentMemories();
  };

  const handleSeedStockholmPersonas = () => {
    const seedRecords = buildStockholmSeedMemoryRecords(activeGroupId);
    const addedCount = memoryStore.addManyDedupedBySourceRef(seedRecords);
    refreshRecentMemories();
    setMemorySeedStatus(
      addedCount > 0
        ? `Added ${addedCount} fictional Stockholm seed memory records.`
        : 'Stockholm seed personas were already loaded (no duplicates added).'
    );
    setShowMemoryExplorer(true);
  };

  const handleClearSeedPersonas = () => {
    const removedCount = memoryStore.clearBySourceKind('manual_seed');
    refreshRecentMemories();
    setMemorySeedStatus(
      removedCount > 0
        ? `Removed ${removedCount} fictional seed memory records.`
        : 'No fictional seed memory records were present.'
    );
  };

  const handleAffirmAvailabilityAsProposed = (proposal: Proposal) => {
    if (!proposalThreadStore.hasExplicitAffirmation(proposal.id, userId)) {
      const contribution = proposalThreadStore.addExplicitAffirmation(proposal.id, userId);
      void addProposalContributions(contribution);
    }
    const baselineDates = proposal.specifics?.date ? parseIsoDatesFromText(proposal.specifics.date) : [];
    if (baselineDates.length > 0) {
      const current = getAvailability(userId, proposal.id);
      const nextDates = Array.from(new Set([...(current?.dates || []), ...baselineDates])).sort();
      const nextAvailability: Availability = {
        id: current?.id || generateId(),
        userId,
        proposalId: proposal.id,
        dates: nextDates,
        timeSlots: current?.timeSlots,
      };
      setAvailability(nextAvailability);
    }
    setProposalFeedRefreshTick((tick) => tick + 1);
  };

  const openSuggestAlternativesModal = (proposalId: string) => {
    const proposal = proposals.find((entry) => entry.id === proposalId);
    const previous = proposalCardDrafts[proposalId];
    const parsed = parseDateRangeFromText(previous?.dateSuggestion || '');
    const parsedTimes = parseSejourTimeText(previous?.timeSuggestion || '');
    setProposalCardDrafts((prev) => ({
      ...prev,
      [proposalId]: {
        dateSuggestion: previous?.dateSuggestion || '',
        startDateSuggestion: previous?.startDateSuggestion || parsed.startDate,
        endDateSuggestion: previous?.endDateSuggestion || parsed.endDate,
        timeSuggestion:
          proposal?.type === 'sejour' ? '' : normalizeTimeInputValue(previous?.timeSuggestion || ''),
        startTimeSuggestion: previous?.startTimeSuggestion || parsedTimes.startTime || '',
        endTimeSuggestion: previous?.endTimeSuggestion || parsedTimes.endTime || '',
        placeSuggestion: previous?.placeSuggestion || '',
        isSuggestModalOpen: true,
      },
    }));
  };

  const closeSuggestAlternativesModal = (proposalId: string) => {
    const proposal = proposals.find((entry) => entry.id === proposalId);
    const existingDraft = proposalCardDrafts[proposalId];
    const parsedTimes = parseSejourTimeText(existingDraft?.timeSuggestion || '');
    setProposalCardDrafts((prev) => ({
      ...prev,
      [proposalId]: {
        dateSuggestion: prev[proposalId]?.dateSuggestion || '',
        startDateSuggestion:
          prev[proposalId]?.startDateSuggestion ||
          parseDateRangeFromText(prev[proposalId]?.dateSuggestion || '').startDate,
        endDateSuggestion:
          prev[proposalId]?.endDateSuggestion ||
          parseDateRangeFromText(prev[proposalId]?.dateSuggestion || '').endDate,
        timeSuggestion:
          proposal?.type === 'sejour' ? '' : normalizeTimeInputValue(prev[proposalId]?.timeSuggestion || ''),
        startTimeSuggestion: prev[proposalId]?.startTimeSuggestion || parsedTimes.startTime || '',
        endTimeSuggestion: prev[proposalId]?.endTimeSuggestion || parsedTimes.endTime || '',
        placeSuggestion: prev[proposalId]?.placeSuggestion || '',
        isSuggestModalOpen: false,
      },
    }));
  };

  const updateProposalCardDraft = (
    proposalId: string,
    updates: Partial<ProposalCardDrafts[string]>
  ) => {
    setProposalCardDrafts((prev) => ({
      ...prev,
      [proposalId]: {
        ...(prev[proposalId] || {
          dateSuggestion: '',
          startDateSuggestion: '',
          endDateSuggestion: '',
          timeSuggestion: '',
          startTimeSuggestion: '',
          endTimeSuggestion: '',
          placeSuggestion: '',
        }),
        ...updates,
        ...(updates.timeSuggestion !== undefined
          ? { timeSuggestion: normalizeTimeInputValue(updates.timeSuggestion) }
          : {}),
        ...(updates.startTimeSuggestion !== undefined
          ? { startTimeSuggestion: normalizeTimeInputValue(updates.startTimeSuggestion) }
          : {}),
        ...(updates.endTimeSuggestion !== undefined
          ? { endTimeSuggestion: normalizeTimeInputValue(updates.endTimeSuggestion) }
          : {}),
      },
    }));
  };

  const handleSubmitAlternatives = (proposal: Proposal) => {
    const draft = proposalCardDrafts[proposal.id];
    if (!draft) return;
    const dateText = formatDateRangeText(
      draft.startDateSuggestion.trim(),
      draft.endDateSuggestion.trim()
    );
    const timeText =
      proposal.type === 'sejour'
        ? formatSejourTimeText(draft.startTimeSuggestion, draft.endTimeSuggestion).trim()
        : normalizeTimeInputValue(draft.timeSuggestion).trim();
    const placeText = draft.placeSuggestion.trim();
    if (!dateText && !timeText && !placeText) return;

    if (dateText) {
      const { contribution, auditContribution, impliedDates } = proposalThreadStore.addDateFieldChange(
        proposal.id,
        userId,
        dateText
      );
      void addProposalContributions([contribution, auditContribution]);
      if (impliedDates.length > 0) {
        const current = getAvailability(userId, proposal.id);
        const nextDates = Array.from(new Set([...(current?.dates || []), ...impliedDates])).sort();
        setAvailability({
          id: current?.id || generateId(),
          userId,
          proposalId: proposal.id,
          dates: nextDates,
          timeSlots: current?.timeSlots,
        });
      }
    }
    if (timeText) {
      const contribution = proposalThreadStore.addFieldChange(proposal.id, userId, 'time', timeText);
      void addProposalContributions(contribution);
    }
    if (placeText) {
      const contribution = proposalThreadStore.addFieldChange(proposal.id, userId, 'place', placeText);
      void addProposalContributions(contribution);
    }

    setProposalCardDrafts((prev) => ({
      ...prev,
      [proposal.id]: {
        dateSuggestion: '',
        startDateSuggestion: '',
        endDateSuggestion: '',
        timeSuggestion: '',
        startTimeSuggestion: '',
        endTimeSuggestion: '',
        placeSuggestion: '',
        isSuggestModalOpen: false,
      },
    }));
    setProposalFeedRefreshTick((tick) => tick + 1);
  };

  const handleGenerateProposalThumbnail = async (proposal: Proposal) => {
    setThumbnailErrorByProposalId((prev) => ({ ...prev, [proposal.id]: '' }));
    setThumbnailGeneratingByProposalId((prev) => ({ ...prev, [proposal.id]: true }));
    try {
      const imageUrl = await generateProposalThumbnail(proposal);
      proposalThumbnailStore.set(proposal.id, imageUrl);
      setProposalThumbnailUrls((prev) => ({ ...prev, [proposal.id]: imageUrl }));
      setThumbnailErrorByProposalId((prev) => ({ ...prev, [proposal.id]: '' }));
    } catch (err) {
      setThumbnailErrorByProposalId((prev) => ({
        ...prev,
        [proposal.id]: err instanceof Error ? err.message : 'Thumbnail generation failed',
      }));
    } finally {
      setThumbnailGeneratingByProposalId((prev) => ({ ...prev, [proposal.id]: false }));
    }
  };

  const updateProposalFlowAlternativeDraft = (
    draftKey: string,
    key: keyof ProposalFlowAlternativeDraft,
    value: string
  ) => {
    setProposalFlowAlternativeDraftsByDraftKey((prev) => ({
      ...prev,
      [draftKey]: {
        ...(prev[draftKey] || EMPTY_PROPOSAL_FLOW_ALTERNATIVE_DRAFT),
        [key]:
          key === 'time' || key === 'startTime' || key === 'endTime'
            ? normalizeTimeInputValue(value)
            : value,
      },
    }));
  };

  const addPendingAlternativeSuggestion = (draftKey: string, proposalType: Proposal['type']) => {
    const draft =
      proposalFlowAlternativeDraftsByDraftKey[draftKey] || EMPTY_PROPOSAL_FLOW_ALTERNATIVE_DRAFT;
    const dateText = formatDateRangeText(draft.startDate.trim(), draft.endDate.trim());
    const timeText =
      proposalType === 'sejour'
        ? formatSejourTimeText(draft.startTime, draft.endTime).trim()
        : normalizeTimeInputValue(draft.time).trim();
    const placeText = draft.place.trim();
    if (!dateText && !timeText && !placeText) return;

    const nextSuggestion: PendingAlternativeSuggestion = {
      id: generateId(),
      dateText,
      timeText,
      placeText,
    };

    setPendingAlternativeSuggestionsByDraftKey((prev) => ({
      ...prev,
      [draftKey]: [...(prev[draftKey] || []), nextSuggestion],
    }));
    setProposalFlowAlternativeDraftsByDraftKey((prev) => ({
      ...prev,
      [draftKey]: EMPTY_PROPOSAL_FLOW_ALTERNATIVE_DRAFT,
    }));
  };

  const removePendingAlternativeSuggestion = (draftKey: string, suggestionId: string) => {
    setPendingAlternativeSuggestionsByDraftKey((prev) => ({
      ...prev,
      [draftKey]: (prev[draftKey] || []).filter((entry) => entry.id !== suggestionId),
    }));
  };

  const handleAddProposalComment = async (proposal: Proposal) => {
    const text = (commentDraftByProposalId[proposal.id] || '').trim();
    if (!text) return;
    const nextComments = [
      ...(proposal.comments || []),
      {
        id: generateId(),
        userId,
        proposalId: proposal.id,
        text,
        createdAt: new Date().toISOString(),
      },
    ];
    await updateProposal(proposal.id, { comments: nextComments });
    setCommentDraftByProposalId((prev) => ({ ...prev, [proposal.id]: '' }));
  };


  const handleAddToCalendar = (proposal: Proposal) => {
    const parsedDates = parseIsoDatesFromText(proposal.specifics?.date || '');
    if (parsedDates.length === 0) {
      setError('Cannot add to calendar: proposal has no valid date.');
      return;
    }

    const startDate = new Date(`${parsedDates[0]}T00:00:00`);
    const lastDate = parsedDates[parsedDates.length - 1];
    const endDateBase = new Date(`${lastDate}T00:00:00`);
    const startTimeValue = proposal.type === 'sejour'
      ? getProposalStartTime(proposal)
      : proposal.specifics?.time || '';
    const endTimeValue = proposal.type === 'sejour'
      ? getProposalEndTime(proposal)
      : proposal.specifics?.time || '';
    const parsedTime = parseFirstTime24h(startTimeValue);

    let dtStart = '';
    let dtEnd = '';
    let allDay = false;

    if (parsedTime) {
      startDate.setHours(parsedTime.hour, parsedTime.minute, 0, 0);
      const parsedEndTime = parseFirstTime24h(endTimeValue);
      const endDateTime = parsedEndTime
        ? new Date(`${lastDate}T00:00:00`)
        : new Date(startDate.getTime() + 60 * 60 * 1000);
      if (parsedEndTime) {
        endDateTime.setHours(parsedEndTime.hour, parsedEndTime.minute, 0, 0);
      }
      dtStart = formatIcsDateTimePart(startDate);
      dtEnd = formatIcsDateTimePart(endDateTime);
    } else {
      allDay = true;
      const exclusiveEnd = new Date(endDateBase);
      exclusiveEnd.setDate(exclusiveEnd.getDate() + 1);
      dtStart = formatIcsDatePart(startDate);
      dtEnd = formatIcsDatePart(exclusiveEnd);
    }

    const locationText = proposal.specifics?.location?.trim() || '';
    const descriptionParts = [
      proposal.comments?.length ? proposal.comments.map((c) => c.text).join('\n') : '',
      startTimeValue || endTimeValue ? `Time: ${[startTimeValue, endTimeValue].filter(Boolean).join(' -> ')}` : '',
      proposal.specifics?.date ? `Date: ${proposal.specifics.date}` : '',
    ].filter(Boolean);

    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//mtUp//Snooky//EN',
      'BEGIN:VEVENT',
      `UID:${proposal.id}@mtup.local`,
      `DTSTAMP:${formatIcsDateTimePart(new Date())}`,
      allDay ? `DTSTART;VALUE=DATE:${dtStart}` : `DTSTART:${dtStart}`,
      allDay ? `DTEND;VALUE=DATE:${dtEnd}` : `DTEND:${dtEnd}`,
      `SUMMARY:${escapeIcsText(proposal.title)}`,
      ...(locationText ? [`LOCATION:${escapeIcsText(locationText)}`] : []),
      ...(descriptionParts.length > 0
        ? [`DESCRIPTION:${escapeIcsText(descriptionParts.join('\n'))}`]
        : []),
      'END:VEVENT',
      'END:VCALENDAR',
    ];

    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${proposal.title.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'event'}.ics`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const toggleAlternativeSelection = (proposalId: string, optionId: string) => {
    setSelectedAlternativeIdsByProposal((prev) => ({
      ...prev,
      [proposalId]: {
        ...(prev[proposalId] || {}),
        [optionId]: !prev[proposalId]?.[optionId],
      },
    }));
  };

  const openCalendarPopup = (
    proposal: Proposal,
    originalDates: string[],
    alternativeDates: string[]
  ) => {
    const anchorMonthIso =
      originalDates[0] ||
      alternativeDates[0] ||
      new Date().toISOString().slice(0, 10);
    setCalendarPopup({
      proposalId: proposal.id,
      proposalTitle: proposal.title,
      anchorMonthIso,
      originalDates,
      alternativeDates,
    });
  };

  const sortedProposals = [...proposals].sort((a, b) => {
    const aDates = parseIsoDatesFromText(a.specifics?.date || '');
    const bDates = parseIsoDatesFromText(b.specifics?.date || '');
    const aFirstDate = aDates[0] || null;
    const bFirstDate = bDates[0] || null;

    if (aFirstDate && bFirstDate) {
      return aFirstDate.localeCompare(bFirstDate) || b.createdAt.localeCompare(a.createdAt);
    }
    if (aFirstDate) return -1;
    if (bFirstDate) return 1;
    return b.createdAt.localeCompare(a.createdAt);
  });
  const cardDeckMode = !compact;
  const displayGroupUsers =
    groupUsers.length > 0
      ? groupUsers
      : EXPECTED_GROUP_MEMBER_NAMES.map((name, index) => ({
        id: `expected-member-${index + 1}`,
        name,
        isAdmin: name === 'Alice',
      }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const prompt = input.trim();
    if (!prompt || isLoading) return;

    const outgoing: AiMessage = {
      id: generateId(),
      role: 'user',
      content: prompt,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, outgoing]);
    const relevantMemories = memoryStore.findRelevantForPrompt(userId, prompt, activeGroupId);
    const capturedMemories = memoryStore.captureSelfReportedMemories({
      userId,
      activeGroupId,
      messageText: prompt,
      sourceMessageId: outgoing.id,
    });
    if (capturedMemories.length > 0) {
      setRecentMemories((prev) => [...capturedMemories, ...prev].slice(0, 4));
    }
    setInput('');
    setError(null);
    setIsLoading(true);

    try {
      const response = await sendAiMessage({
        threadId,
        message: prompt,
        context: {
          userId,
          activeGroupId,
          ...(proposalFlow ? { uiMode: 'propose' as const } : {}),
          memoryHints: relevantMemories.map((record) => ({
            id: record.id,
            factType: record.factType,
            status: record.status,
            summary: summarizeMemoryRecord(record),
            observedAt: record.observedAt,
          })),
        },
      });
      setThreadId(response.threadId);
      setMessages((prev) => [...prev, response.assistantMessage]);
      if (relevantMemories.length > 0) {
        setMemoryCitationsByMessageId((prev) => ({
          ...prev,
          [response.assistantMessage.id]: relevantMemories,
        }));
      }
      if (response.mode === 'action_proposal' && response.actionProposal) {
        const proposal = response.actionProposal;
        setActionProposalsByMessageId((prev) => ({
          ...prev,
          [response.assistantMessage.id]: proposal,
        }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI request failed');
    } finally {
      setIsLoading(false);
    }
  };

  const getInitialDraftValues = (draft: AiProposalDraft): AiProposalFormValues => {
    return {
      title: draft?.title || '',
      dates: draft?.form?.dates || draft?.specifics?.date || '',
      times: normalizeTimeInputValue(draft?.form?.times || draft?.specifics?.time || ''),
      startTime: normalizeTimeInputValue(
        draft?.form?.startTime || draft?.specifics?.startTime || ''
      ),
      endTime: normalizeTimeInputValue(
        draft?.form?.endTime || draft?.specifics?.endTime || ''
      ),
      invitees: draft?.form?.invitees || 'Everyone in active group',
      place: draft?.form?.place || draft?.specifics?.location || '',
      requirements: draft?.form?.requirements || '',
      comments: draft?.form?.comments || '',
    };
  };

  const updateProposalFlowDraftField = (
    draftKey: string,
    draft: AiProposalDraft,
    key: keyof AiProposalFormValues,
    value: string
  ) => {
    setProposalFlowDraftValuesByDraftKey((prev) => ({
      ...prev,
      [draftKey]: {
        ...((prev[draftKey] || getInitialDraftValues(draft)) as AiProposalFormValues),
        [key]:
          key === 'times' || key === 'startTime' || key === 'endTime'
            ? normalizeTimeInputValue(value)
            : value,
      },
    }));
  };

  const latestProposalFlowActionMessage = [...messages]
    .reverse()
    .find(
      (message) =>
        message.role === 'assistant' &&
        Boolean(actionProposalsByMessageId[message.id]) &&
        !hiddenActionMessageIds[message.id]
    );
  const latestProposalFlowActionMessageId = latestProposalFlowActionMessage?.id ?? null;
  const latestProposalFlowActionProposal = latestProposalFlowActionMessageId
    ? actionProposalsByMessageId[latestProposalFlowActionMessageId]
    : null;
  const latestProposalFlowDrafts = latestProposalFlowActionProposal
    ? getActionProposalDrafts(latestProposalFlowActionProposal)
    : [];
  const latestProposalFlowPrimaryDraft = latestProposalFlowDrafts[0] || null;
  const latestProposalFlowPrimaryDraftKey =
    latestProposalFlowActionMessageId && latestProposalFlowPrimaryDraft
      ? getScopedDraftKey(latestProposalFlowActionMessageId, latestProposalFlowPrimaryDraft.id)
      : null;
  const latestProposalFlowDraftValues =
    latestProposalFlowPrimaryDraftKey && latestProposalFlowPrimaryDraft
      ? proposalFlowDraftValuesByDraftKey[latestProposalFlowPrimaryDraftKey] ||
      getInitialDraftValues(latestProposalFlowPrimaryDraft)
      : null;
  const userNameById = new Map(displayGroupUsers.map((member) => [member.id, member.name]));

  if (cardDeckMode) {
    return (
      <div className="flex h-full min-h-0 flex-col gap-2">
        {showInlineChatbox && (
          <form onSubmit={handleSubmit} className="flex gap-2 rounded-lg bg-white p-2 dark:bg-slate-900">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Snooky..."
              className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
            <button
              type="submit"
              disabled={isLoading || input.trim().length === 0}
              className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? 'Asking...' : 'Ask'}
            </button>
          </form>
        )}
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </div>
        )}
        {proposalFlow ? (
          <div className="flex min-h-0 flex-1 flex-col gap-2">
            <div
              data-screen-scroll-root="true"
              className="hide-scrollbar min-h-0 flex-1 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900"
            >
              {messages.length > 0 && (
                <div className="space-y-2">
                  {messages.map((message) => {
                    const draftProposal = actionProposalsByMessageId[message.id];
                    const draftsForMessage = draftProposal
                      ? getActionProposalDrafts(draftProposal)
                      : [];
                    const primaryDraft = draftsForMessage[0] || null;
                    const primaryDraftKey =
                      primaryDraft && draftProposal
                        ? getScopedDraftKey(message.id, primaryDraft.id)
                        : null;
                    const shouldShowDraftDetails =
                      message.role === 'assistant' &&
                      Boolean(draftProposal) &&
                      !hiddenActionMessageIds[message.id];
                    const shouldShowMessageBubble =
                      !(
                        message.role === 'assistant' &&
                        Boolean(draftProposal) &&
                        !hiddenActionMessageIds[message.id]
                      );
                    const draftValues = primaryDraftKey && primaryDraft
                      ? proposalFlowDraftValuesByDraftKey[primaryDraftKey] || getInitialDraftValues(primaryDraft)
                      : null;
                    const draftDateRange = draftValues
                      ? parseDateRangeFromText(draftValues.dates)
                      : { startDate: '', endDate: '' };
                    const isSejourDraft = primaryDraft?.type === 'sejour';
                    const alternativeDraft = primaryDraftKey
                      ? proposalFlowAlternativeDraftsByDraftKey[primaryDraftKey] || EMPTY_PROPOSAL_FLOW_ALTERNATIVE_DRAFT
                      : EMPTY_PROPOSAL_FLOW_ALTERNATIVE_DRAFT;
                    const pendingAlternatives = primaryDraftKey
                      ? pendingAlternativeSuggestionsByDraftKey[primaryDraftKey] || []
                      : [];
                    const hasMultipleDrafts = draftsForMessage.length > 1;
                    return (
                      <div key={message.id} className="space-y-1.5">
                        {shouldShowMessageBubble && (
                          <div
                            className={`rounded px-3 py-2 text-sm ${message.role === 'user'
                              ? 'bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-100'
                              : 'border border-gray-200 bg-white text-gray-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100'
                              }`}
                          >
                            <div className="text-[10px] uppercase tracking-wide opacity-70">
                              {message.role === 'assistant' ? 'Snooky' : message.role}
                            </div>
                            <div className="whitespace-pre-wrap break-words">{message.content}</div>
                          </div>
                        )}
                        {shouldShowDraftDetails && (
                          <div className="rounded border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900 dark:border-sky-900/50 dark:bg-sky-950/20 dark:text-sky-200">
                            {draftProposal && hasMultipleDrafts ? (
                              <div className="mt-1 space-y-2">
                                <p className="text-[11px] font-medium text-sky-800 dark:text-sky-200">
                                  Review each idea separately and propose only the ones worth keeping.
                                </p>
                                {draftsForMessage.map((draft, draftIndex) => {
                                  const scopedDraftKey = getScopedDraftKey(message.id, draft.id);
                                  const scopedProposal = getScopedActionProposal(
                                    draftProposal,
                                    draft,
                                    draftsForMessage.length
                                  );
                                  return (
                                    <div key={scopedDraftKey} className="space-y-1">
                                      <div className="px-1 text-[10px] font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
                                        Idea {draftIndex + 1}
                                      </div>
                                      <AiProposalFormCard
                                        proposal={scopedProposal}
                                        onPropose={(values, proposal) =>
                                          handleProposeFromDraft(
                                            message.id,
                                            scopedDraftKey,
                                            proposal,
                                            values
                                          )
                                        }
                                        isSubmitting={executingActionKey === scopedDraftKey}
                                        isCompleted={Boolean(completedActionKeys[scopedDraftKey])}
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              draftProposal && draftValues && primaryDraft && primaryDraftKey && (
                                <div className="mt-1 space-y-1.5">
                                  <input
                                    type="text"
                                    value={draftValues.title}
                                    onChange={(e) =>
                                      updateProposalFlowDraftField(
                                        primaryDraftKey,
                                        primaryDraft,
                                        'title',
                                        e.target.value
                                      )
                                    }
                                    placeholder="Title"
                                    className="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-xs text-gray-900 dark:border-sky-900/60 dark:bg-slate-900 dark:text-slate-100"
                                  />
                                  <div className={`grid grid-cols-1 gap-1.5 ${isSejourDraft ? '' : 'md:grid-cols-2'}`}>
                                    {isSejourDraft ? (
                                      <SejourDateTimeRow
                                        startDate={draftDateRange.startDate}
                                        endDate={draftDateRange.endDate}
                                        startTime={draftValues.startTime}
                                        endTime={draftValues.endTime}
                                        onStartDateChange={(value) =>
                                          updateProposalFlowDraftField(
                                            primaryDraftKey,
                                            primaryDraft,
                                            'dates',
                                            formatDateRangeText(value, draftDateRange.endDate)
                                          )
                                        }
                                        onEndDateChange={(value) =>
                                          updateProposalFlowDraftField(
                                            primaryDraftKey,
                                            primaryDraft,
                                            'dates',
                                            formatDateRangeText(draftDateRange.startDate, value)
                                          )
                                        }
                                        onStartTimeChange={(value) =>
                                          updateProposalFlowDraftField(
                                            primaryDraftKey,
                                            primaryDraft,
                                            'startTime',
                                            value
                                          )
                                        }
                                        onEndTimeChange={(value) =>
                                          updateProposalFlowDraftField(
                                            primaryDraftKey,
                                            primaryDraft,
                                            'endTime',
                                            value
                                          )
                                        }
                                        startDateLabel="Start Date"
                                        startTimeLabel="Start Time"
                                        endDateLabel="End Date"
                                        endTimeLabel="End Time"
                                        startDateAriaLabel="Start date"
                                        startTimeAriaLabel="Start time"
                                        endDateAriaLabel="End date"
                                        endTimeAriaLabel="End time"
                                        dateInputClassName="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-xs text-gray-900 dark:border-sky-900/60 dark:bg-slate-900 dark:text-slate-100 dark:[color-scheme:dark]"
                                        timeSelectClassName="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-xs text-gray-900 dark:border-sky-900/60 dark:bg-slate-900 dark:text-slate-100 dark:[color-scheme:dark]"
                                        labelClassName="text-[10px] font-medium uppercase tracking-wide text-sky-700 dark:text-sky-200"
                                        separatorClassName="text-[11px] font-semibold text-sky-400 dark:text-sky-600"
                                      />
                                    ) : (
                                      <input
                                        type="date"
                                        value={draftDateRange.startDate}
                                        onChange={(e) =>
                                          updateProposalFlowDraftField(
                                            primaryDraftKey,
                                            primaryDraft,
                                            'dates',
                                            e.target.value
                                          )
                                        }
                                        aria-label="Date"
                                        className="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-xs text-gray-900 dark:border-sky-900/60 dark:bg-slate-900 dark:text-slate-100 dark:[color-scheme:dark]"
                                      />
                                    )}
                                    {!isSejourDraft && (
                                      <QuarterHourTimeSelect
                                        value={
                                          /^\d{2}:\d{2}$/.test(draftValues.times.trim())
                                            ? draftValues.times.trim()
                                            : ''
                                        }
                                        onChange={(value) =>
                                          updateProposalFlowDraftField(
                                            primaryDraftKey,
                                            primaryDraft,
                                            'times',
                                            value
                                          )
                                        }
                                        ariaLabel="Time"
                                        className="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-xs text-gray-900 dark:border-sky-900/60 dark:bg-slate-900 dark:text-slate-100 dark:[color-scheme:dark]"
                                      />
                                    )}
                                  </div>
                                  <textarea
                                    value={draftValues.invitees}
                                    onChange={(e) =>
                                      updateProposalFlowDraftField(
                                        primaryDraftKey,
                                        primaryDraft,
                                        'invitees',
                                        e.target.value
                                      )
                                    }
                                    rows={2}
                                    placeholder="Invitees"
                                    className="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-xs text-gray-900 dark:border-sky-900/60 dark:bg-slate-900 dark:text-slate-100"
                                  />
                                  <textarea
                                    value={draftValues.place}
                                    onChange={(e) =>
                                      updateProposalFlowDraftField(
                                        primaryDraftKey,
                                        primaryDraft,
                                        'place',
                                        e.target.value
                                      )
                                    }
                                    rows={2}
                                    placeholder="Place"
                                    className="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-xs text-gray-900 dark:border-sky-900/60 dark:bg-slate-900 dark:text-slate-100"
                                  />
                                  <textarea
                                    value={draftValues.requirements}
                                    onChange={(e) =>
                                      updateProposalFlowDraftField(
                                        primaryDraftKey,
                                        primaryDraft,
                                        'requirements',
                                        e.target.value
                                      )
                                    }
                                    rows={2}
                                    placeholder="Requirements"
                                    className="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-xs text-gray-900 dark:border-sky-900/60 dark:bg-slate-900 dark:text-slate-100"
                                  />
                                  <textarea
                                    value={draftValues.comments}
                                    onChange={(e) =>
                                      updateProposalFlowDraftField(
                                        primaryDraftKey,
                                        primaryDraft,
                                        'comments',
                                        e.target.value
                                      )
                                    }
                                    rows={2}
                                    placeholder="Notes"
                                    className="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-xs text-gray-900 dark:border-sky-900/60 dark:bg-slate-900 dark:text-slate-100"
                                  />
                                  <div className="rounded border border-sky-300 bg-white p-2 text-xs text-gray-900 dark:border-sky-900/60 dark:bg-slate-900 dark:text-slate-100">
                                    <p className="font-semibold text-sky-900 dark:text-sky-200">
                                      Add alternative suggestions before confirming
                                    </p>
                                    <div className={`mt-1 grid grid-cols-1 gap-1.5 ${isSejourDraft ? '' : 'md:grid-cols-3'}`}>
                                      {isSejourDraft ? (
                                        <SejourDateTimeRow
                                          startDate={alternativeDraft.startDate}
                                          endDate={alternativeDraft.endDate}
                                          startTime={alternativeDraft.startTime}
                                          endTime={alternativeDraft.endTime}
                                          onStartDateChange={(value) =>
                                            updateProposalFlowAlternativeDraft(primaryDraftKey, 'startDate', value)
                                          }
                                          onEndDateChange={(value) =>
                                            updateProposalFlowAlternativeDraft(primaryDraftKey, 'endDate', value)
                                          }
                                          onStartTimeChange={(value) =>
                                            updateProposalFlowAlternativeDraft(primaryDraftKey, 'startTime', value)
                                          }
                                          onEndTimeChange={(value) =>
                                            updateProposalFlowAlternativeDraft(primaryDraftKey, 'endTime', value)
                                          }
                                          startDateLabel="Start Date"
                                          startTimeLabel="Start Time"
                                          endDateLabel="End Date"
                                          endTimeLabel="End Time"
                                          startDateAriaLabel="Alternative start date"
                                          startTimeAriaLabel="Alternative start time"
                                          endDateAriaLabel="Alternative end date"
                                          endTimeAriaLabel="Alternative end time"
                                          dateInputClassName="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-xs dark:border-sky-900/60 dark:bg-slate-900 dark:[color-scheme:dark]"
                                          timeSelectClassName="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-xs dark:border-sky-900/60 dark:bg-slate-900 dark:[color-scheme:dark]"
                                          labelClassName="text-[10px] font-medium uppercase tracking-wide text-sky-700 dark:text-sky-200"
                                          separatorClassName="text-[11px] font-semibold text-sky-400 dark:text-sky-600"
                                        />
                                      ) : (
                                        <input
                                          type="date"
                                          value={alternativeDraft.startDate}
                                          onChange={(e) => {
                                            updateProposalFlowAlternativeDraft(
                                              primaryDraftKey,
                                              'startDate',
                                              e.target.value
                                            );
                                            updateProposalFlowAlternativeDraft(
                                              primaryDraftKey,
                                              'endDate',
                                              e.target.value
                                            );
                                          }}
                                          aria-label="Alternative date"
                                          className="rounded border border-sky-300 bg-white px-2 py-1.5 text-xs dark:border-sky-900/60 dark:bg-slate-900 dark:[color-scheme:dark]"
                                        />
                                      )}
                                      {!isSejourDraft && (
                                        <QuarterHourTimeSelect
                                          value={alternativeDraft.time}
                                          onChange={(value) =>
                                            updateProposalFlowAlternativeDraft(
                                              primaryDraftKey,
                                              'time',
                                              value
                                            )
                                          }
                                          ariaLabel="Alternative time"
                                          className="rounded border border-sky-300 bg-white px-2 py-1.5 text-xs dark:border-sky-900/60 dark:bg-slate-900 dark:[color-scheme:dark]"
                                        />
                                      )}
                                      <input
                                        type="text"
                                        value={alternativeDraft.place}
                                        onChange={(e) =>
                                          updateProposalFlowAlternativeDraft(
                                            primaryDraftKey,
                                            'place',
                                            e.target.value
                                          )
                                        }
                                        placeholder="Alternative place"
                                        className="rounded border border-sky-300 bg-white px-2 py-1.5 text-xs dark:border-sky-900/60 dark:bg-slate-900"
                                      />
                                    </div>
                                    <div className="mt-1.5 flex items-center justify-between gap-2">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          addPendingAlternativeSuggestion(
                                            primaryDraftKey,
                                            isSejourDraft ? 'sejour' : 'event'
                                          )
                                        }
                                        className="rounded bg-sky-700 px-2 py-1 text-[11px] font-medium text-white hover:bg-sky-800"
                                      >
                                        Queue Alternative
                                      </button>
                                      <span className="text-[10px] text-sky-700 dark:text-sky-300">
                                        {pendingAlternatives.length} queued
                                      </span>
                                    </div>
                                    {pendingAlternatives.length > 0 && (
                                      <div className="mt-1.5 space-y-1">
                                        {pendingAlternatives.map((entry) => (
                                          <div key={entry.id} className="flex items-center gap-1.5">
                                            <span className="flex-1 truncate">
                                              {[entry.dateText, entry.timeText, entry.placeText]
                                                .filter(Boolean)
                                                .join(' | ')}
                                            </span>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                removePendingAlternativeSuggestion(primaryDraftKey, entry.id)
                                              }
                                              className="rounded border border-sky-300 px-1.5 py-0.5 text-[10px] dark:border-sky-900/60"
                                            >
                                              Remove
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))
                            }
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="shrink-0 rounded-lg border border-gray-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-center gap-2">
                {latestProposalFlowActionMessageId &&
                  latestProposalFlowActionProposal &&
                  latestProposalFlowDraftValues &&
                  latestProposalFlowPrimaryDraft &&
                  latestProposalFlowPrimaryDraftKey &&
                  latestProposalFlowDrafts.length === 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        handleProposeFromDraft(
                          latestProposalFlowActionMessageId,
                          latestProposalFlowPrimaryDraftKey,
                          latestProposalFlowActionProposal,
                          latestProposalFlowDraftValues
                        )
                      }
                      disabled={
                        executingActionKey === latestProposalFlowPrimaryDraftKey ||
                        Boolean(completedActionKeys[latestProposalFlowPrimaryDraftKey]) ||
                        latestProposalFlowDraftValues.title.trim().length === 0
                      }
                      className="rounded bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {completedActionKeys[latestProposalFlowPrimaryDraftKey]
                        ? 'Confirmed'
                        : executingActionKey === latestProposalFlowPrimaryDraftKey
                          ? 'Confirming...'
                          : 'Confirm'}
                    </button>
                  )}
                {latestProposalFlowActionMessageId && (
                  <button
                    type="button"
                    onClick={() => handleCancelAction(latestProposalFlowActionMessageId)}
                    className="rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="button"
                  onClick={onProposalFlowGoActivities}
                  className="rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Activities
                </button>
              </div>
            </div>
          </div>
        ) : sortedProposals.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-lg bg-white p-3 text-xs text-gray-600 dark:bg-slate-900 dark:text-slate-300">
            No proposals yet. Use Snooky below to draft one.
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div
              data-screen-scroll-root="true"
              className="hide-scrollbar min-h-0 flex-1 snap-y snap-mandatory overflow-y-auto"
            >
              {sortedProposals.map((proposal, index) => (
                <ProposalCard
                  key={`${proposal.id}-${proposalFeedRefreshTick}`}
                  proposal={proposal}
                  index={index}
                  userId={userId}
                  compact={false}
                  displayGroupUsers={displayGroupUsers}
                  proposalFeedRefreshTick={proposalFeedRefreshTick}
                  proposalAvailabilities={getProposalAvailabilities(proposal.id)}
                  selectedAlternativeIds={selectedAlternativeIdsByProposal[proposal.id] || {}}
                  toggleAlternativeSelection={toggleAlternativeSelection}
                  proposalThumbnailUrl={proposalThumbnailUrls[proposal.id]}
                  thumbnailGenerating={Boolean(thumbnailGeneratingByProposalId[proposal.id])}
                  thumbnailError={thumbnailErrorByProposalId[proposal.id]}
                  handleGenerateProposalThumbnail={handleGenerateProposalThumbnail}
                  draft={proposalCardDrafts[proposal.id]}
                  setDraft={(updates) => updateProposalCardDraft(proposal.id, updates)}
                  handleSubmitAlternatives={handleSubmitAlternatives}
                  closeSuggestAlternativesModal={closeSuggestAlternativesModal}
                  openSuggestAlternativesModal={openSuggestAlternativesModal}
                  handleAffirmAvailabilityAsProposed={handleAffirmAvailabilityAsProposed}
                  openCalendarPopup={openCalendarPopup}
                  handleAddToCalendar={handleAddToCalendar}
                  commentDraft={commentDraftByProposalId[proposal.id] || ''}
                  setCommentDraft={(draft) =>
                    setCommentDraftByProposalId((prev) => ({ ...prev, [proposal.id]: draft }))
                  }
                  handleAddProposalComment={handleAddProposalComment}
                  userNameById={userNameById}
                />
              ))}
            </div>
          </div>
        )}
        <CalendarModal
          calendarPopup={calendarPopup}
          onClose={() => setCalendarPopup(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {!compact && (
        <p className="text-xs text-gray-600 dark:text-slate-300">What&apos;s Up?</p>
      )}

      <div className="rounded-lg bg-white p-1 dark:bg-slate-900">
        {sortedProposals.length === 0 ? (
          <p className="text-xs text-gray-600 dark:text-slate-300">
            No proposals yet. Use Snooky below to draft one.
          </p>
        ) : (
          <div className="snap-y snap-mandatory space-y-2 pr-0.5">
            {sortedProposals.map((proposal, index) => (
              <ProposalCard
                key={`${proposal.id}-${proposalFeedRefreshTick}`}
                proposal={proposal}
                index={index}
                userId={userId}
                compact
                displayGroupUsers={displayGroupUsers}
                proposalFeedRefreshTick={proposalFeedRefreshTick}
                proposalAvailabilities={getProposalAvailabilities(proposal.id)}
                selectedAlternativeIds={selectedAlternativeIdsByProposal[proposal.id] || {}}
                toggleAlternativeSelection={toggleAlternativeSelection}
                proposalThumbnailUrl={proposalThumbnailUrls[proposal.id]}
                thumbnailGenerating={Boolean(thumbnailGeneratingByProposalId[proposal.id])}
                thumbnailError={thumbnailErrorByProposalId[proposal.id]}
                handleGenerateProposalThumbnail={handleGenerateProposalThumbnail}
                draft={proposalCardDrafts[proposal.id]}
                setDraft={(updates) => updateProposalCardDraft(proposal.id, updates)}
                handleSubmitAlternatives={handleSubmitAlternatives}
                closeSuggestAlternativesModal={closeSuggestAlternativesModal}
                openSuggestAlternativesModal={openSuggestAlternativesModal}
                handleAffirmAvailabilityAsProposed={handleAffirmAvailabilityAsProposed}
                openCalendarPopup={openCalendarPopup}
                handleAddToCalendar={handleAddToCalendar}
                commentDraft={commentDraftByProposalId[proposal.id] || ''}
                setCommentDraft={(draft) =>
                  setCommentDraftByProposalId((prev) => ({ ...prev, [proposal.id]: draft }))
                }
                handleAddProposalComment={handleAddProposalComment}
                userNameById={userNameById}
              />
            ))}
          </div>
        )}
      </div>

      <div className="min-h-[18rem] rounded-lg border border-gray-200 dark:border-slate-700 p-3 space-y-2 bg-gray-50 dark:bg-slate-950">
        {messages.map((message) => (
          <div key={message.id} className="space-y-2">
            <div
              className={`rounded px-3 py-2 text-sm ${message.role === 'user'
                ? 'bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-100'
                : 'bg-white text-gray-800 dark:bg-slate-900 dark:text-slate-100 border border-gray-200 dark:border-slate-700'
                }`}
            >
              <div className="text-[10px] uppercase tracking-wide opacity-70">
                {message.role === 'assistant' ? 'Snooky' : message.role}
              </div>
              <div className="whitespace-pre-wrap break-words">{message.content}</div>
            </div>
            {message.role === 'assistant' && memoryCitationsByMessageId[message.id]?.length > 0 && (
              <div className="rounded border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200">
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide opacity-80">
                  Memory Used (Mock Citation)
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {memoryCitationsByMessageId[message.id].map((record) => (
                    <span
                      key={record.id}
                      className="rounded border border-amber-200 bg-white px-1.5 py-0.5 dark:border-amber-900/40 dark:bg-slate-900"
                      title={typeof record.value.originalText === 'string' ? String(record.value.originalText) : undefined}
                    >
                      {record.status}: {summarizeMemoryRecord(record)}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {message.role === 'assistant' &&
              actionProposalsByMessageId[message.id] &&
              !hiddenActionMessageIds[message.id] && (
                <>
                  {getActionProposalDrafts(actionProposalsByMessageId[message.id]).map((draft, draftIndex, drafts) => {
                    const scopedDraftKey = getScopedDraftKey(message.id, draft.id);
                    const scopedProposal = getScopedActionProposal(
                      actionProposalsByMessageId[message.id],
                      draft,
                      drafts.length
                    );
                    return (
                      <div key={scopedDraftKey} className="space-y-2">
                        {drafts.length > 1 && (
                          <div className="px-1 text-[10px] font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
                            Idea {draftIndex + 1}
                          </div>
                        )}
                        <AiProposalFormCard
                          proposal={scopedProposal}
                          onPropose={(values, proposal) =>
                            handleProposeFromDraft(message.id, scopedDraftKey, proposal, values)
                          }
                          onCancel={draftIndex === drafts.length - 1 ? () => handleCancelAction(message.id) : undefined}
                          isSubmitting={executingActionKey === scopedDraftKey}
                          isCompleted={Boolean(completedActionKeys[scopedDraftKey])}
                        />
                        {completedActionKeys[scopedDraftKey] && (
                          <div className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-200">
                            Proposal created. Next step: either switch to <strong>Workspace</strong> to refine availability/details, or keep using the
                            <strong> Ask Snooky</strong> box to create or refine another idea.
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 dark:border-emerald-900/60 dark:bg-emerald-950/20">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
            Snooky Memory (Local v1)
          </p>
          <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
            source-aware + editable later
          </p>
        </div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleSeedStockholmPersonas}
            className="rounded border border-emerald-300 px-2 py-1 text-[11px] font-medium text-emerald-800 hover:bg-emerald-100 dark:border-emerald-900/70 dark:text-emerald-200 dark:hover:bg-emerald-900/20"
          >
            Seed 5 Stockholm Personas
          </button>
          <button
            type="button"
            onClick={handleClearSeedPersonas}
            className="rounded border border-gray-300 px-2 py-1 text-[11px] text-gray-700 hover:bg-white dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
          >
            Clear Seed Personas
          </button>
          <button
            type="button"
            onClick={() => setShowMemoryExplorer((prev) => !prev)}
            className="rounded border border-emerald-300 px-2 py-1 text-[11px] font-medium text-emerald-800 hover:bg-emerald-100 dark:border-emerald-900/70 dark:text-emerald-200 dark:hover:bg-emerald-900/20"
          >
            {showMemoryExplorer ? 'Hide Memory Explorer' : 'Open Memory Explorer'}
          </button>
          <span className="text-[11px] text-emerald-700 dark:text-emerald-300">
            {memoryStore.listForUser(userId, activeGroupId).length} total records
          </span>
        </div>
        {memorySeedStatus && (
          <p className="mb-2 text-[11px] text-emerald-800 dark:text-emerald-300">{memorySeedStatus}</p>
        )}
        {recentMemories.length > 0 ? (
          <div className="space-y-2">
            {recentMemories.map((record) => {
              return (
                <div
                  key={record.id}
                  className="rounded border border-emerald-200 bg-white px-2.5 py-2 text-xs dark:border-emerald-900/50 dark:bg-slate-900"
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                      {record.status}
                    </span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      {record.sourceKind}
                    </span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      {record.durability}
                    </span>
                  </div>
                  <p className="mt-1 text-gray-700 dark:text-slate-200">{summarizeMemoryRecord(record)}</p>
                  {editingMemoryId === record.id ? (
                    <div className="mt-2 space-y-2">
                      <label className="block text-[11px] text-gray-600 dark:text-slate-300">
                        Note
                        <input
                          type="text"
                          value={memoryNoteDraft}
                          onChange={(e) => setMemoryNoteDraft(e.target.value)}
                          placeholder="Optional context (e.g. traveling)"
                          className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                        />
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleSaveMemoryNote(record)}
                          className="rounded bg-emerald-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-emerald-700"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingMemoryId(null);
                            setMemoryNoteDraft('');
                          }}
                          className="rounded border border-gray-300 px-2 py-1 text-[11px] text-gray-700 dark:border-slate-600 dark:text-slate-200"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {typeof record.value.note === 'string' && record.value.note.trim() && (
                        <p className="mt-1 text-[11px] text-gray-600 dark:text-slate-300">
                          Note: {record.value.note.trim()}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {record.status !== 'confirmed' && (
                          <button
                            type="button"
                            onClick={() => handleConfirmMemory(record.id)}
                            className="rounded bg-emerald-600 px-2 py-1 text-[11px] font-medium text-white hover:bg-emerald-700"
                          >
                            Confirm
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleStartEditMemory(record)}
                          className="rounded border border-gray-300 px-2 py-1 text-[11px] text-gray-700 dark:border-slate-600 dark:text-slate-200"
                        >
                          Edit Note
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDismissMemory(record.id)}
                          className="rounded border border-red-200 px-2 py-1 text-[11px] text-red-700 dark:border-red-900/60 dark:text-red-300"
                        >
                          Dismiss
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-emerald-800/90 dark:text-emerald-300">
            No local memory records yet. Use the seed button or tell Snooky something like
            "I&apos;m free after 7pm on Tuesdays."
          </p>
        )}
        {showMemoryExplorer && (
          <MemoryExplorer activeGroupId={activeGroupId} summarizeMemoryRecord={summarizeMemoryRecord} />
        )}
      </div>

      <details className="rounded-lg border border-gray-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
        <summary className="cursor-pointer text-sm font-medium text-gray-800 dark:text-slate-100">
          Testing Prompts (v1)
        </summary>
        <div className="mt-2 space-y-2 text-xs text-gray-700 dark:text-slate-200">
          <p className="text-gray-600 dark:text-slate-300">
            Use these after clicking <strong>Seed 5 Stockholm Personas</strong>.
          </p>
          {[
            'Any ideas for a casual group dinner in Stockholm next week?',
            "Who seems available on Thursdays after 6:30pm?",
            'What should we keep in mind before proposing a weeknight meetup?',
            "I can't do Wednesdays in person this month.",
            "I'm free after 7pm on Tuesdays.",
            'Do you remember any group budget preferences for dinner?',
          ].map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => setInput(prompt)}
              className="block w-full rounded border border-gray-200 bg-gray-50 px-2 py-1.5 text-left hover:bg-gray-100 dark:border-slate-700 dark:bg-slate-950 dark:hover:bg-slate-800"
            >
              {prompt}
            </button>
          ))}
        </div>
      </details>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700 dark:border-red-900 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask Snooky..."
          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100"
        />
        <button
          type="submit"
          disabled={isLoading || input.trim().length === 0}
          className="px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Asking...' : 'Ask'}
        </button>
      </form>
    </div>
  );
}

