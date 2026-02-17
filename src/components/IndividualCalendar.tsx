import { useEffect, useRef, useState } from 'react';
import {
  addDays,
  addMonths,
  addYears,
  format,
  isBefore,
  parseISO,
  startOfDay,
  subDays,
  subMonths,
  subYears,
} from 'date-fns';
import { useAuth } from '@/lib/AuthContext';
import { useProposals } from '@/lib/ProposalContext';
import { storage } from '@/lib/storage';
import { CalendarCell } from './CalendarCell';
import { ActivityDetailsModal } from './ActivityDetailsModal';
import {
  getCalendarDays,
  formatMonthYear,
  formatDate,
  WEEKDAY_LABELS,
} from '@/lib/dateUtils';
import { generateId } from '@/lib/utils';
import type { Availability, Proposal, User } from '@/types';

type CalendarView = 'day' | 'month' | 'year';
type DisplayMode = 'selected' | 'all' | 'mine';

type IndividualCalendarProps = {
  selectedProposalId: string | null;
  onSelectedProposalIdChange: (proposalId: string | null) => void;
};

function getHourFromTimeLabel(timeLabel?: string): number | null {
  if (!timeLabel) return null;
  const value = timeLabel.trim().toLowerCase();
  const match = value.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (!match) return null;

  let hour = Number(match[1]);
  if (Number.isNaN(hour) || hour < 0 || hour > 24) return null;

  const suffix = match[3];
  if (suffix === 'pm' && hour < 12) {
    hour += 12;
  }
  if (suffix === 'am' && hour === 12) {
    hour = 0;
  }

  return hour >= 0 && hour <= 23 ? hour : null;
}

function proposalIncludesDate(proposal: Proposal, dateIso: string): boolean {
  const proposalDate = proposal.specifics?.date;
  if (!proposalDate) return false;

  if (proposalDate.includes(' to ')) {
    const [startDate, endDate] = proposalDate.split(' to ');
    if (!startDate || !endDate) return false;
    return dateIso >= startDate && dateIso <= endDate;
  }

  return proposalDate === dateIso;
}

