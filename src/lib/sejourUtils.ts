import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';
import type { Availability } from '@/types';

export type DateRange = {
  startDate: string;
  endDate: string;
  dates: string[];
};

export type SejourOverlapWindow = {
  startDate: string;
  endDate: string;
  nights: number;
  participantCount: number;
  participantUserIds: string[];
  label: string;
};

type OverlapWindowOptions = {
  minNights?: number;
  minParticipants?: number;
  maxWindows?: number;
};

function areConsecutiveDates(firstIso: string, secondIso: string): boolean {
  return differenceInCalendarDays(parseISO(secondIso), parseISO(firstIso)) === 1;
}

function formatWindowLabel(startIso: string, endIso: string, participantCount: number): string {
  const start = parseISO(startIso);
  const end = parseISO(endIso);
  const nights = differenceInCalendarDays(end, start);

  return `${format(start, 'MMM d')} - ${format(end, 'MMM d')} (${nights} night${
    nights === 1 ? '' : 's'
  }, ${participantCount} person${participantCount === 1 ? '' : 's'})`;
}

export function getContiguousDateRanges(dates: string[]): DateRange[] {
  const sortedUnique = Array.from(new Set(dates)).sort();
  if (sortedUnique.length === 0) return [];

  const ranges: DateRange[] = [];
  let start = sortedUnique[0];
  let currentDates = [sortedUnique[0]];

  for (let i = 1; i < sortedUnique.length; i += 1) {
    const current = sortedUnique[i];
    const previous = sortedUnique[i - 1];

    if (areConsecutiveDates(previous, current)) {
      currentDates.push(current);
      continue;
    }

    ranges.push({
      startDate: start,
      endDate: currentDates[currentDates.length - 1],
      dates: [...currentDates],
    });

    start = current;
    currentDates = [current];
  }

  ranges.push({
    startDate: start,
    endDate: currentDates[currentDates.length - 1],
    dates: [...currentDates],
  });

  return ranges;
}

export function buildDateToUsersMap(
  availabilities: Availability[],
  proposalId: string
): Map<string, Set<string>> {
  const dateToUsers = new Map<string, Set<string>>();

  availabilities
    .filter((availability) => availability.proposalId === proposalId)
    .forEach((availability) => {
      availability.dates.forEach((dateIso) => {
        if (!dateToUsers.has(dateIso)) {
          dateToUsers.set(dateIso, new Set<string>());
        }
        dateToUsers.get(dateIso)!.add(availability.userId);
      });
    });

  return dateToUsers;
}

export function computeSejourOverlapWindows(
  availabilities: Availability[],
  proposalId: string,
  options: OverlapWindowOptions = {}
): SejourOverlapWindow[] {
  const { minNights = 2, minParticipants = 2, maxWindows = 8 } = options;

  const dateToUsers = buildDateToUsersMap(availabilities, proposalId);
  const sortedDates = Array.from(dateToUsers.keys()).sort();
  const windows: SejourOverlapWindow[] = [];
  const windowKeys = new Set<string>();

  for (let startIndex = 0; startIndex < sortedDates.length; startIndex += 1) {
    const startDate = sortedDates[startIndex];
    let activeParticipants = new Set(dateToUsers.get(startDate) || []);
    if (activeParticipants.size < minParticipants) continue;

    for (let endIndex = startIndex; endIndex < sortedDates.length; endIndex += 1) {
      const endDate = sortedDates[endIndex];

      if (
        endIndex > startIndex &&
        !areConsecutiveDates(sortedDates[endIndex - 1], endDate)
      ) {
        break;
      }

      if (endIndex > startIndex) {
        const dateParticipants = dateToUsers.get(endDate) || new Set<string>();
        activeParticipants = new Set(
          Array.from(activeParticipants).filter((userId) => dateParticipants.has(userId))
        );
      }

      if (activeParticipants.size < minParticipants) {
        break;
      }

      const nights = differenceInCalendarDays(parseISO(endDate), parseISO(startDate));
      if (nights < minNights) {
        continue;
      }

      const participantUserIds = Array.from(activeParticipants).sort();
      const key = `${startDate}|${endDate}|${participantUserIds.join(',')}`;
      if (windowKeys.has(key)) continue;
      windowKeys.add(key);

      windows.push({
        startDate,
        endDate,
        nights,
        participantCount: participantUserIds.length,
        participantUserIds,
        label: formatWindowLabel(startDate, endDate, participantUserIds.length),
      });
    }
  }

  return windows
    .sort((a, b) => {
      if (b.participantCount !== a.participantCount) {
        return b.participantCount - a.participantCount;
      }
      if (b.nights !== a.nights) {
        return b.nights - a.nights;
      }
      return a.startDate.localeCompare(b.startDate);
    })
    .slice(0, maxWindows);
}

export function enumerateDatesInRange(startIso: string, endIso: string): string[] {
  const start = parseISO(startIso);
  const end = parseISO(endIso);
  const dates: string[] = [];

  for (
    let current = start;
    differenceInCalendarDays(end, current) >= 0;
    current = addDays(current, 1)
  ) {
    dates.push(format(current, 'yyyy-MM-dd'));
  }

  return dates;
}
