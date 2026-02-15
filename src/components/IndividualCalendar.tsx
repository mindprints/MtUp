import { useState } from 'react';
import { addMonths, subMonths } from 'date-fns';
import { useAuth } from '@/lib/AuthContext';
import { useProposals } from '@/lib/ProposalContext';
import { CalendarCell } from './CalendarCell';
import {
  getCalendarDays,
  formatMonthYear,
  formatDate,
  WEEKDAY_LABELS,
} from '@/lib/dateUtils';
import { generateId } from '@/lib/utils';
import type { Availability } from '@/types';

export function IndividualCalendar() {
  const { user } = useAuth();
  const { proposals, setAvailability, getUserAvailabilities } = useProposals();
  
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(
    proposals.length > 0 ? proposals[0].id : null
  );
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartDate, setDragStartDate] = useState<Date | null>(null);
  const [draggedDates, setDraggedDates] = useState<Set<string>>(new Set());

  if (!user) return null;

  // Auto-select first proposal if none selected
  if (!selectedProposalId && proposals.length > 0) {
    setSelectedProposalId(proposals[0].id);
  }

  const calendarDays = getCalendarDays(currentMonth);
  const userAvailabilities = getUserAvailabilities(user.id);

  // Build a map of date -> Set of proposalIds
  const dateToProposals = new Map<string, Set<string>>();
  userAvailabilities.forEach((avail) => {
    avail.dates.forEach((dateStr) => {
      if (!dateToProposals.has(dateStr)) {
        dateToProposals.set(dateStr, new Set());
      }
      dateToProposals.get(dateStr)!.add(avail.proposalId);
    });
  });

  const handlePreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const handleToday = () => {
    setCurrentMonth(new Date());
  };

  const handleCellClick = (date: Date, ctrlKey: boolean) => {
    if (!selectedProposalId) return;

    const dateStr = formatDate(date);
    const existingAvail = userAvailabilities.find((a) => a.proposalId === selectedProposalId);

    if (ctrlKey) {
      // Ctrl+click removes availability
      if (existingAvail && existingAvail.dates.includes(dateStr)) {
        const dates = existingAvail.dates.filter((d) => d !== dateStr);
        
        if (dates.length === 0) {
          // No dates left, we'll just set empty which storage will handle
          const updatedAvail: Availability = {
            ...existingAvail,
            dates: [],
          };
          setAvailability(updatedAvail);
        } else {
          const updatedAvail: Availability = {
            ...existingAvail,
            dates,
          };
          setAvailability(updatedAvail);
        }
      }
    } else {
      // Regular click adds availability
      if (existingAvail) {
        const dates = existingAvail.dates.includes(dateStr)
          ? existingAvail.dates // Already marked, do nothing (or could toggle off)
          : [...existingAvail.dates, dateStr]; // Add new date

        const updatedAvail: Availability = {
          ...existingAvail,
          dates,
        };
        setAvailability(updatedAvail);
      } else {
        // Create new availability
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

  const handleDragStart = (date: Date) => {
    if (!selectedProposalId) return;
    
    setIsDragging(true);
    setDragStartDate(date);
    const dateStr = formatDate(date);
    setDraggedDates(new Set([dateStr]));
  };

  const handleDragEnter = (date: Date) => {
    if (isDragging && selectedProposalId) {
      const dateStr = formatDate(date);
      setDraggedDates((prev) => new Set([...prev, dateStr]));
    }
  };

  const handleDragEnd = () => {
    if (!isDragging || !selectedProposalId) return;

    const existingAvail = userAvailabilities.find(
      (a) => a.proposalId === selectedProposalId
    );

    // Merge dragged dates with existing dates
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

    // Reset drag state
    setIsDragging(false);
    setDragStartDate(null);
    setDraggedDates(new Set());
  };

  return (
    <div className="space-y-4">
      {/* Calendar header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">
          {formatMonthYear(currentMonth)}
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePreviousMonth}
            className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Previous
          </button>
          <button
            onClick={handleToday}
            className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Today
          </button>
          <button
            onClick={handleNextMonth}
            className="px-3 py-1 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      </div>

      {/* Instructions */}
      {proposals.length > 0 && (
        <>
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-blue-800">
            <strong>How to mark availability:</strong> Select a proposal below, then click or drag on the calendar to mark your availability. Ctrl+click to remove.
          </div>

          {/* Proposal selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select proposal to mark:
            </label>
            <div className="flex flex-wrap gap-2">
              {proposals.map((proposal) => {
                const isSelected = selectedProposalId === proposal.id;
                return (
                  <button
                    key={proposal.id}
                    onClick={() => setSelectedProposalId(proposal.id)}
                    className={`
                      flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all
                      ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 shadow-md ring-2 ring-blue-200'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }
                    `}
                  >
                    <span className="text-2xl">{proposal.emoji}</span>
                    <span className="text-sm font-medium">{proposal.title}</span>
                    {isSelected && <span className="text-blue-600 text-xs">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {proposals.length === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-md p-3 text-sm text-gray-600">
          No proposals yet. Create a proposal to start marking your availability!
        </div>
      )}

      {/* Calendar grid */}
      <div className="bg-white border border-gray-300 rounded-lg overflow-hidden">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-300">
          {WEEKDAY_LABELS.map((day) => (
            <div
              key={day}
              className="py-2 text-center text-sm font-semibold text-gray-700"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7">
          {calendarDays.map((date) => {
            const dateStr = formatDate(date);
            const markedProposals = dateToProposals.get(dateStr) || new Set();
            
            // Add dragged dates
            const displayMarked = new Set(markedProposals);
            if (isDragging && draggedDates.has(dateStr) && selectedProposalId) {
              displayMarked.add(selectedProposalId);
            }

            return (
              <CalendarCell
                key={dateStr}
                date={date}
                currentMonth={currentMonth}
                proposals={proposals}
                markedProposals={displayMarked}
                onCellClick={handleCellClick}
                isDragging={isDragging}
                onDragStart={handleDragStart}
                onDragEnter={handleDragEnter}
                onDragEnd={handleDragEnd}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
