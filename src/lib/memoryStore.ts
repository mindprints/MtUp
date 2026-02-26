import { generateId } from '@/lib/utils';
import type { MemoryRecord } from '@/types';

const MEMORY_STORAGE_KEY = 'mtup-memory-records-v1';

const MONTHS = [
  'january',
  'february',
  'march',
  'april',
  'may',
  'june',
  'july',
  'august',
  'september',
  'october',
  'november',
  'december',
] as const;

const WEEKDAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

type CaptureMemoryInput = {
  userId: string;
  activeGroupId: string | null;
  messageText: string;
  sourceMessageId?: string;
};

function normalizeRecords(raw: unknown): MemoryRecord[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is MemoryRecord => {
    const candidate = item as Partial<MemoryRecord> | null;
    return Boolean(
      candidate &&
        typeof candidate.id === 'string' &&
        typeof candidate.scopeType === 'string' &&
        typeof candidate.scopeId === 'string' &&
        typeof candidate.factType === 'string' &&
        candidate.value &&
        typeof candidate.value === 'object' &&
        typeof candidate.status === 'string' &&
        typeof candidate.durability === 'string' &&
        typeof candidate.sourceKind === 'string' &&
        typeof candidate.observedAt === 'string' &&
        typeof candidate.updatedAt === 'string'
    );
  });
}

function readAll(): MemoryRecord[] {
  const raw = localStorage.getItem(MEMORY_STORAGE_KEY);
  if (!raw) return [];
  try {
    return normalizeRecords(JSON.parse(raw));
  } catch {
    return [];
  }
}

function writeAll(records: MemoryRecord[]): void {
  localStorage.setItem(MEMORY_STORAGE_KEY, JSON.stringify(records));
}

function monthMatch(textLower: string): { monthIndex: number; monthName: string; year?: number } | null {
  const monthPattern = MONTHS.join('|');
  const match = textLower.match(new RegExp(`\\b(${monthPattern})\\b(?:\\s+(\\d{4}))?`, 'i'));
  if (!match) return null;
  const monthName = match[1].toLowerCase();
  const monthIndex = MONTHS.indexOf(monthName as (typeof MONTHS)[number]);
  if (monthIndex < 0) return null;
  const parsedYear = match[2] ? Number.parseInt(match[2], 10) : undefined;
  return Number.isFinite(parsedYear ?? Number.NaN)
    ? { monthIndex, monthName, year: parsedYear }
    : { monthIndex, monthName };
}

function monthDateRange(year: number, monthIndex: number): { validFrom: string; validTo: string } {
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const last = new Date(Date.UTC(year, monthIndex + 1, 0));
  const toIsoDate = (value: Date) => value.toISOString().slice(0, 10);
  return { validFrom: toIsoDate(first), validTo: toIsoDate(last) };
}

function hasUnavailabilitySignal(textLower: string): boolean {
  return (
    /\bunavailable\b/.test(textLower) ||
    /\bnot available\b/.test(textLower) ||
    /\bnot free\b/.test(textLower) ||
    /\bbusy\b/.test(textLower) ||
    /\bi can't do\b/.test(textLower) ||
    /\bi cant do\b/.test(textLower) ||
    /\bi cannot do\b/.test(textLower) ||
    /\bi can't make\b/.test(textLower) ||
    /\bi cant make\b/.test(textLower)
  );
}

function hasAvailabilitySignal(textLower: string): boolean {
  return (
    /\bavailable\b/.test(textLower) ||
    /\bfree\b/.test(textLower) ||
    /\bi can do\b/.test(textLower) ||
    /\bi'm free\b/.test(textLower) ||
    /\bim free\b/.test(textLower) ||
    /\bi am free\b/.test(textLower)
  );
}

function weekdayMatches(textLower: string): string[] {
  const hits = new Set<string>();
  for (const weekday of WEEKDAYS) {
    const plural = `${weekday}s`;
    if (new RegExp(`\\b${weekday}s?\\b`).test(textLower) || textLower.includes(plural)) {
      hits.add(weekday);
    }
  }
  return [...hits];
}