export function IndividualCalendar({
  selectedProposalId,
  onSelectedProposalIdChange,
}: IndividualCalendarProps) {
  const { user } = useAuth();
  const { proposals, availabilities, setAvailability } = useProposals();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarView, setCalendarView] = useState<CalendarView>('month');
  const [displayMode, setDisplayMode] = useState<DisplayMode>('selected');
  const [isDragging, setIsDragging] = useState(false);
  const [draggedDates, setDraggedDates] = useState<Set<string>>(new Set());
  const [detailsProposalId, setDetailsProposalId] = useState<string | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const touchStartYRef = useRef<number | null>(null);
  const lastNavTimestampRef = useRef(0);
  const lastAutoJumpProposalIdRef = useRef<string | null>(null);

  if (!user) return null;

  const calendarDays = getCalendarDays(currentDate);
  const yearMonths = Array.from({ length: 12 }, (_, index) => {
    return new Date(currentDate.getFullYear(), index, 1);
  });
  const users = storage.getData().users;
  const totalUsers = users.length;
  const usersById = new Map<string, User>(users.map((u) => [u.id, u]));
  const proposalsById = new Map(proposals.map((proposal) => [proposal.id, proposal]));
  const userAvailabilities = availabilities.filter((a) => a.userId === user.id);
  const detailsProposal = detailsProposalId
    ? proposalsById.get(detailsProposalId) || null
    : null;

  // Build a map of date -> (proposalId -> users available)
  const dateToProposalUsers = new Map<string, Map<string, Set<User>>>();
  availabilities.forEach((avail) => {
    const availabilityUser = usersById.get(avail.userId);
    if (!availabilityUser) return;
    avail.dates.forEach((dateStr) => {
      if (!dateToProposalUsers.has(dateStr)) {
        dateToProposalUsers.set(dateStr, new Map<string, Set<User>>());
      }
      const proposalUsers = dateToProposalUsers.get(dateStr)!;
      if (!proposalUsers.has(avail.proposalId)) {
        proposalUsers.set(avail.proposalId, new Set<User>());
      }
      proposalUsers.get(avail.proposalId)!.add(availabilityUser);
    });
  });

  const proposalConsensusById = new Map<string, number>();
  proposals.forEach((proposal) => proposalConsensusById.set(proposal.id, 0));
  dateToProposalUsers.forEach((proposalUsersMap) => {
    proposalUsersMap.forEach((availableUsers, proposalId) => {
      const percentage = totalUsers === 0
        ? 0
        : Math.round((availableUsers.size / totalUsers) * 100);
      const existing = proposalConsensusById.get(proposalId) || 0;
      proposalConsensusById.set(proposalId, Math.max(existing, percentage));
    });
  });

  const getFilteredProposalUsersMap = (dateStr: string) => {
    const allProposalUsersMap = new Map(
      (dateToProposalUsers.get(dateStr) || new Map()).entries()
    );
    const filteredMap = new Map<string, Set<User>>();

    if (displayMode === 'all') {
      allProposalUsersMap.forEach((usersForProposal, proposalId) => {
        filteredMap.set(proposalId, usersForProposal);
      });
    } else if (displayMode === 'mine') {
      allProposalUsersMap.forEach((usersForProposal, proposalId) => {
        const proposal = proposalsById.get(proposalId);
        if (proposal?.createdBy === user.id) {
          filteredMap.set(proposalId, usersForProposal);
        }
      });
    } else if (selectedProposalId) {
      const selectedProposalUsers = allProposalUsersMap.get(selectedProposalId);
      if (selectedProposalUsers) {
        filteredMap.set(selectedProposalId, selectedProposalUsers);
      }
    }

    return filteredMap;
  };

  const handlePreviousPeriod = () => {
    if (calendarView === 'day') {
      setCurrentDate(subDays(currentDate, 1));
      return;
    }
    if (calendarView === 'month') {
      setCurrentDate(subMonths(currentDate, 1));
      return;
    }
    setCurrentDate(subYears(currentDate, 1));
  };

  const handleNextPeriod = () => {
    if (calendarView === 'day') {
      setCurrentDate(addDays(currentDate, 1));
      return;
    }
    if (calendarView === 'month') {
      setCurrentDate(addMonths(currentDate, 1));
      return;
    }
    setCurrentDate(addYears(currentDate, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const navigateByDelta = (deltaY: number) => {
    const now = Date.now();
    if (now - lastNavTimestampRef.current < 220) return;
    lastNavTimestampRef.current = now;

    if (deltaY > 0) {
      handleNextPeriod();
      return;
    }
    if (deltaY < 0) {
      handlePreviousPeriod();
    }
  };

  const handleCalendarWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (Math.abs(e.deltaY) < 12) return;
    e.preventDefault();
    navigateByDelta(e.deltaY);
  };

  const handleCalendarTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    touchStartYRef.current = e.changedTouches[0]?.clientY ?? null;
  };

  const handleCalendarTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    const startY = touchStartYRef.current;
    const endY = e.changedTouches[0]?.clientY;
    touchStartYRef.current = null;

    if (startY === null || endY === undefined) return;
    const delta = startY - endY;
    if (Math.abs(delta) < 40) return;
    navigateByDelta(delta);
  };

  const handleCellClick = (date: Date, ctrlKey: boolean) => {
    if (!selectedProposalId) return;

    const dateStr = formatDate(date);
    const existingAvail = userAvailabilities.find((a) => a.proposalId === selectedProposalId);

    if (ctrlKey) {
      if (existingAvail && existingAvail.dates.includes(dateStr)) {
        const dates = existingAvail.dates.filter((d) => d !== dateStr);

        const updatedAvail: Availability = {
          ...existingAvail,
          dates,
        };
        setAvailability(updatedAvail);
      }
    } else {
      if (existingAvail) {
        const dates = existingAvail.dates.includes(dateStr)
          ? existingAvail.dates
          : [...existingAvail.dates, dateStr];

        const updatedAvail: Availability = {
          ...existingAvail,
          dates,
        };
        setAvailability(updatedAvail);
      } else {
        const newAvail: Availability = {
          id: generateId(),
          userId: user.id,
          proposalId: selectedProposalId,
          dates: [dateStr],
        };
        setAvailability(newAvail);
      }
    }
  };

  const handleProposalClick = (
    proposalId: string,
    date: Date,
    ctrlKey: boolean
  ) => {
    const dateStr = formatDate(date);
    const existingAvail = userAvailabilities.find((a) => a.proposalId === proposalId);
    const isCurrentlyMarked = Boolean(existingAvail?.dates.includes(dateStr));

    if (ctrlKey) {
      if (!existingAvail || !isCurrentlyMarked) return;
      setAvailability({
        ...existingAvail,
        dates: existingAvail.dates.filter((d) => d !== dateStr),
      });
      return;
    }

    if (isCurrentlyMarked) {
      setDetailsProposalId(proposalId);
      setIsDetailsModalOpen(true);
      return;
    }

    if (existingAvail) {
      setAvailability({
        ...existingAvail,
        dates: [...existingAvail.dates, dateStr],
      });
      return;
    }

    setAvailability({
      id: generateId(),
      userId: user.id,
      proposalId,
      dates: [dateStr],
    });
  };

  const handleDragStart = (date: Date) => {
    if (!selectedProposalId || calendarView !== 'month') return;

    setIsDragging(true);
    const dateStr = formatDate(date);
    setDraggedDates(new Set([dateStr]));
  };

  const handleDragEnter = (date: Date) => {
    if (isDragging && selectedProposalId && calendarView === 'month') {
      const dateStr = formatDate(date);
      setDraggedDates((prev) => new Set([...prev, dateStr]));
    }
  };

  const handleDragEnd = () => {
    if (!isDragging || !selectedProposalId) return;

    const existingAvail = userAvailabilities.find(
      (a) => a.proposalId === selectedProposalId
    );

    const allDates = new Set([
      ...(existingAvail?.dates || []),
      ...Array.from(draggedDates),
    ]);

    const updatedAvail: Availability = {
      id: existingAvail?.id || generateId(),
      userId: user.id,
      proposalId: selectedProposalId,
      dates: Array.from(allDates),
    };

    setAvailability(updatedAvail);

    setIsDragging(false);
    setDraggedDates(new Set());
  };

  const isDateVisibleInCurrentView = (dateIso: string): boolean => {
    const date = parseISO(dateIso);
    if (calendarView === 'day') {
      return formatDate(currentDate) === dateIso;
    }
    if (calendarView === 'month') {
      return (
        currentDate.getFullYear() === date.getFullYear() &&
        currentDate.getMonth() === date.getMonth()
      );
    }
    return currentDate.getFullYear() === date.getFullYear();
  };

  useEffect(() => {
    if (!selectedProposalId) {
      lastAutoJumpProposalIdRef.current = null;
      return;
    }
    if (lastAutoJumpProposalIdRef.current === selectedProposalId) return;

    const proposalDates = Array.from(
      new Set(
        availabilities
          .filter((availability) => availability.proposalId === selectedProposalId)
          .flatMap((availability) => availability.dates)
      )
    ).sort();

    if (proposalDates.length === 0) {
      lastAutoJumpProposalIdRef.current = selectedProposalId;
      return;
    }
    const hasVisibleDate = proposalDates.some((dateIso) =>
      isDateVisibleInCurrentView(dateIso)
    );

    if (!hasVisibleDate) {
      setCurrentDate(parseISO(proposalDates[0]));
    }
    lastAutoJumpProposalIdRef.current = selectedProposalId;
  }, [selectedProposalId, availabilities, calendarView]);

  const selectedDateIso = formatDate(currentDate);
  const confirmedOnDate = proposals.filter(
    (proposal) => proposal.status === 'confirmed' && proposalIncludesDate(proposal, selectedDateIso)
  );

  const confirmedAllDay = confirmedOnDate.filter(
    (proposal) => getHourFromTimeLabel(proposal.specifics?.time) === null
  );

  const confirmedByHour = new Map<number, Proposal[]>();
  confirmedOnDate.forEach((proposal) => {
    const hour = getHourFromTimeLabel(proposal.specifics?.time);
    if (hour === null) return;
    if (!confirmedByHour.has(hour)) {
      confirmedByHour.set(hour, []);
    }
    confirmedByHour.get(hour)!.push(proposal);
  });

  return (
    <div className="space-y-4">
      {proposals.length > 0 && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 dark:text-slate-200">
              Select proposal to mark:
            </label>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setDisplayMode(displayMode === 'all' ? 'selected' : 'all')}
                className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                  displayMode === 'all'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-700'
                }`}
              >
                Display All
              </button>
              <button
                type="button"
                onClick={() => setDisplayMode(displayMode === 'mine' ? 'selected' : 'mine')}
                className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                  displayMode === 'mine'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-700'
                }`}
              >
                My Proposals
              </button>
              <button
                type="button"
                onClick={() => setDisplayMode('selected')}
                className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                  displayMode === 'selected'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-700'
                }`}
              >
                Selected
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
              {proposals.map((proposal) => {
                const isSelected = selectedProposalId === proposal.id;
                const proposalConsensus = proposalConsensusById.get(proposal.id) || 0;
                const isConfirmed = proposal.status === 'confirmed';
                return (
                  <button
                    key={proposal.id}
                    onClick={() => onSelectedProposalIdChange(proposal.id)}
                    className={`
                      text-left px-4 py-3 rounded-lg border-2 transition-all
                      ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 shadow-md ring-2 ring-blue-200 dark:bg-blue-950/30 dark:ring-blue-800'
                          : 'border-gray-200 bg-white hover:border-gray-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-500'
                      }
                    `}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">{proposal.emoji}</span>
                      <span className="text-sm font-medium text-gray-900 dark:text-slate-100">{proposal.title}</span>
                      {isSelected && <span className="text-blue-600 text-xs">✓</span>}
                    </div>
                    {isConfirmed && (
                      <div className="mb-2 text-xs">
                        <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 px-2 py-0.5 font-medium">
                          Confirmed
                        </span>
                        {(proposal.specifics?.date || proposal.specifics?.time) && (
                          <div className="mt-1 text-gray-600 dark:text-slate-300">
                            {proposal.specifics?.date && <span>{proposal.specifics.date}</span>}
                            {proposal.specifics?.date && proposal.specifics?.time && <span> • </span>}
                            {proposal.specifics?.time && <span>{proposal.specifics.time}</span>}
                          </div>
                        )}
                      </div>
                    )}
                    <div>
                      <div className="flex items-center justify-between text-xs text-gray-600 dark:text-slate-300">
                        <span>Consensus</span>
                        <span>{proposalConsensus}%</span>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-gray-200 dark:bg-slate-700">
                        <div
                          className="h-2 rounded-full bg-blue-500 transition-all"
                          style={{ width: `${proposalConsensus}%` }}
                        />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

          </div>
        </>
      )}

      {proposals.length === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-md p-3 text-sm text-gray-600 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-300">
          No proposals yet. Create a proposal to start marking your availability!
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-3xl font-semibold text-gray-900 dark:text-slate-100">
          {calendarView === 'day'
            ? format(currentDate, 'EEEE, MMMM d, yyyy')
            : calendarView === 'month'
            ? formatMonthYear(currentDate)
            : currentDate.getFullYear()}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-md border border-gray-300 overflow-hidden dark:border-slate-600">
            {(['day', 'month', 'year'] as CalendarView[]).map((view) => (
              <button
                key={view}
                type="button"
                onClick={() => setCalendarView(view)}
                className={`px-3 py-1.5 text-sm capitalize transition-colors ${
                  calendarView === view
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {view}
              </button>
            ))}
          </div>
          <button
            onClick={handlePreviousPeriod}
            className="px-3 py-1 text-lg font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-700"
            aria-label="Previous period"
            title="Previous"
          >
            ◀
          </button>
          <button
            onClick={handleToday}
            className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-700"
          >
            Today
          </button>
          <button
            onClick={handleNextPeriod}
            className="px-3 py-1 text-lg font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-700"
            aria-label="Next period"
            title="Next"
          >
            ▶
          </button>
        </div>
      </div>

      {calendarView === 'month' && (
        <div
          onWheel={handleCalendarWheel}
          onTouchStart={handleCalendarTouchStart}
          onTouchEnd={handleCalendarTouchEnd}
          className="bg-white border border-gray-300 rounded-lg overflow-hidden dark:bg-slate-900 dark:border-slate-700"
        >
          <div className="grid grid-cols-7 bg-amber-100 border-b border-amber-300 dark:bg-amber-900/40 dark:border-amber-800">
            {WEEKDAY_LABELS.map((day) => (
              <div
                key={day}
                className="py-2 text-center text-sm font-semibold text-amber-900 dark:text-amber-200"
              >
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {calendarDays.map((date) => {
              const dateStr = formatDate(date);
              const proposalUsersMap = getFilteredProposalUsersMap(dateStr);

              if (isDragging && draggedDates.has(dateStr) && selectedProposalId) {
                const existingUsers = proposalUsersMap.get(selectedProposalId);
                const previewUsers = new Set(existingUsers ? Array.from(existingUsers) : []);
                previewUsers.add(user);
                proposalUsersMap.set(selectedProposalId, previewUsers);
              }

              return (
                <CalendarCell
                  key={dateStr}
                  date={date}
                  currentMonth={currentDate}
                  proposals={proposals}
                  proposalUsersMap={proposalUsersMap}
                  currentUser={user}
                  onCellClick={handleCellClick}
                  onProposalClick={handleProposalClick}
                  isDragging={isDragging}
                  onDragStart={handleDragStart}
                  onDragEnter={handleDragEnter}
                  onDragEnd={handleDragEnd}
                />
              );
            })}
          </div>
        </div>
      )}

      {calendarView === 'day' && (
        <div
          onWheel={handleCalendarWheel}
          onTouchStart={handleCalendarTouchStart}
          onTouchEnd={handleCalendarTouchEnd}
          className="bg-white border border-gray-300 rounded-lg overflow-hidden dark:bg-slate-900 dark:border-slate-700"
        >
          <div className="bg-amber-100 border-b border-amber-300 px-3 py-2 text-sm font-semibold text-amber-900 dark:bg-amber-900/40 dark:border-amber-800 dark:text-amber-200">
            Day View Hours
          </div>

          {confirmedAllDay.length > 0 && (
            <div className="px-3 py-2 border-b border-gray-200 dark:border-slate-700 bg-emerald-50 dark:bg-emerald-900/20">
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Confirmed Activities (All-day)</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {confirmedAllDay.map((proposal) => (
                  <span
                    key={proposal.id}
                    className="inline-flex items-center gap-1 rounded-full bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 px-2 py-0.5 text-xs text-emerald-700 dark:text-emerald-300"
                  >
                    <span>{proposal.emoji}</span>
                    <span>{proposal.title}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="max-h-[560px] overflow-y-auto">
            {Array.from({ length: 24 }, (_, hour) => {
              const hourLabel = format(new Date(2020, 0, 1, hour), 'ha');
              const hourActivities = confirmedByHour.get(hour) || [];
              return (
                <div
                  key={hour}
                  className="grid grid-cols-[70px_1fr] border-b border-gray-200 dark:border-slate-700"
                >
                  <div className="px-3 py-3 text-xs font-medium text-gray-500 dark:text-slate-400 bg-amber-50/50 dark:bg-amber-900/10">
                    {hourLabel}
                  </div>
                  <div className="px-3 py-2 min-h-[44px]">
                    {hourActivities.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {hourActivities.map((proposal) => (
                          <span
                            key={proposal.id}
                            className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 px-2 py-0.5 text-xs"
                          >
                            <span>{proposal.emoji}</span>
                            <span>{proposal.title}</span>
                            {proposal.specifics?.time && <span>({proposal.specifics.time})</span>}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-300 dark:text-slate-700">&nbsp;</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {calendarView === 'year' && (
        <div
          onWheel={handleCalendarWheel}
          onTouchStart={handleCalendarTouchStart}
          onTouchEnd={handleCalendarTouchEnd}
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
        >
          {yearMonths.map((monthStart) => {
            const monthDays = getCalendarDays(monthStart);
            return (
              <div
                key={monthStart.toISOString()}
                className="bg-white border border-gray-300 rounded-lg overflow-hidden dark:bg-slate-900 dark:border-slate-700"
              >
                <div className="px-3 py-2 text-sm font-semibold text-teal-900 bg-teal-100 border-b border-teal-300 dark:bg-teal-900/40 dark:border-teal-800 dark:text-teal-200">
                  {formatMonthYear(monthStart)}
                </div>
                <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200 dark:bg-slate-800 dark:border-slate-700">
                  {WEEKDAY_LABELS.map((day) => (
                    <div key={`${monthStart.toISOString()}-${day}`} className="py-1 text-center text-[10px] font-semibold text-gray-500 dark:text-slate-400">
                      {day.slice(0, 1)}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {monthDays.map((date) => {
                    const dateStr = formatDate(date);
                    const dayMap = getFilteredProposalUsersMap(dateStr);
                    const isInMonth = date.getMonth() === monthStart.getMonth();
                    const isPast = isBefore(startOfDay(date), startOfDay(new Date()));
                    return (
                      <button
                        key={`${monthStart.toISOString()}-${dateStr}`}
                        type="button"
                        onClick={(e) => handleCellClick(date, e.ctrlKey || e.metaKey)}
                        className={`h-10 border border-gray-100 p-1 text-left transition-colors dark:border-slate-800 ${
                          isInMonth
                            ? 'bg-white hover:bg-gray-50 dark:bg-slate-900 dark:hover:bg-slate-800'
                            : 'bg-gray-50 text-gray-400 dark:bg-slate-900/40 dark:text-slate-600'
                        } ${isPast ? 'opacity-50 cursor-not-allowed' : ''}`}
                        disabled={!isInMonth || isPast || !selectedProposalId}
                      >
                        <div className="text-[10px]">{date.getDate()}</div>
                        {dayMap.size > 0 && (
                          <div className="mt-1 h-1.5 w-full rounded-full bg-blue-200 dark:bg-blue-900/60" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {detailsProposal && (
        <ActivityDetailsModal
          isOpen={isDetailsModalOpen}
          onClose={() => {
            setIsDetailsModalOpen(false);
            setDetailsProposalId(null);
          }}
          proposal={detailsProposal}
          currentUser={user}
        />
      )}
    </div>
  );
}
