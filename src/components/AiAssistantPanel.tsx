import { FormEvent, useEffect, useState } from 'react';
import { sendAiMessage } from '@/lib/aiClient';
import { memoryStore } from '@/lib/memoryStore';
import { buildStockholmSeedMemoryRecords } from '@/lib/memorySeeds';
import { proposalThreadStore } from '@/lib/proposalThreadStore';
import { proposalThumbnailStore } from '@/lib/proposalThumbnailStore';
import {
  canGenerateProposalThumbnail,
  generateProposalThumbnail,
  getThumbnailGeneratorDebugState,
} from '@/lib/thumbnailGenerator';
import { useProposals } from '@/lib/ProposalContext';
import { generateId } from '@/lib/utils';
import type { AiActionProposal, AiMessage, Availability, MemoryRecord, Proposal } from '@/types';
import { AiProposalFormCard, type AiProposalFormValues } from '@/components/AiProposalFormCard';
import { Modal } from '@/components/Modal';

type AiAssistantPanelProps = {
  userId: string;
  activeGroupId: string | null;
  compact?: boolean;
  showInlineChatbox?: boolean;
  proposalFlow?: boolean;
  onProposalFlowGoActivities?: () => void;
};

type MemoryStatusFilter = MemoryRecord['status'] | 'all';
type MemoryTypeFilter = 'all' | 'availability_';
type ProposalCardDrafts = Record<
  string,
  {
    dateSuggestion: string;
    timeSuggestion: string;
    placeSuggestion: string;
    isSuggestModalOpen?: boolean;
  }
>;

const EXPECTED_GROUP_MEMBER_NAMES = ['Alice', 'Bob', 'Charlie', 'Denise', 'Eve'] as const;

type CalendarPopupState = {
  proposalId: string;
  proposalTitle: string;
  anchorMonthIso: string;
  originalDates: string[];
  alternativeDates: string[];
};

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function parseIsoDatesFromText(input: string): string[] {
  const trimmed = input.trim();
  if (!trimmed) return [];
  const rangeMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})\s+to\s+(\d{4}-\d{2}-\d{2})$/i);
  if (rangeMatch) {
    const start = new Date(`${rangeMatch[1]}T00:00:00Z`);
    const end = new Date(`${rangeMatch[2]}T00:00:00Z`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];
    const out: string[] = [];
    const cursor = new Date(start);
    while (cursor <= end && out.length < 62) {
      out.push(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return out;
  }
  const dates = trimmed.match(/\d{4}-\d{2}-\d{2}/g);
  return dates ? Array.from(new Set(dates)) : [];
}

function formatTo24HourTimeText(input: string): string {
  if (!input.trim()) return input;
  return input.replace(/\b(\d{1,2})(?::(\d{2}))?\s*([ap])(?:\.?m\.?)?\b/gi, (_, h, m, meridiem) => {
    const rawHour = Number(h);
    if (Number.isNaN(rawHour) || rawHour < 1 || rawHour > 12) return _;
    const minute = typeof m === 'string' ? m : '00';
    const normalizedHour =
      meridiem.toLowerCase() === 'p' ? (rawHour % 12) + 12 : rawHour % 12;
    return `${String(normalizedHour).padStart(2, '0')}:${minute}`;
  });
}

function formatIsoMonthLabel(anchorIso: string): string {
  const [yearText, monthText] = anchorIso.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  if (!year || !month) return anchorIso;
  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  return `${monthNames[month - 1]} ${year}`;
}

function buildMonthCells(anchorIso: string): Array<{ iso: string | null; day: number | null }> {
  const [yearText, monthText] = anchorIso.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  if (!year || !month) return [];

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const leadingBlanks = (firstWeekday + 6) % 7; // Monday-first grid

  const cells: Array<{ iso: string | null; day: number | null }> = [];
  for (let i = 0; i < leadingBlanks; i += 1) {
    cells.push({ iso: null, day: null });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    cells.push({ iso, day });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ iso: null, day: null });
  }
  return cells;
}