function timeQualifierMatches(textLower: string): { after?: string; before?: string } | null {
  const afterMatch = textLower.match(/\bafter\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/i);
  const beforeMatch = textLower.match(/\bbefore\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\b/i);
  const result: { after?: string; before?: string } = {};
  if (afterMatch?.[1]) result.after = afterMatch[1].trim();
  if (beforeMatch?.[1]) result.before = beforeMatch[1].trim();
  return result.after || result.before ? result : null;
}

function buildBaseMemoryRecord(
  input: CaptureMemoryInput,
  factType: string,
  value: Record<string, unknown>,
  overrides?: Partial<MemoryRecord>
): MemoryRecord {
  const nowIso = new Date().toISOString();
  return {
    id: generateId(),
    groupId: input.activeGroupId,
    scopeType: 'person',
    scopeId: input.userId,
    factType,
    value: {
      ...value,
      originalText: input.messageText.trim(),
    },
    status: 'reported',
    durability: 'seasonal',
    sourceKind: 'user_message',
    sourceRef: input.sourceMessageId,
    observedAt: nowIso,
    updatedAt: nowIso,
    ...(overrides ?? {}),
  };
}

function extractSelfReportedAvailabilityConstraint(input: CaptureMemoryInput): MemoryRecord[] {
  const textLower = input.messageText.trim().toLowerCase();
  if (!textLower) return [];
  const isUnavailable = hasUnavailabilitySignal(textLower);
  const isAvailable = !isUnavailable && hasAvailabilitySignal(textLower);
  if (!isUnavailable && !isAvailable) return [];

  const modality = /in[- ]person/.test(textLower)
    ? 'in_person'
    : /\bonline\b|\bremote\b|\bvirtual\b/.test(textLower)
      ? 'online'
      : 'general';

  const records: MemoryRecord[] = [];
  const availabilityValue = isUnavailable ? 'unavailable' : 'available';
  const timeQualifiers = timeQualifierMatches(textLower);

  const month = monthMatch(textLower);
  if (month) {
    const dateRange = month.year ? monthDateRange(month.year, month.monthIndex) : null;
    records.push(
      buildBaseMemoryRecord(
        input,
        'availability_constraint',
        {
          availability: availabilityValue,
          modality,
          month: month.monthName,
          ...(month.year ? { year: month.year } : {}),
          ...(timeQualifiers ?? {}),
        },
        {
          ...(dateRange ?? {}),
          durability: 'seasonal',
        }
      )
    );
  }

  const weekdays = weekdayMatches(textLower);
  if (weekdays.length > 0) {
    records.push(
      ...weekdays.map((weekday) =>
        buildBaseMemoryRecord(
          input,
          'availability_recurring_constraint',
          {
            availability: availabilityValue,
            modality,
            weekday,
            recurrence: 'weekly',
            ...(timeQualifiers ?? {}),
          },
          { durability: 'durable' }
        )
      )
    );
  }

  if (records.length === 0 && timeQualifiers) {
    records.push(
      buildBaseMemoryRecord(
        input,
        'availability_time_preference',
        {
          availability: availabilityValue,
          modality,
          recurrence: 'unspecified',
          ...timeQualifiers,
        },
        { durability: 'seasonal' }
      )
    );
  }

  return records;
}

function isRelevantToPrompt(record: MemoryRecord, promptLower: string): boolean {
  if (!promptLower.trim()) return false;
  if (typeof record.value.originalText === 'string' && promptLower.includes('remember')) return true;

  if (
    promptLower.includes('available') ||
    promptLower.includes('unavailable') ||
    promptLower.includes('free') ||
    promptLower.includes('busy')
  ) {
    return record.factType.startsWith('availability_');
  }

  const month = monthMatch(promptLower);
  if (month && record.value.month === month.monthName) return true;

  const weekdays = weekdayMatches(promptLower);
  if (weekdays.length > 0 && typeof record.value.weekday === 'string') {
    return weekdays.includes(String(record.value.weekday));
  }

  return false;
}

