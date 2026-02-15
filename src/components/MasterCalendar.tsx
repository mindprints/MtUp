import { useState } from 'react';
import { addMonths, subMonths } from 'date-fns';
import { useProposals } from '@/lib/ProposalContext';
import { storage } from '@/lib/storage';
import { MasterCalendarCell } from './MasterCalendarCell';
import { DateDetailModal } from './DateDetailModal';
import {
  getCalendarDays,
  formatMonthYear,
  formatDate,
  WEEKDAY_LABELS,
} from '@/lib/dateUtils';
import type { User } from '@/types';

export function MasterCalendar() {
  const { proposals, availabilities } = useProposals();
  const users = storage.getData().users;

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(
    proposals.length > 0 ? proposals[0].id : null
  );
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const calendarDays = getCalendarDays(currentMonth);
  const selectedProposal = proposals.find((p) => p.id === selectedProposalId) || null;

  // Build a map of date -> users available for the selected proposal
  const dateToUsers = new Map<string, User[]>();

  if (selectedProposalId) {
    const proposalAvailabilities = availabilities.filter(
      (a) => a.proposalId === selectedProposalId
    );

    proposalAvailabilities.forEach((avail) => {
      const user = users.find((u) => u.id === avail.userId);
      if (user) {
        avail.dates.forEach((dateStr) => {
          if (!dateToUsers.has(dateStr)) {
            dateToUsers.set(dateStr, []);
          }
          dateToUsers.get(dateStr)!.push(user);
        });
      }
    });
  }

  const handlePreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const handleToday = () => {
    setCurrentMonth(new Date());
  };

  const handleCellClick = (date: Date) => {
    setSelectedDate(date);
    setDetailModalOpen(true);
  };

  const getAvailableUsers = (date: Date): User[] => {
    const dateStr = formatDate(date);
    return dateToUsers.get(dateStr) || [];
  };

  const getUnavailableUsers = (date: Date): User[] => {
    const availableUsers = getAvailableUsers(date);
    const availableUserIds = new Set(availableUsers.map((u) => u.id));
    return users.filter((u) => !availableUserIds.has(u.id));
  };

  // Find best dates (highest consensus)
  const getBestDates = () => {
    if (!selectedProposalId) return [];

    const dateScores: Array<{ date: string; count: number }> = [];

    dateToUsers.forEach((users, dateStr) => {
      dateScores.push({ date: dateStr, count: users.length });
    });

    return dateScores
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .filter((d) => d.count >= Math.ceil(users.length * 0.6)); // At least 60% consensus
  };

  const bestDates = getBestDates();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Master Calendar</h2>
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

      {/* Proposal selector */}
      {proposals.length > 0 ? (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            View proposal:
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
                        ? 'border-blue-500 bg-blue-50 shadow-sm'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }
                  `}
                >
                  <span className="text-2xl">{proposal.emoji}</span>
                  <span className="text-sm font-medium">{proposal.title}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-md p-4 text-sm text-gray-600">
          No proposals yet. Create a proposal and mark your availability to see the master
          calendar!
        </div>
      )}

      {/* Best dates highlight */}
      {bestDates.length > 0 && selectedProposal && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-green-900 mb-2">
            🎯 Best Dates (60%+ consensus)
          </h3>
          <div className="flex flex-wrap gap-2">
            {bestDates.map((item) => {
              const date = new Date(item.date);
              return (
                <div
                  key={item.date}
                  className="px-3 py-1.5 bg-white border border-green-300 rounded text-sm"
                >
                  {date.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}{' '}
                  <span className="font-semibold text-green-700">
                    ({item.count}/{users.length})
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Consensus Legend</h3>
        <div className="grid grid-cols-5 gap-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-100 border border-green-300 rounded"></div>
            <span>100%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-50 border border-green-200 rounded"></div>
            <span>80%+</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-50 border border-yellow-200 rounded"></div>
            <span>60%+</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-orange-50 border border-orange-200 rounded"></div>
            <span>40%+</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-50 border border-red-200 rounded"></div>
            <span>&lt;40%</span>
          </div>
        </div>
      </div>

      {selectedProposal && (
        <>
          <div className="text-center text-sm text-gray-600">
            Showing availability for <strong>{selectedProposal.title}</strong>
            <br />
            Click any date to see detailed availability
          </div>

          {/* Month label */}
          <h3 className="text-lg font-semibold text-gray-900 text-center">
            {formatMonthYear(currentMonth)}
          </h3>

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
                const availableUsers = getAvailableUsers(date);
                return (
                  <MasterCalendarCell
                    key={formatDate(date)}
                    date={date}
                    currentMonth={currentMonth}
                    proposal={selectedProposal}
                    availableUsers={availableUsers}
                    totalUsers={users.length}
                    onCellClick={handleCellClick}
                  />
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* Date detail modal */}
      {selectedDate && selectedProposal && (
        <DateDetailModal
          isOpen={detailModalOpen}
          onClose={() => setDetailModalOpen(false)}
          date={selectedDate}
          proposal={selectedProposal}
          availableUsers={getAvailableUsers(selectedDate)}
          unavailableUsers={getUnavailableUsers(selectedDate)}
        />
      )}
    </div>
  );
}