function formatProposalBaseline(proposal: Proposal): string {
  const parts = [
    proposal.specifics?.date ? `Date: ${proposal.specifics.date}` : null,
    proposal.specifics?.time ? `Time: ${proposal.specifics.time}` : null,
    proposal.specifics?.location ? `Place: ${proposal.specifics.location}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' | ') : 'No logistics set yet';
}

function proposalCardTheme(index: number) {
  const themes = [
    {
      shell:
        'border-rose-200 bg-rose-50/80 dark:border-rose-900/40 dark:bg-rose-950/10',
      tile:
        'border-rose-200 bg-white text-rose-800 dark:border-rose-900/40 dark:bg-slate-900 dark:text-rose-200',
      accent: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-200',
    },
    {
      shell:
        'border-sky-200 bg-sky-50/80 dark:border-sky-900/40 dark:bg-sky-950/10',
      tile:
        'border-sky-200 bg-white text-sky-800 dark:border-sky-900/40 dark:bg-slate-900 dark:text-sky-200',
      accent: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-200',
    },
    {
      shell:
        'border-amber-200 bg-amber-50/80 dark:border-amber-900/40 dark:bg-amber-950/10',
      tile:
        'border-amber-200 bg-white text-amber-800 dark:border-amber-900/40 dark:bg-slate-900 dark:text-amber-200',
      accent: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200',
    },
    {
      shell:
        'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/40 dark:bg-emerald-950/10',
      tile:
        'border-emerald-200 bg-white text-emerald-800 dark:border-emerald-900/40 dark:bg-slate-900 dark:text-emerald-200',
      accent: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200',
    },
  ] as const;
  return themes[index % themes.length];
}

function ProposalFlag({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'good' | 'warm' | 'info';
}) {
  const toneClass =
    tone === 'good'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-200'
      : tone === 'warm'
        ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200'
        : tone === 'info'
          ? 'border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900/50 dark:bg-sky-950/20 dark:text-sky-200'
          : 'border-gray-200 bg-white text-gray-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200';
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] ${toneClass}`}>{label}</span>
  );
}

function userInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('');
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
  const { addProposal, proposals, groupUsers, getProposalAvailabilities, getAvailability, setAvailability } =
    useProposals();
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
  const [memoryStatusFilter, setMemoryStatusFilter] = useState<MemoryStatusFilter>('all');
  const [memoryTypeFilter, setMemoryTypeFilter] = useState<MemoryTypeFilter>('all');
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
        createdAt,
        status: 'proposed',
        specifics: {
          ...(dateValue ? { date: dateValue } : {}),
          ...(timeValue ? { time: timeValue } : {}),
          ...(placeValue ? { location: placeValue } : {}),
        },
        ...(createdComments.length > 0 ? { comments: createdComments } : {}),
      };

      addProposal(createdProposal);
      proposalThreadStore.addImplicitProposerAffirmation(createdProposal);
      setProposalFeedRefreshTick((tick) => tick + 1);
      if (canGenerateProposalThumbnail()) {
        void handleGenerateProposalThumbnail(createdProposal);
      }

      const confirmationMessage: AiMessage = {
        id: generateId(),
        role: 'assistant',
        content:
          `Created proposal "${createdProposal.title}"` +
          `${createdProposal.specifics?.date ? ` for ${createdProposal.specifics.date}` : ''}. ` +
          `Invitees: ${formValues.invitees || 'Everyone in active group'}.` +
          `${formValues.requirements ? ` Requirements: ${formValues.requirements}.` : ''}` +
          `${formValues.comments ? ` Comments: ${formValues.comments}.` : ''}`,
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, confirmationMessage]);
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
  const allMemoryRecords = memoryStore.listForGroupFiltered(activeGroupId, {
    status: memoryStatusFilter,
    factTypePrefix: memoryTypeFilter,
  });

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
    setProposalCardDrafts((prev) => ({
      ...prev,
      [proposalId]: {
        dateSuggestion: prev[proposalId]?.dateSuggestion || '',
        timeSuggestion: prev[proposalId]?.timeSuggestion || '',
        placeSuggestion: prev[proposalId]?.placeSuggestion || '',
        isSuggestModalOpen: true,
      },
    }));
  };

  const closeSuggestAlternativesModal = (proposalId: string) => {
    setProposalCardDrafts((prev) => ({
      ...prev,
      [proposalId]: {
        dateSuggestion: prev[proposalId]?.dateSuggestion || '',
        timeSuggestion: prev[proposalId]?.timeSuggestion || '',
        placeSuggestion: prev[proposalId]?.placeSuggestion || '',
        isSuggestModalOpen: false,
      },
    }));
  };

  const handleSubmitAlternatives = (proposal: Proposal) => {
    const draft = proposalCardDrafts[proposal.id];
    if (!draft) return;
    const dateText = draft.dateSuggestion.trim();
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
  const thumbnailDebug = getThumbnailGeneratorDebugState();
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
            <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
              {messages.length > 0 && (
                <div className="space-y-2">
                  {messages.map((message) => {
                    const draftProposal = actionProposalsByMessageId[message.id];
                    const shouldShowDraftDetails =
                      message.role === 'assistant' &&
                      Boolean(draftProposal) &&
                      !hiddenActionMessageIds[message.id];
                    const draftValues = draftProposal
                      ? proposalFlowDraftValuesByMessageId[message.id] || getInitialDraftValues(draftProposal)
                      : null;
                    return (
                      <div key={message.id} className="space-y-1.5">
                        <div
                          className={`rounded px-3 py-2 text-sm ${
                            message.role === 'user'
                              ? 'bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-100'
                              : 'border border-gray-200 bg-white text-gray-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100'
                          }`}
                        >
                          <div className="text-[10px] uppercase tracking-wide opacity-70">
                            {message.role === 'assistant' ? 'Snooky' : message.role}
                          </div>
                          <div className="whitespace-pre-wrap break-words">{message.content}</div>
                        </div>
                        {shouldShowDraftDetails && (
                          <div className="rounded border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900 dark:border-sky-900/50 dark:bg-sky-950/20 dark:text-sky-200">
                            <p className="text-[10px] font-semibold uppercase tracking-wide opacity-80">
                              Drafted details
                            </p>
                            <p className="mt-1 text-[11px]">
                              Please edit and Confirm or ask me for more help.
                            </p>
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
                                <div className="grid grid-cols-2 gap-1.5">
                                  <input
                                    type="date"
                                    value={
                                      /^\d{4}-\d{2}-\d{2}$/.test(draftValues.dates.trim())
                                        ? draftValues.dates.trim()
                                        : ''
                                    }
                                    onChange={(e) =>
                                      updateProposalFlowDraftField(
                                        message.id,
                                        draftProposal,
                                        'dates',
                                        e.target.value
                                      )
                                    }
                                    aria-label="Date"
                                    className="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-xs text-gray-900 dark:border-sky-900/60 dark:bg-slate-900 dark:text-slate-100"
                                  />
                                  <input
                                    type="time"
                                    value={
                                      /^\d{2}:\d{2}$/.test(draftValues.times.trim())
                                        ? draftValues.times.trim()
                                        : ''
                                    }
                                    onChange={(e) =>
                                      updateProposalFlowDraftField(
                                        message.id,
                                        draftProposal,
                                        'times',
                                        e.target.value
                                      )
                                    }
                                    aria-label="Time"
                                    className="w-full rounded border border-sky-300 bg-white px-2 py-1.5 text-xs text-gray-900 dark:border-sky-900/60 dark:bg-slate-900 dark:text-slate-100"
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
          </div>
        ) : sortedProposals.length === 0 ? (
          <div className="flex flex-1 items-center justify-center rounded-lg bg-white p-3 text-xs text-gray-600 dark:bg-slate-900 dark:text-slate-300">
            No proposals yet. Use Snooky below to draft one.
          </div>
        ) : (
          <div className="hide-scrollbar min-h-0 flex-1 snap-y snap-mandatory overflow-y-auto">
            {sortedProposals.map((proposal, index) => {
              const theme = proposalCardTheme(index);
              const contributions = proposalThreadStore.listForProposal(proposal.id);
              const proposalAvailabilities = getProposalAvailabilities(proposal.id);
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
              const proposalCreatorName = userNames.get(proposal.createdBy) || 'Unknown';
              const thumbnailUrl = proposalThumbnailUrls[proposal.id];
              const proposerNote =
                proposal.comments
                  ?.filter((comment) => comment.userId === proposal.createdBy)
                  .slice(-1)[0]
                  ?.text?.trim() || 'No proposer notes yet.';
              const requirementsNote =
                proposal.comments
                  ?.find((comment) => /requirement|require|need/i.test(comment.text))
                  ?.text?.trim() || 'No requirements listed.';
              const displayDateChanges = [...dateChanges];
              const displayTimeChanges = [...timeChanges];
              const displayPlaceChanges = [...placeChanges];
              const baselineDateText = proposal.specifics?.date || '';
              const originalCalendarDates = parseIsoDatesFromText(baselineDateText);
              const alternativeCalendarDates = Array.from(
                new Set(
                  displayDateChanges.flatMap((change) => {
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

              return (
                <div
                  key={`${proposal.id}-${proposalFeedRefreshTick}`}
                  className={`h-full min-h-full snap-start overflow-hidden rounded-[1rem] border-2 shadow ${theme.shell} flex flex-col`}
                >
                  <div className="relative">
                    <div className="aspect-[16/7] w-full overflow-hidden bg-white/40 dark:bg-slate-900/40">
                      {thumbnailUrl ? (
                        <img
                          src={thumbnailUrl}
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
                          <p className="text-base font-semibold text-white drop-shadow-sm">
                            {proposal.title}
                          </p>
                          <p className="mt-0.5 text-xs text-white/85">
                            by {proposalCreatorName}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col p-2.5">
                    <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="text-xs font-medium text-gray-700 dark:text-slate-200">
                        Subscribed {subscribedCount}/{participantRows.length}
                      </span>
                      {participantRows.map((row) => (
                        <span
                          key={`avatar-${row.member.id}`}
                          title={`${row.member.name}: ${
                            row.hasAffirmation ? 'subscribed' : 'not subscribed'
                          }`}
                          className={`relative inline-flex h-7 w-7 items-center justify-center rounded-full border text-[10px] font-semibold ${
                            row.hasAffirmation
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
                    <div className="mt-2 space-y-2.5 rounded-lg border border-white/70 bg-white/70 p-2.5 text-sm leading-6 text-gray-800 dark:border-slate-700 dark:bg-slate-950/70 dark:text-slate-200">
                      <div className="grid grid-cols-1 gap-1.5">
                        <div>
                          <span className="font-semibold">Date:</span>{' '}
                          {baselineDateText || 'Not set'}
                        </div>
                        <div>
                          <span className="font-semibold">Time:</span>{' '}
                          {formatTo24HourTimeText(proposal.specifics?.time || 'Not set')}
                        </div>
                        <div>
                          <span className="font-semibold">Place:</span>{' '}
                          {proposal.specifics?.location || 'Not set'}
                        </div>
                      </div>
                      <div>
                        <span className="font-semibold">Proposer notes:</span> {proposerNote}
                      </div>
                      <div>
                        <span className="font-semibold">Requirements:</span> {requirementsNote}
                      </div>
                      <div className="space-y-1.5">
                        <p className="font-semibold">Suggested alternatives</p>
                        {displayDateChanges.length === 0 &&
                        displayTimeChanges.length === 0 &&
                        displayPlaceChanges.length === 0 ? (
                          <p className="text-xs leading-5 text-gray-600 dark:text-slate-300">
                            No alternatives suggested yet.
                          </p>
                        ) : (
                          <div className="space-y-1.5">
                            {displayDateChanges.map((change) => {
                              const optionId = `date-${change.id}`;
                              return (
                              <label key={`date-${change.id}`} className="flex items-start gap-2">
                                <input
                                  type="checkbox"
                                  checked={Boolean(selectedAlternativeIdsByProposal[proposal.id]?.[optionId])}
                                  onChange={() => toggleAlternativeSelection(proposal.id, optionId)}
                                  className="mt-0.5 h-3.5 w-3.5 rounded border-gray-300"
                                />
                                <span>
                                  <span className="font-medium">
                                    {userInitials(userNames.get(change.userId) || '?')}:
                                  </span>{' '}
                                  <span className="font-medium">Date:</span>{' '}
                                  {typeof change.value.dateText === 'string'
                                    ? String(change.value.dateText)
                                    : typeof change.value.text === 'string'
                                      ? String(change.value.text)
                                      : 'unspecified'}
                                </span>
                              </label>
                              );
                            })}
                            {displayTimeChanges.map((change) => {
                              const optionId = `time-${change.id}`;
                              return (
                              <label key={`time-${change.id}`} className="flex items-start gap-2">
                                <input
                                  type="checkbox"
                                  checked={Boolean(selectedAlternativeIdsByProposal[proposal.id]?.[optionId])}
                                  onChange={() => toggleAlternativeSelection(proposal.id, optionId)}
                                  className="mt-0.5 h-3.5 w-3.5 rounded border-gray-300"
                                />
                                <span>
                                  <span className="font-medium">
                                    {userInitials(userNames.get(change.userId) || '?')}:
                                  </span>{' '}
                                  <span className="font-medium">Time:</span>{' '}
                                  {typeof change.value.text === 'string'
                                    ? formatTo24HourTimeText(String(change.value.text))
                                    : 'unspecified'}
                                </span>
                              </label>
                              );
                            })}
                            {displayPlaceChanges.map((change) => {
                              const optionId = `place-${change.id}`;
                              return (
                              <label key={`place-${change.id}`} className="flex items-start gap-2">
                                <input
                                  type="checkbox"
                                  checked={Boolean(selectedAlternativeIdsByProposal[proposal.id]?.[optionId])}
                                  onChange={() => toggleAlternativeSelection(proposal.id, optionId)}
                                  className="mt-0.5 h-3.5 w-3.5 rounded border-gray-300"
                                />
                                <span>
                                  <span className="font-medium">
                                    {userInitials(userNames.get(change.userId) || '?')}:
                                  </span>{' '}
                                  <span className="font-medium">Place:</span>{' '}
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

                    {proposalCardDrafts[proposal.id]?.isSuggestModalOpen && (
                      <div className="mt-2 rounded-xl border border-gray-200 bg-white p-2.5 shadow-sm dark:border-slate-700 dark:bg-slate-950">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-700 dark:text-slate-200">
                            Suggest Alternatives
                          </p>
                          <button
                            type="button"
                            onClick={() => closeSuggestAlternativesModal(proposal.id)}
                            className="rounded border border-gray-300 px-2 py-1 text-[11px] text-gray-700 dark:border-slate-600 dark:text-slate-200"
                          >
                            Close
                          </button>
                        </div>
                        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                          <input
                            type="text"
                            value={proposalCardDrafts[proposal.id]?.dateSuggestion || ''}
                            onChange={(e) =>
                              setProposalCardDrafts((prev) => ({
                                ...prev,
                                [proposal.id]: {
                                  dateSuggestion: e.target.value,
                                  timeSuggestion: prev[proposal.id]?.timeSuggestion || '',
                                  placeSuggestion: prev[proposal.id]?.placeSuggestion || '',
                                  isSuggestModalOpen: true,
                                },
                              }))
                            }
                            placeholder="Date(s): 2026-08-10 to 2026-08-14"
                            className="rounded border border-gray-300 px-2 py-1.5 text-xs text-gray-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                          />
                          <input
                            type="text"
                            value={proposalCardDrafts[proposal.id]?.timeSuggestion || ''}
                            onChange={(e) =>
                              setProposalCardDrafts((prev) => ({
                                ...prev,
                                [proposal.id]: {
                                  dateSuggestion: prev[proposal.id]?.dateSuggestion || '',
                                  timeSuggestion: e.target.value,
                                  placeSuggestion: prev[proposal.id]?.placeSuggestion || '',
                                  isSuggestModalOpen: true,
                                },
                              }))
                            }
                            placeholder="Time: evening / 19:00"
                            className="rounded border border-gray-300 px-2 py-1.5 text-xs text-gray-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                          />
                          <input
                            type="text"
                            value={proposalCardDrafts[proposal.id]?.placeSuggestion || ''}
                            onChange={(e) =>
                              setProposalCardDrafts((prev) => ({
                                ...prev,
                                [proposal.id]: {
                                  dateSuggestion: prev[proposal.id]?.dateSuggestion || '',
                                  timeSuggestion: prev[proposal.id]?.timeSuggestion || '',
                                  placeSuggestion: e.target.value,
                                  isSuggestModalOpen: true,
                                },
                              }))
                            }
                            placeholder="Place: neighborhood / venue"
                            className="rounded border border-gray-300 px-2 py-1.5 text-xs text-gray-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                          />
                        </div>
                        <div className="mt-2 flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleSubmitAlternatives(proposal)}
                            disabled={
                              !(
                                proposalCardDrafts[proposal.id]?.dateSuggestion?.trim() ||
                                proposalCardDrafts[proposal.id]?.timeSuggestion?.trim() ||
                                proposalCardDrafts[proposal.id]?.placeSuggestion?.trim()
                              )
                            }
                            className="rounded bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                          >
                            Add Alternatives
                          </button>
                        </div>
                      </div>
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
                            openCalendarPopup(
                              proposal,
                              originalCalendarDates,
                              alternativeCalendarDates
                            )
                          }
                          className="rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          Calendar
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
            })}
          </div>
        )}
        <Modal
          isOpen={Boolean(calendarPopup)}
          onClose={() => setCalendarPopup(null)}
          title={calendarPopup ? `${calendarPopup.proposalTitle} calendar` : 'Proposal calendar'}
        >
          {calendarPopup && (
            <div className="space-y-3 text-xs">
              <p className="text-sm font-semibold text-gray-800 dark:text-slate-100">
                {formatIsoMonthLabel(calendarPopup.anchorMonthIso)}
              </p>
              <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-gray-500 dark:text-slate-400">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label) => (
                  <div key={`weekday-${label}`}>{label}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {buildMonthCells(calendarPopup.anchorMonthIso).map((cell, index) => {
                  if (!cell.iso || !cell.day) {
                    return <div key={`blank-${index}`} className="h-8 rounded-md bg-transparent" />;
                  }
                  const isOriginal = calendarPopup.originalDates.includes(cell.iso);
                  const isAlternative = calendarPopup.alternativeDates.includes(cell.iso);
                  const dayClass = isOriginal && isAlternative
                    ? 'border-sky-300 bg-gradient-to-r from-sky-100 to-amber-100 text-slate-900 dark:border-sky-700 dark:from-sky-900/30 dark:to-amber-900/30 dark:text-slate-100'
                    : isOriginal
                      ? 'border-sky-300 bg-sky-100 text-sky-900 dark:border-sky-700 dark:bg-sky-900/30 dark:text-sky-100'
                      : isAlternative
                        ? 'border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-100'
                        : 'border-gray-200 bg-white text-gray-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300';
                  return (
                    <div
                      key={cell.iso}
                      className={`flex h-8 items-center justify-center rounded-md border text-[11px] font-medium ${dayClass}`}
                    >
                      {cell.day}
                    </div>
                  );
                })}
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px]">
                <span className="inline-flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-full bg-sky-400 dark:bg-sky-300" />
                  Original dates
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400 dark:bg-amber-300" />
                  Alternative dates
                </span>
              </div>
            </div>
          )}
        </Modal>
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
            {sortedProposals.map((proposal, index) => {
              const theme = proposalCardTheme(index);
              const contributions = proposalThreadStore.listForProposal(proposal.id);
              const proposalAvailabilities = getProposalAvailabilities(proposal.id);
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
              const proposalCreatorName = userNames.get(proposal.createdBy) || 'Unknown';
              const thumbnailUrl = proposalThumbnailUrls[proposal.id];
              const thumbnailBusy = Boolean(thumbnailGeneratingByProposalId[proposal.id]);
              const thumbnailError = thumbnailErrorByProposalId[proposal.id];

              return (
                <div
                  key={`${proposal.id}-${proposalFeedRefreshTick}`}
                  className={`snap-start overflow-hidden rounded-[1rem] border shadow-sm ${theme.shell} flex min-h-[70vh] flex-col`}
                >
                  <div className="relative">
                    <div className="aspect-[16/7] w-full overflow-hidden bg-white/40 dark:bg-slate-900/40">
                      {thumbnailUrl ? (
                        <img
                          src={thumbnailUrl}
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
                          <p className="text-base font-semibold text-white drop-shadow-sm">
                            {proposal.title}
                          </p>
                          <p className="mt-0.5 text-xs text-white/85">
                            by {proposalCreatorName}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-1 flex-col p-2.5">
                    <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-medium text-gray-700 dark:text-slate-200">
                        Subscribed {subscribedCount}/{participantRows.length}
                      </span>
                      {participantRows.map((row) => (
                        <span
                          key={`avatar-${row.member.id}`}
                          title={`${row.member.name}: ${
                            row.hasAffirmation ? 'subscribed' : 'not subscribed'
                          }`}
                          className={`relative inline-flex h-7 w-7 items-center justify-center rounded-full border text-[10px] font-semibold ${
                            row.hasAffirmation
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
                    <div className="flex flex-wrap gap-1.5">
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
                      className="rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
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
                        <summary className={`cursor-pointer list-none rounded-full border px-2.5 py-1 text-[11px] ${theme.accent}`}>
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
                              className={`rounded-full border px-2 py-1 text-[11px] ${
                                row.member.id === userId
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
                                  <span className="font-medium">{userNames.get(change.userId) || 'Someone'}</span>{' '}
                                  <span className="uppercase text-[10px] opacity-80">{change.field || 'change'}</span>{' '}
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

                    {proposalCardDrafts[proposal.id]?.isSuggestModalOpen && (
                      <div className="mt-2 rounded-xl border border-gray-200 bg-white p-2.5 shadow-sm dark:border-slate-700 dark:bg-slate-950">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-700 dark:text-slate-200">
                            Suggest Alternatives
                          </p>
                          <button
                            type="button"
                            onClick={() => closeSuggestAlternativesModal(proposal.id)}
                            className="rounded border border-gray-300 px-2 py-1 text-[11px] text-gray-700 dark:border-slate-600 dark:text-slate-200"
                          >
                            Close
                          </button>
                        </div>
                        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                          <input
                            type="text"
                            value={proposalCardDrafts[proposal.id]?.dateSuggestion || ''}
                            onChange={(e) =>
                              setProposalCardDrafts((prev) => ({
                                ...prev,
                                [proposal.id]: {
                                  dateSuggestion: e.target.value,
                                  timeSuggestion: prev[proposal.id]?.timeSuggestion || '',
                                  placeSuggestion: prev[proposal.id]?.placeSuggestion || '',
                                  isSuggestModalOpen: true,
                                },
                              }))
                            }
                            placeholder="Date(s): 2026-08-10 to 2026-08-14"
                            className="rounded border border-gray-300 px-2 py-1.5 text-xs text-gray-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                          />
                          <input
                            type="text"
                            value={proposalCardDrafts[proposal.id]?.timeSuggestion || ''}
                            onChange={(e) =>
                              setProposalCardDrafts((prev) => ({
                                ...prev,
                                [proposal.id]: {
                                  dateSuggestion: prev[proposal.id]?.dateSuggestion || '',
                                  timeSuggestion: e.target.value,
                                  placeSuggestion: prev[proposal.id]?.placeSuggestion || '',
                                  isSuggestModalOpen: true,
                                },
                              }))
                            }
                            placeholder="Time: evening / 19:00"
                            className="rounded border border-gray-300 px-2 py-1.5 text-xs text-gray-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                          />
                          <input
                            type="text"
                            value={proposalCardDrafts[proposal.id]?.placeSuggestion || ''}
                            onChange={(e) =>
                              setProposalCardDrafts((prev) => ({
                                ...prev,
                                [proposal.id]: {
                                  dateSuggestion: prev[proposal.id]?.dateSuggestion || '',
                                  timeSuggestion: prev[proposal.id]?.timeSuggestion || '',
                                  placeSuggestion: e.target.value,
                                  isSuggestModalOpen: true,
                                },
                              }))
                            }
                            placeholder="Place: neighborhood / venue"
                            className="rounded border border-gray-300 px-2 py-1.5 text-xs text-gray-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                          />
                        </div>
                        <div className="mt-2 flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleSubmitAlternatives(proposal)}
                            disabled={
                              !(
                                proposalCardDrafts[proposal.id]?.dateSuggestion?.trim() ||
                                proposalCardDrafts[proposal.id]?.timeSuggestion?.trim() ||
                                proposalCardDrafts[proposal.id]?.placeSuggestion?.trim()
                              )
                            }
                            className="rounded bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
                          >
                            Add Alternatives
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="min-h-[18rem] rounded-lg border border-gray-200 dark:border-slate-700 p-3 space-y-2 bg-gray-50 dark:bg-slate-950">
        {messages.map((message) => (
          <div key={message.id} className="space-y-2">
            <div
              className={`rounded px-3 py-2 text-sm ${
                message.role === 'user'
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
            <div className="mt-3 rounded border border-emerald-200 bg-white p-3 dark:border-emerald-900/50 dark:bg-slate-900">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
                  Memory Explorer
                </p>
                <p className="text-[11px] text-gray-600 dark:text-slate-300">
                  v1 in-panel view
                </p>
              </div>
              <div className="mb-3 flex flex-wrap gap-2">
                <label className="text-[11px] text-gray-700 dark:text-slate-200">
                  Status
                  <select
                    value={memoryStatusFilter}
                    onChange={(e) => setMemoryStatusFilter(e.target.value as MemoryStatusFilter)}
                    className="ml-1 rounded border border-gray-300 bg-white px-1.5 py-1 text-[11px] text-gray-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:[color-scheme:dark]"
                  >
                    <option value="all">All</option>
                    <option value="reported">Reported</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="inferred">Inferred</option>
                    <option value="needs_confirmation">Needs confirmation</option>
                    <option value="contradicted">Contradicted</option>
                  </select>
                </label>
                <label className="text-[11px] text-gray-700 dark:text-slate-200">
                  Type
                  <select
                    value={memoryTypeFilter}
                    onChange={(e) => setMemoryTypeFilter(e.target.value as MemoryTypeFilter)}
                    className="ml-1 rounded border border-gray-300 bg-white px-1.5 py-1 text-[11px] text-gray-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:[color-scheme:dark]"
                  >
                    <option value="all">All</option>
                    <option value="availability_">Availability only</option>
                  </select>
                </label>
              </div>
              <div className="max-h-60 space-y-2 overflow-y-auto">
                {allMemoryRecords.length === 0 ? (
                  <p className="text-xs text-gray-600 dark:text-slate-300">No memory records match the current filters.</p>
                ) : (
                  allMemoryRecords.map((record) => (
                    <div
                      key={`explorer-${record.id}`}
                      className="rounded border border-gray-200 bg-gray-50 px-2 py-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                    >
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] dark:bg-slate-800">
                          {record.status}
                        </span>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] dark:bg-slate-800">
                          {record.factType}
                        </span>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] dark:bg-slate-800">
                          {typeof record.value.seedProfile === 'string'
                            ? String(record.value.seedProfile)
                            : `user ${record.scopeId}`}
                        </span>
                        <span className="text-[10px] text-gray-500 dark:text-slate-400">
                          {new Date(record.observedAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="mt-1 text-gray-700 dark:text-slate-200">{summarizeMemoryRecord(record)}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
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
