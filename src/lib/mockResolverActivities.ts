import type { Availability, Proposal } from '@/types';
import { generateId, getAvailableEmoji } from '@/lib/utils';

type SeedUser = {
  id: string;
  name: string;
  isAdmin: boolean;
};

type MockResolverSeedData = {
  proposals: Proposal[];
  availabilities: Availability[];
};

type MockTemplate = {
  title: string;
  type: Proposal['type'];
  offsetDays: number;
  endOffsetDays?: number;
  time?: string;
  startTime?: string;
  endTime?: string;
  location: string;
  requirements?: string;
};

const MOCK_TEMPLATES: MockTemplate[] = [
  {
    title: 'Afterwork at Ringen',
    type: 'event',
    offsetDays: 2,
    time: '18:00',
    location: 'Ringen',
    requirements: 'Bring appetite',
  },
  {
    title: 'Photo Walk Djurgarden',
    type: 'event',
    offsetDays: 4,
    time: '10:30',
    location: 'Djurgarden',
  },
  {
    title: 'Cinema Night at Skandia',
    type: 'event',
    offsetDays: 6,
    time: '19:15',
    location: 'Skandia',
  },
  {
    title: 'Weekend in Vaxholm',
    type: 'sejour',
    offsetDays: 9,
    endOffsetDays: 11,
    startTime: '09:00',
    endTime: '18:00',
    location: 'Vaxholm',
    requirements: 'Pack light',
  },
  {
    title: 'Berlin Sprint',
    type: 'sejour',
    offsetDays: 14,
    endOffsetDays: 17,
    startTime: '07:30',
    endTime: '21:00',
    location: 'Berlin',
    requirements: 'Passport needed',
  },
  {
    title: 'Board Games in Vasastan',
    type: 'event',
    offsetDays: 12,
    time: '17:45',
    location: 'Vasastan',
  },
];

function formatIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(base: Date, days: number): Date {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDateRange(startDate: string, endDate: string): string {
  return startDate === endDate ? startDate : `${startDate} to ${endDate}`;
}

function buildContiguousDates(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${startDate}T00:00:00`);
  const last = new Date(`${endDate}T00:00:00`);
  while (cursor <= last) {
    dates.push(formatIsoDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function pickAuthor(users: SeedUser[], index: number): SeedUser {
  return users[index % users.length];
}

function buildEventApprovalDates(date: string): string[] {
  const shouldApprove = Math.random() >= 0.3;
  return shouldApprove ? [date] : [];
}

function buildSejourApprovalDates(dateRange: string[]): string[] {
  const rangeLength = dateRange.length;
  if (rangeLength <= 1) return dateRange;

  const maxSpan = Math.max(2, rangeLength);
  const span = Math.min(
    rangeLength,
    Math.max(2, Math.floor(Math.random() * maxSpan) + 1)
  );
  const startIndex = Math.floor(Math.random() * (rangeLength - span + 1));
  return dateRange.slice(startIndex, startIndex + span);
}

export function buildMockResolverActivities(params: {
  activeGroupId: string | null;
  currentUserId: string;
  groupUsers: SeedUser[];
  existingEmojis: string[];
}): MockResolverSeedData {
  const { activeGroupId, currentUserId, groupUsers, existingEmojis } = params;
  const today = new Date();
  const usedEmojis = [...existingEmojis];

  const proposals = MOCK_TEMPLATES.map((template, index) => {
    const author = pickAuthor(groupUsers, index);
    const startDate = formatIsoDate(addDays(today, template.offsetDays));
    const endDate = formatIsoDate(addDays(today, template.endOffsetDays ?? template.offsetDays));
    const emoji = getAvailableEmoji(usedEmojis);
    usedEmojis.push(emoji);

    return {
      id: generateId(),
      groupId: activeGroupId || undefined,
      title: template.title,
      type: template.type,
      emoji,
      createdBy: currentUserId,
      authoredBy: author.id,
      createdAt: addDays(today, -index).toISOString(),
      status: 'proposed' as const,
      specifics: {
        date: formatDateRange(startDate, endDate),
        ...(template.time ? { time: template.time } : {}),
        ...(template.startTime ? { startTime: template.startTime } : {}),
        ...(template.endTime ? { endTime: template.endTime } : {}),
        location: template.location,
        ...(template.requirements ? { requirements: template.requirements } : {}),
      },
      comments: [],
    };
  });

  const availabilities = proposals.flatMap((proposal) => {
    const dates = buildContiguousDates(
      proposal.specifics?.date?.split(' to ')[0] || '',
      proposal.specifics?.date?.split(' to ')[1] || proposal.specifics?.date || ''
    );
    const approvalRows = groupUsers.map((member, memberIndex) => ({
      member,
      memberIndex,
      approvedDates:
        proposal.type === 'sejour'
          ? buildSejourApprovalDates(dates)
          : buildEventApprovalDates(dates[0]),
    }));

    const seededRows = approvalRows.map((entry, index, rows) => {
      if (rows.filter((row) => row.approvedDates.length > 0).length >= 2) {
        return entry;
      }
      if (index < Math.min(2, rows.length)) {
        return {
          ...entry,
          approvedDates: proposal.type === 'sejour' ? dates.slice(0, Math.min(2, dates.length)) : [dates[0]],
        };
      }
      return entry;
    });

    return seededRows.flatMap(({ member, approvedDates }) => {
      if (approvedDates.length === 0) return [];

      return [{
        id: generateId(),
        userId: member.id,
        proposalId: proposal.id,
        dates: approvedDates,
      }];
    });
  });

  return { proposals, availabilities };
}
