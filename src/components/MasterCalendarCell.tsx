import type { Proposal, User } from '@/types';
import { formatDayOfMonth, isDateInCurrentMonth, isDateToday } from '@/lib/dateUtils';
import { isBefore, startOfDay } from 'date-fns';

type MasterCalendarCellProps = {
  date: Date;
  currentMonth: Date;
  proposal: Proposal | null;
  availableUsers: User[];
  totalUsers: number;
  onCellClick: (date: Date) => void;
};

export function MasterCalendarCell({
  date,
  currentMonth,
  proposal,
  availableUsers,
  totalUsers,
  onCellClick,
}: MasterCalendarCellProps) {
  const isCurrentMonth = isDateInCurrentMonth(date, currentMonth);
  const today = isDateToday(date);
  const dayNumber = formatDayOfMonth(date);
  const isPast = isBefore(startOfDay(date), startOfDay(new Date()));

  const availableCount = availableUsers.length;
  const hasAvailability = availableCount > 0;

  // Determine background color based on consensus level
  const getConsensusColor = () => {
    if (!hasAvailability || !proposal || isPast) return '';
    
    const percentage = availableCount / totalUsers;
    
    if (percentage === 1) return 'bg-green-100 border-green-300'; // 100% consensus
    if (percentage >= 0.8) return 'bg-green-50 border-green-200'; // 80%+ consensus
    if (percentage >= 0.6) return 'bg-yellow-50 border-yellow-200'; // 60%+ consensus
    if (percentage >= 0.4) return 'bg-orange-50 border-orange-200'; // 40%+ consensus
    return 'bg-red-50 border-red-200'; // Less than 40%
  };

  return (
    <div
      className={`
        relative min-h-[100px] border p-2 select-none transition-all
        ${!isCurrentMonth ? 'bg-gray-50 text-gray-400' : 'bg-white'}
        ${today ? 'ring-2 ring-blue-500' : ''}
        ${isPast ? 'bg-gray-100 opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow-md'}
        ${hasAvailability && proposal ? getConsensusColor() : 'border-gray-200'}
      `}
      onClick={() => !isPast && onCellClick(date)}
      title={isPast ? 'Past date' : ''}
    >
      <div className={`text-sm font-medium mb-1 ${today ? 'text-blue-600' : isPast ? 'text-gray-400 line-through' : ''}`}>
        {dayNumber}
      </div>

      {proposal && hasAvailability && (
        <div className="space-y-2">
          {/* Emoji and count */}
          <div className="flex items-center gap-2">
            <span className="text-2xl leading-none">{proposal.emoji}</span>
            <span className="text-sm font-semibold text-gray-700">
              {availableCount}/{totalUsers}
            </span>
          </div>

          {/* User avatars */}
          <div className="flex flex-wrap gap-1">
            {availableUsers.map((user) => (
              <div
                key={user.id}
                className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center font-medium"
                title={user.name}
              >
                {user.name.charAt(0).toUpperCase()}
              </div>
            ))}
          </div>
        </div>
      )}

      {!proposal && (
        <div className="text-xs text-gray-400 mt-2">
          Select a proposal
        </div>
      )}
    </div>
  );
}