function matchesMemoryFilter(
  record: MemoryRecord,
  filter: { status?: MemoryRecord['status'] | 'all'; factTypePrefix?: string | 'all' }
): boolean {
  const statusMatches = !filter.status || filter.status === 'all' || record.status === filter.status;
  const factMatches =
    !filter.factTypePrefix ||
    filter.factTypePrefix === 'all' ||
    record.factType.startsWith(filter.factTypePrefix);
  return statusMatches && factMatches;
}

export const memoryStore = {
  list(): MemoryRecord[] {
    return readAll();
  },

  listForUser(userId: string, groupId?: string | null): MemoryRecord[] {
    return readAll()
      .filter(
        (record) =>
          record.scopeType === 'person' &&
          record.scopeId === userId &&
          (groupId === undefined || record.groupId === groupId)
      )
      .sort((a, b) => b.observedAt.localeCompare(a.observedAt));
  },

  findRelevantForPrompt(userId: string, prompt: string, groupId?: string | null): MemoryRecord[] {
    const promptLower = prompt.toLowerCase();
    return this.listForUser(userId, groupId)
      .filter((record) => isRelevantToPrompt(record, promptLower))
      .slice(0, 3);
  },

  listForUserFiltered(
    userId: string,
    groupId: string | null,
    filter: { status?: MemoryRecord['status'] | 'all'; factTypePrefix?: string | 'all' }
  ): MemoryRecord[] {
    return this.listForUser(userId, groupId).filter((record) => matchesMemoryFilter(record, filter));
  },

  listForGroupFiltered(
    groupId: string | null,
    filter: { status?: MemoryRecord['status'] | 'all'; factTypePrefix?: string | 'all' }
  ): MemoryRecord[] {
    return readAll()
      .filter((record) => (groupId === null ? true : record.groupId === groupId))
      .filter((record) => matchesMemoryFilter(record, filter))
      .sort((a, b) => b.observedAt.localeCompare(a.observedAt));
  },

  add(record: MemoryRecord): void {
    const records = readAll();
    records.push(record);
    writeAll(records);
  },

  addMany(recordsToAdd: MemoryRecord[]): void {
    if (recordsToAdd.length === 0) return;
    const records = readAll();
    records.push(...recordsToAdd);
    writeAll(records);
  },

  addManyDedupedBySourceRef(recordsToAdd: MemoryRecord[]): number {
    if (recordsToAdd.length === 0) return 0;
    const records = readAll();
    const existingKeys = new Set(
      records.map((record) => `${record.sourceKind}::${record.sourceRef || ''}`)
    );
    let addedCount = 0;
    for (const record of recordsToAdd) {
      const key = `${record.sourceKind}::${record.sourceRef || ''}`;
      if (record.sourceRef && existingKeys.has(key)) continue;
      records.push(record);
      existingKeys.add(key);
      addedCount += 1;
    }
    if (addedCount > 0) writeAll(records);
    return addedCount;
  },

  captureSelfReportedMemories(input: CaptureMemoryInput): MemoryRecord[] {
    const records = extractSelfReportedAvailabilityConstraint(input);
    this.addMany(records);
    return records;
  },

  update(recordId: string, updates: Partial<MemoryRecord>): MemoryRecord | null {
    const records = readAll();
    const index = records.findIndex((record) => record.id === recordId);
    if (index < 0) return null;
    const nextRecord: MemoryRecord = {
      ...records[index],
      ...updates,
      id: records[index].id,
      updatedAt: new Date().toISOString(),
    };
    records[index] = nextRecord;
    writeAll(records);
    return nextRecord;
  },

  remove(recordId: string): void {
    const records = readAll().filter((record) => record.id !== recordId);
    writeAll(records);
  },

  clearBySourceKind(sourceKind: MemoryRecord['sourceKind']): number {
    const before = readAll();
    const after = before.filter((record) => record.sourceKind !== sourceKind);
    writeAll(after);
    return before.length - after.length;
  },
};
