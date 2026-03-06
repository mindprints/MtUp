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
import type { AiActionProposal, AiMessage, Availability, MemoryRecord, Proposal } from '@/types';
import { AiProposalFormCard, type AiProposalFormValues } from '@/components/AiProposalFormCard';
import { MemoryExplorer } from '@/components/ai-assistant/MemoryExplorer';
import { CalendarModal, type CalendarPopupState } from '@/components/ai-assistant/CalendarModal';
import { ProposalFlowEditor } from '@/components/ai-assistant/ProposalFlowEditor';
import { ProposalCard } from '@/components/ai-assistant/ProposalCard';
import {
  ProposalCardDrafts,
  ProposalFlowEditDraft,
  parseIsoDatesFromText,
  parseDateRangeFromText,
  formatDateRangeText,
  formatTo24HourTimeText,
  buildProposalFlowEditDraft,
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
  place: string;
};

type PendingAlternativeSuggestion = {
  id: string;
  dateText: string;
  timeText: string;
  placeText: string;
};

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
  const [executingActionMessageId, setExecutingActionMessageId] = useState<string | null>(null);
  const [completedActionMessageIds, setCompletedActionMessageIds] = useState<Record<string, boolean>>(
    {}
  );
  const [proposalFlowDraftValuesByMessageId, setProposalFlowDraftValuesByMessageId] = useState<
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
  const [proposalFlowEditDrafts, setProposalFlowEditDrafts] = useState<
    Record<string, ProposalFlowEditDraft>
  >({});
  const [proposalFlowSavingById, setProposalFlowSavingById] = useState<Record<string, boolean>>({});
  const [proposalFlowAlternativeDraftsByMessageId, setProposalFlowAlternativeDraftsByMessageId] =
    useState<Record<string, ProposalFlowAlternativeDraft>>({});
  const [pendingAlternativeSuggestionsByMessageId, setPendingAlternativeSuggestionsByMessageId] =
    useState<Record<string, PendingAlternativeSuggestion[]>>({});
  const [proposalFlowEditorUserId, setProposalFlowEditorUserId] = useState<string>(userId);
  const [proposalFlowEditorProposalId, setProposalFlowEditorProposalId] = useState<string | null>(null);
  const [isProposalFlowEditorOpen, setIsProposalFlowEditorOpen] = useState(false);
  const [commentDraftByProposalId, setCommentDraftByProposalId] = useState<Record<string, string>>({});
  const [editorAlternativeDraftByProposalId, setEditorAlternativeDraftByProposalId] = useState<
    Record<string, ProposalFlowAlternativeDraft>
  >({});

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

  useEffect(() => {
    if (!proposalFlow) return;
    const myProposals = proposals.filter((proposal) => proposal.createdBy === userId);
    setProposalFlowEditDrafts((prev) => {
      const next = { ...prev };
      let changed = false;
      myProposals.forEach((proposal) => {
        if (!next[proposal.id]) {
          next[proposal.id] = buildProposalFlowEditDraft(proposal);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [proposalFlow, proposals, userId]);

  const syncProposalFlowSelection = () => {
    if (!proposalFlow) return;
    const isAdmin = groupUsers.some((member) => member.id === userId && member.isAdmin);
    const availableUserIds = new Set<string>(
      isAdmin ? [userId, ...groupUsers.map((member) => member.id)] : [userId]
    );
    const hasSelectedUser = availableUserIds.has(proposalFlowEditorUserId);
    const nextUserId = hasSelectedUser ? proposalFlowEditorUserId : userId;
    if (nextUserId !== proposalFlowEditorUserId) {
      setProposalFlowEditorUserId(nextUserId);
      return;
    }

    const proposalsForSelectedUser = proposals
      .filter((proposal) => proposal.createdBy === nextUserId)
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (proposalsForSelectedUser.length === 0) {
      if (proposalFlowEditorProposalId !== null) {
        setProposalFlowEditorProposalId(null);
      }
      return;
    }
    if (!proposalFlowEditorProposalId) {
      setProposalFlowEditorProposalId(proposalsForSelectedUser[0].id);
      return;
    }
    const exists = proposalsForSelectedUser.some(
      (proposal) => proposal.id === proposalFlowEditorProposalId
    );
    if (!exists) {
      setProposalFlowEditorProposalId(proposalsForSelectedUser[0].id);
    }
  };

  useEffect(() => {
    syncProposalFlowSelection();
  }, [
    proposalFlow,
    proposals,
    proposalFlowEditorUserId,
    proposalFlowEditorProposalId,
    groupUsers,
    userId,
  ]);

  const handleProposeFromDraft = async (
    messageId: string,
    proposal: AiActionProposal,
    formValues: AiProposalFormValues
  ) => {
    if (executingActionMessageId) return;
    if (proposal.payload?.kind !== 'create_proposal') {
      setError('Unsupported AI action payload');
      return;
    }

    setError(null);
    setExecutingActionMessageId(messageId);

    try {
      const draft = proposal.payload.proposalDraft;
      const dateValue = formValues.dates.trim();
      const timeValue = formValues.times.trim();
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
          ...(timeValue ? { time: timeValue } : {}),
          ...(placeValue ? { location: placeValue } : {}),
          ...(requirementsValue ? { requirements: requirementsValue } : {}),
        },
        ...(createdComments.length > 0 ? { comments: createdComments } : {}),
      };

      addProposal(createdProposal);
      proposalThreadStore.addImplicitProposerAffirmation(createdProposal);
      const pendingAlternatives = pendingAlternativeSuggestionsByMessageId[messageId] || [];
      let nextAvailability = getAvailability(userId, createdProposal.id);
      pendingAlternatives.forEach((suggestion) => {
        if (suggestion.dateText) {
          const { impliedDates } = proposalThreadStore.addDateFieldChange(
            createdProposal.id,
            userId,
            suggestion.dateText
          );
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
          proposalThreadStore.addFieldChange(createdProposal.id, userId, 'time', suggestion.timeText);
        }
        if (suggestion.placeText) {
          proposalThreadStore.addFieldChange(createdProposal.id, userId, 'place', suggestion.placeText);
        }
      });
      if (nextAvailability) {
        setAvailability(nextAvailability);
      }
      setProposalFeedRefreshTick((tick) => tick + 1);
      if (canGenerateProposalThumbnail()) {
        void handleGenerateProposalThumbnail(createdProposal);
      }
      setPendingAlternativeSuggestionsByMessageId((prev) => ({
        ...prev,
        [messageId]: [],
      }));
      setProposalFlowAlternativeDraftsByMessageId((prev) => ({
        ...prev,
        [messageId]: {
          startDate: '',
          endDate: '',
          time: '',
          place: '',
        },
      }));
      setCompletedActionMessageIds((prev) => ({ ...prev, [messageId]: true }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to execute AI action');
    } finally {
      setExecutingActionMessageId(null);
    }
  };

  const handleCancelAction = (messageId: string) => {
    setHiddenActionMessageIds((prev) => ({ ...prev, [messageId]: true }));
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
      proposalThreadStore.addExplicitAffirmation(proposal.id, userId);
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
    const previous = proposalCardDrafts[proposalId];
    const parsed = parseDateRangeFromText(previous?.dateSuggestion || '');
    setProposalCardDrafts((prev) => ({
      ...prev,
      [proposalId]: {
        dateSuggestion: previous?.dateSuggestion || '',
        startDateSuggestion: previous?.startDateSuggestion || parsed.startDate,
        endDateSuggestion: previous?.endDateSuggestion || parsed.endDate,
        timeSuggestion: previous?.timeSuggestion || '',
        placeSuggestion: previous?.placeSuggestion || '',
        isSuggestModalOpen: true,
      },
    }));
  };

  const closeSuggestAlternativesModal = (proposalId: string) => {
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
        timeSuggestion: prev[proposalId]?.timeSuggestion || '',
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
          placeSuggestion: '',
        }),
        ...updates,
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
    const timeText = draft.timeSuggestion.trim();
    const placeText = draft.placeSuggestion.trim();
    if (!dateText && !timeText && !placeText) return;

    if (dateText) {
      const { impliedDates } = proposalThreadStore.addDateFieldChange(proposal.id, userId, dateText);
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
      proposalThreadStore.addFieldChange(proposal.id, userId, 'time', timeText);
    }
    if (placeText) {
      proposalThreadStore.addFieldChange(proposal.id, userId, 'place', placeText);
    }

    setProposalCardDrafts((prev) => ({
      ...prev,
      [proposal.id]: {
        dateSuggestion: '',
        startDateSuggestion: '',
        endDateSuggestion: '',
        timeSuggestion: '',
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
    messageId: string,
    key: keyof ProposalFlowAlternativeDraft,
    value: string
  ) => {
    setProposalFlowAlternativeDraftsByMessageId((prev) => ({
      ...prev,
      [messageId]: {
        ...(prev[messageId] || {
          startDate: '',
          endDate: '',
          time: '',
          place: '',
        }),
        [key]: value,
      },
    }));
  };

  const addPendingAlternativeSuggestion = (messageId: string) => {
    const draft = proposalFlowAlternativeDraftsByMessageId[messageId] || {
      startDate: '',
      endDate: '',
      time: '',
      place: '',
    };
    const dateText = formatDateRangeText(draft.startDate.trim(), draft.endDate.trim());
    const timeText = draft.time.trim();
    const placeText = draft.place.trim();
    if (!dateText && !timeText && !placeText) return;

    const nextSuggestion: PendingAlternativeSuggestion = {
      id: generateId(),
      dateText,
      timeText,
      placeText,
    };

    setPendingAlternativeSuggestionsByMessageId((prev) => ({
      ...prev,
      [messageId]: [...(prev[messageId] || []), nextSuggestion],
    }));
    setProposalFlowAlternativeDraftsByMessageId((prev) => ({
      ...prev,
      [messageId]: {
        startDate: '',
        endDate: '',
        time: '',
        place: '',
      },
    }));
  };

  const removePendingAlternativeSuggestion = (messageId: string, suggestionId: string) => {
    setPendingAlternativeSuggestionsByMessageId((prev) => ({
      ...prev,
      [messageId]: (prev[messageId] || []).filter((entry) => entry.id !== suggestionId),
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

  const updateEditorAlternativeDraftField = (
    proposalId: string,
    key: keyof ProposalFlowAlternativeDraft,
    value: string
  ) => {
    setEditorAlternativeDraftByProposalId((prev) => ({
      ...prev,
      [proposalId]: {
        ...(prev[proposalId] || {
          startDate: '',
          endDate: '',
          time: '',
          place: '',
        }),
        [key]: value,
      },
    }));
  };

  const handleSubmitEditorAlternative = (proposal: Proposal) => {
    const draft = editorAlternativeDraftByProposalId[proposal.id] || {
      startDate: '',
      endDate: '',
      time: '',
      place: '',
    };
    const dateText = formatDateRangeText(
      draft.startDate.trim(),
      proposal.type === 'sejour' ? draft.endDate.trim() : draft.startDate.trim()
    );
    const timeText = draft.time.trim();
    const placeText = draft.place.trim();
    if (!dateText && !timeText && !placeText) return;

    if (dateText) {
      const { impliedDates } = proposalThreadStore.addDateFieldChange(proposal.id, userId, dateText);
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
    if (timeText) proposalThreadStore.addFieldChange(proposal.id, userId, 'time', timeText);
    if (placeText) proposalThreadStore.addFieldChange(proposal.id, userId, 'place', placeText);

    setEditorAlternativeDraftByProposalId((prev) => ({
      ...prev,
      [proposal.id]: { startDate: '', endDate: '', time: '', place: '' },
    }));
    setProposalFeedRefreshTick((tick) => tick + 1);
  };

  const updateProposalFlowEditField = (
    proposalId: string,
    key: keyof ProposalFlowEditDraft,
    value: string
  ) => {
    setProposalFlowEditDrafts((prev) => ({
      ...prev,
      [proposalId]: {
        ...(prev[proposalId] || {
          title: '',
          startDate: '',
          endDate: '',
          time: '',
          place: '',
        }),
        [key]: value,
      },
    }));
  };

  const handleSaveProposalFlowEdit = async (proposal: Proposal) => {
    const draft = proposalFlowEditDrafts[proposal.id] || buildProposalFlowEditDraft(proposal);
    const nextTitle = draft.title.trim();
    if (!nextTitle) {
      setError('Title is required.');
      return;
    }

    const nextSpecifics = { ...(proposal.specifics || {}) };
    const dateText = formatDateRangeText(draft.startDate.trim(), draft.endDate.trim());
    const timeText = draft.time.trim();
    const placeText = draft.place.trim();

    if (dateText) nextSpecifics.date = dateText;
    else delete nextSpecifics.date;
    if (timeText) nextSpecifics.time = timeText;
    else delete nextSpecifics.time;
    if (placeText) nextSpecifics.location = placeText;
    else delete nextSpecifics.location;

    setProposalFlowSavingById((prev) => ({ ...prev, [proposal.id]: true }));
    await updateProposal(proposal.id, {
      title: nextTitle,
      specifics: nextSpecifics,
    });
    setProposalFeedRefreshTick((tick) => tick + 1);
    setProposalFlowSavingById((prev) => ({ ...prev, [proposal.id]: false }));
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
    const parsedTime = parseFirstTime24h(proposal.specifics?.time || '');

    let dtStart = '';
    let dtEnd = '';
    let allDay = false;

    if (parsedTime) {
      startDate.setHours(parsedTime.hour, parsedTime.minute, 0, 0);
      const endDateTime = new Date(startDate.getTime() + 60 * 60 * 1000);
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
      proposal.specifics?.time ? `Time: ${proposal.specifics.time}` : '',
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

  const getInitialDraftValues = (proposal: AiActionProposal): AiProposalFormValues => {
    const draft = proposal.payload?.proposalDraft;
    return {
      title: draft?.title || '',
      dates: draft?.form?.dates || draft?.specifics?.date || '',
      times: draft?.form?.times || draft?.specifics?.time || '',
      invitees: draft?.form?.invitees || 'Everyone in active group',
      place: draft?.form?.place || draft?.specifics?.location || '',
      requirements: draft?.form?.requirements || '',
      comments: draft?.form?.comments || '',
    };
  };

  const updateProposalFlowDraftField = (
    messageId: string,
    proposal: AiActionProposal,
    key: keyof AiProposalFormValues,
    value: string
  ) => {
    setProposalFlowDraftValuesByMessageId((prev) => ({
      ...prev,
      [messageId]: {
        ...((prev[messageId] || getInitialDraftValues(proposal)) as AiProposalFormValues),
        [key]: value,
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
  const latestProposalFlowDraftValues =
    latestProposalFlowActionMessageId && latestProposalFlowActionProposal
      ? proposalFlowDraftValuesByMessageId[latestProposalFlowActionMessageId] ||
      getInitialDraftValues(latestProposalFlowActionProposal)
      : null;
  const userNameById = new Map(displayGroupUsers.map((member) => [member.id, member.name]));
  const currentUserIsAdmin = displayGroupUsers.some(
    (member) => member.id === userId && member.isAdmin
  );
  const proposalFlowEditorUsers = currentUserIsAdmin
    ? displayGroupUsers
    : displayGroupUsers.filter((member) => member.id === userId).length > 0
      ? displayGroupUsers.filter((member) => member.id === userId)
      : [{ id: userId, name: userNameById.get(userId) || 'Me', isAdmin: false }];
  const editableProposalsForSelectedUser = proposals
    .filter((proposal) => proposal.createdBy === proposalFlowEditorUserId)
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const selectedEditableProposal = proposalFlowEditorProposalId
    ? editableProposalsForSelectedUser.find(
      (proposal) => proposal.id === proposalFlowEditorProposalId
    ) || null
    : null;
  const canEditSelectedProposal =
    Boolean(selectedEditableProposal) &&
    (currentUserIsAdmin || selectedEditableProposal?.createdBy === userId);
  const showProposalFlowEditorOnly =
    proposalFlow && isProposalFlowEditorOpen && Boolean(selectedEditableProposal);

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
            {!showProposalFlowEditorOnly && (
              <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
                {messages.length > 0 && (
                  <div className="space-y-2">
                    {messages.map((message) => {
                      const draftProposal = actionProposalsByMessageId[message.id];
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
                      const draftValues = draftProposal
                        ? proposalFlowDraftValuesByMessageId[message.id] || getInitialDraftValues(draftProposal)
                        : null;
                      const draftDateRange = draftValues
                        ? parseDateRangeFromText(draftValues.dates)
                        : { startDate: '', endDate: '' };
                      const isSejourDraft = draftProposal?.payload?.proposalDraft?.type === 'sejour';
                      const alternativeDraft = proposalFlowAlternativeDraftsByMessageId[message.id] || {
                        startDate: '',
                        endDate: '',
                        time: '',
                        place: '',
                      };
                      const pendingAlternatives =
                        pendingAlternativeSuggestionsByMessageId[message.id] || [];
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
                              {draftProposal && draftValues && (
                                <div className="mt-1 space-y-1.5">
                                  <input
                                    type="text"
                                    value={draftValues.title}
                                    onChange={(e) =>
                                      updateProposalFlowDraftField(
                                        message.id,
                                        draftProposal,
                                        'title',
                                        e.target.value
                                      )
                                    }
                                    placeholder="Title"
                                    className="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-xs text-gray-900 dark:border-sky-900/60 dark:bg-slate-900 dark:text-slate-100"
                                  />
                                  <div className={`grid grid-cols-1 gap-1.5 ${isSejourDraft ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
                                    {isSejourDraft ? (
                                      <>
                                        <input
                                          type="date"
                                          value={draftDateRange.startDate}
                                          onChange={(e) =>
                                            updateProposalFlowDraftField(
                                              message.id,
                                              draftProposal,
                                              'dates',
                                              formatDateRangeText(
                                                e.target.value,
                                                draftDateRange.endDate
                                              )
                                            )
                                          }
                                          aria-label="Start date"
                                          className="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-xs text-gray-900 dark:border-sky-900/60 dark:bg-slate-900 dark:text-slate-100 dark:[color-scheme:dark]"
                                        />
                                        <input
                                          type="date"
                                          value={draftDateRange.endDate}
                                          min={draftDateRange.startDate || undefined}
                                          onChange={(e) =>
                                            updateProposalFlowDraftField(
                                              message.id,
                                              draftProposal,
                                              'dates',
                                              formatDateRangeText(
                                                draftDateRange.startDate,
                                                e.target.value
                                              )
                                            )
                                          }
                                          aria-label="End date"
                                          className="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-xs text-gray-900 dark:border-sky-900/60 dark:bg-slate-900 dark:text-slate-100 dark:[color-scheme:dark]"
                                        />
                                      </>
                                    ) : (
                                      <input
                                        type="date"
                                        value={draftDateRange.startDate}
                                        onChange={(e) =>
                                          updateProposalFlowDraftField(
                                            message.id,
                                            draftProposal,
                                            'dates',
                                            e.target.value
                                          )
                                        }
                                        aria-label="Date"
                                        className="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-xs text-gray-900 dark:border-sky-900/60 dark:bg-slate-900 dark:text-slate-100 dark:[color-scheme:dark]"
                                      />
                                    )}
                                    <input
                                      type="time"
                                      value={
                                        /^\d{2}:\d{2}$/.test(draftValues.times.trim())
                                          ? draftValues.times.trim()
                                          : ''
                                      }
                                      step={900}
                                      onChange={(e) =>
                                        updateProposalFlowDraftField(
                                          message.id,
                                          draftProposal,
                                          'times',
                                          e.target.value
                                        )
                                      }
                                      aria-label="Time"
                                      className="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-xs text-gray-900 dark:border-sky-900/60 dark:bg-slate-900 dark:text-slate-100 dark:[color-scheme:dark]"
                                    />
                                  </div>
                                  <textarea
                                    value={draftValues.invitees}
                                    onChange={(e) =>
                                      updateProposalFlowDraftField(
                                        message.id,
                                        draftProposal,
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
                                        message.id,
                                        draftProposal,
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
                                        message.id,
                                        draftProposal,
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
                                        message.id,
                                        draftProposal,
                                        'comments',
                                        e.target.value
                                      )
                                    }
                                    rows={2}
                                    placeholder="Comments"
                                    className="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-xs text-gray-900 dark:border-sky-900/60 dark:bg-slate-900 dark:text-slate-100"
                                  />
                                  <div className="rounded border border-sky-300 bg-white p-2 text-xs text-gray-900 dark:border-sky-900/60 dark:bg-slate-900 dark:text-slate-100">
                                    <p className="font-semibold text-sky-900 dark:text-sky-200">
                                      Add alternative suggestions before confirming
                                    </p>
                                    <div className={`mt-1 grid grid-cols-1 gap-1.5 ${isSejourDraft ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}>
                                      {isSejourDraft ? (
                                        <>
                                          <input
                                            type="date"
                                            value={alternativeDraft.startDate}
                                            onChange={(e) =>
                                              updateProposalFlowAlternativeDraft(
                                                message.id,
                                                'startDate',
                                                e.target.value
                                              )
                                            }
                                            aria-label="Alternative start date"
                                            className="rounded border border-sky-300 bg-white px-2 py-1.5 text-xs dark:border-sky-900/60 dark:bg-slate-900 dark:[color-scheme:dark]"
                                          />
                                          <input
                                            type="date"
                                            value={alternativeDraft.endDate}
                                            min={alternativeDraft.startDate || undefined}
                                            onChange={(e) =>
                                              updateProposalFlowAlternativeDraft(
                                                message.id,
                                                'endDate',
                                                e.target.value
                                              )
                                            }
                                            aria-label="Alternative end date"
                                            className="rounded border border-sky-300 bg-white px-2 py-1.5 text-xs dark:border-sky-900/60 dark:bg-slate-900 dark:[color-scheme:dark]"
                                          />
                                        </>
                                      ) : (
                                        <input
                                          type="date"
                                          value={alternativeDraft.startDate}
                                          onChange={(e) => {
                                            updateProposalFlowAlternativeDraft(
                                              message.id,
                                              'startDate',
                                              e.target.value
                                            );
                                            updateProposalFlowAlternativeDraft(
                                              message.id,
                                              'endDate',
                                              e.target.value
                                            );
                                          }}
                                          aria-label="Alternative date"
                                          className="rounded border border-sky-300 bg-white px-2 py-1.5 text-xs dark:border-sky-900/60 dark:bg-slate-900 dark:[color-scheme:dark]"
                                        />
                                      )}
                                      <input
                                        type="time"
                                        value={alternativeDraft.time}
                                        step={900}
                                        onChange={(e) =>
                                          updateProposalFlowAlternativeDraft(
                                            message.id,
                                            'time',
                                            e.target.value
                                          )
                                        }
                                        aria-label="Alternative time"
                                        className="rounded border border-sky-300 bg-white px-2 py-1.5 text-xs dark:border-sky-900/60 dark:bg-slate-900 dark:[color-scheme:dark]"
                                      />
                                      <input
                                        type="text"
                                        value={alternativeDraft.place}
                                        onChange={(e) =>
                                          updateProposalFlowAlternativeDraft(
                                            message.id,
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
                                        onClick={() => addPendingAlternativeSuggestion(message.id)}
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
                                                removePendingAlternativeSuggestion(message.id, entry.id)
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
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
            <div className="rounded-lg border border-indigo-200 bg-indigo-50/60 p-2 dark:border-indigo-900/50 dark:bg-indigo-950/20">
              <div className="flex flex-wrap items-center gap-2">
                {currentUserIsAdmin ? (
                  <select
                    value={proposalFlowEditorUserId}
                    onChange={(e) => {
                      setProposalFlowEditorUserId(e.target.value);
                      setIsProposalFlowEditorOpen(false);
                    }}
                    className="rounded border border-indigo-300 bg-white px-2 py-1.5 text-xs text-gray-900 dark:border-indigo-900/70 dark:bg-slate-900 dark:text-slate-100"
                  >
                    {proposalFlowEditorUsers.map((member) => (
                      <option key={`proposal-flow-editor-user-${member.id}`} value={member.id}>
                        {member.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="rounded border border-indigo-300 bg-white px-2 py-1.5 text-xs text-indigo-800 dark:border-indigo-900/70 dark:bg-slate-900 dark:text-indigo-200">
                    {userNameById.get(userId) || 'My activities'}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setIsProposalFlowEditorOpen((prev) => !prev)}
                  disabled={editableProposalsForSelectedUser.length === 0}
                  className="rounded bg-indigo-700 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isProposalFlowEditorOpen ? 'Hide Activity Editor' : 'Open Activity Editor'}
                </button>
                {showProposalFlowEditorOnly && (
                  <button
                    type="button"
                    onClick={() => setIsProposalFlowEditorOpen(false)}
                    className="rounded border border-indigo-300 bg-white px-2.5 py-1.5 text-xs text-indigo-800 dark:border-indigo-900/70 dark:bg-slate-900 dark:text-indigo-200"
                  >
                    Back To Snooky
                  </button>
                )}
                {editableProposalsForSelectedUser.length === 0 && (
                  <span className="text-[11px] text-indigo-700 dark:text-indigo-300">
                    No activities for selected user.
                  </span>
                )}
              </div>

              {isProposalFlowEditorOpen && selectedEditableProposal && (
                <div className="mt-2 space-y-2 rounded border border-indigo-200 bg-white p-2 dark:border-indigo-900/60 dark:bg-slate-900">
                  <select
                    value={proposalFlowEditorProposalId || ''}
                    onChange={(e) => setProposalFlowEditorProposalId(e.target.value || null)}
                    className="w-full rounded border border-indigo-300 bg-white px-2 py-1.5 text-xs text-gray-900 dark:border-indigo-900/70 dark:bg-slate-900 dark:text-slate-100"
                  >
                    {editableProposalsForSelectedUser.map((proposal) => (
                      <option key={`proposal-flow-editor-proposal-${proposal.id}`} value={proposal.id}>
                        {proposal.title}
                      </option>
                    ))}
                  </select>
                  {(() => {
                    const proposal = selectedEditableProposal;

                    return (
                      <ProposalFlowEditor
                        selectedEditableProposal={proposal}
                        proposalFlowEditDrafts={proposalFlowEditDrafts}
                        userId={userId}
                        userNameById={userNameById}
                        updateProposalFlowEditField={updateProposalFlowEditField}
                        canEditSelectedProposal={canEditSelectedProposal}
                        editorAlternativeDraftByProposalId={editorAlternativeDraftByProposalId}
                        updateEditorAlternativeDraftField={updateEditorAlternativeDraftField}
                        handleSubmitEditorAlternative={handleSubmitEditorAlternative}
                        commentDraftByProposalId={commentDraftByProposalId}
                        setCommentDraftByProposalId={setCommentDraftByProposalId}
                        handleAddProposalComment={handleAddProposalComment}
                        proposalFlowSavingById={proposalFlowSavingById}
                        handleSaveProposalFlowEdit={handleSaveProposalFlowEdit}
                      />
                    );
                  })()}
                </div>
              )}
            </div>
            {!showProposalFlowEditorOnly && (
              <div className="shrink-0 rounded-lg border border-gray-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
                <div className="flex items-center gap-2">
                  {latestProposalFlowActionMessageId &&
                    latestProposalFlowActionProposal &&
                    latestProposalFlowDraftValues && (
                      <button
                        type="button"
                        onClick={() =>
                          handleProposeFromDraft(
                            latestProposalFlowActionMessageId,
                            latestProposalFlowActionProposal,
                            latestProposalFlowDraftValues
                          )
                        }
                        disabled={
                          executingActionMessageId === latestProposalFlowActionMessageId ||
                          Boolean(completedActionMessageIds[latestProposalFlowActionMessageId]) ||
                          latestProposalFlowDraftValues.title.trim().length === 0
                        }
                        className="rounded bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {completedActionMessageIds[latestProposalFlowActionMessageId]
                          ? 'Confirmed'
                          : executingActionMessageId === latestProposalFlowActionMessageId
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
            )}
          </div>
        ) : sortedProposals.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-lg bg-white p-3 text-xs text-gray-600 dark:bg-slate-900 dark:text-slate-300">
            No proposals yet. Use Snooky below to draft one.
          </div>
        ) : (
          <div className="hide-scrollbar min-h-0 flex-1 snap-y snap-mandatory overflow-y-auto">
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
                  <AiProposalFormCard
                    proposal={actionProposalsByMessageId[message.id]}
                    onPropose={(values, proposal) => handleProposeFromDraft(message.id, proposal, values)}
                    onCancel={() => handleCancelAction(message.id)}
                    isSubmitting={executingActionMessageId === message.id}
                    isCompleted={Boolean(completedActionMessageIds[message.id])}
                  />
                  {completedActionMessageIds[message.id] && (
                    <div className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-200">
                      Proposal created. Next step: either switch to <strong>Workspace</strong> to refine availability/details, or keep using the
                      <strong> Ask Snooky</strong> box to create or refine another idea.
                    </div>
                  )}
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
