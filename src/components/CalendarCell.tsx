import type { Proposal, User } from '@/types';
import { formatDayOfMonth, isDateInCurrentMonth, isDateToday } from '@/lib/dateUtils';
import { isBefore, startOfDay } from 'date-fns';

type CalendarCellProps = {
  date: Date;
  currentMonth: Date;
  proposals: Proposal[];
  proposalUsersMap: Map<string, Set<User>>; // proposalId -> Set of users available
  currentUser: User;
  onCellClick: (date: Date, ctrlKey: boolean) => void;
  isDragging: boolean;
  onDragStart: (date: Date) => void;
  onDragEnter: (date: Date) => void;
  onDragEnd: () => void;
};

export function CalendarCell({
  date,
  currentMonth,
  proposals,
  proposalUsersMap,
  currentUser,
  onCellClick,
  isDragging,
  onDragStart,
  onDragEnter,
  onDragEnd,
}: CalendarCellProps) {

  const isCurrentMonth = isDateInCurrentMonth(date, currentMonth);
  const today = isDateToday(date);
  const dayNumber = formatDayOfMonth(date);
  const isPast = isBefore(startOfDay(date), startOfDay(new Date()));

  const handleClick = (e: React.MouseEvent) => {
    if (!isDragging && !isPast) {
      onCellClick(date, e.ctrlKey || e.metaKey);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only start drag on left click without ctrl and not in past
    if (e.button === 0 && !e.ctrlKey && !e.metaKey && !isPast) {
      onDragStart(date);
    }
  };

  const handleMouseEnter = () => {
    if (isDragging) {
      onDragEnter(date);
    }
  };

  const handleMouseUp = () => {
    if (isDragging) {
      onDragEnd();
    }
  };

  // Get proposals with users to display
  const proposalsWithUsers = proposalUsersMap 
    ? Array.from(proposalUsersMap.entries())
        .map(([proposalId, users]) => ({
          proposal: proposals.find((p) => p.id === proposalId),
          users: Array.from(users),
          userCount: users.size,
        }))
        .filter((item) => item.proposal)
        .slice(0, 6) // Max 6 proposals per cell
    : [];

  return (
    <div
      className={`
        relative min-h-[100px] border border-gray-200 p-2 select-none transition-colors
        ${!isCurrentMonth ? 'bg-gray-50 text-gray-400' : 'bg-white'}
        ${today ? 'ring-2 ring-blue-500' : ''}
        ${isPast ? 'bg-gray-100 opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50'}
      `}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onMouseEnter={handleMouseEnter}
      onMouseUp={handleMouseUp}
      title={isPast ? 'Past date - cannot be scheduled' : ''}
    >
      <div className={`text-sm font-medium ${today ? 'text-blue-600' : isPast ? 'text-gray-400 line-through' : ''}`}>
        {dayNumber}
      </div>

      {/* Display proposals with user counts */}
      {proposalsWithUsers.length > 0 && (
        <div className="mt-1 space-y-1">
          {proposalsWithUsers.map((item) => {
            const isCurrentUserMarked = item.users.some((u) => u.id === currentUser.id);
            return (
              <div
                key={item.proposal!.id}
                className={`flex items-center gap-1 ${
                  isCurrentUserMarked ? 'opacity-100' : 'opacity-50'
                }`}
                title={`${item.proposal!.title}: ${item.users.map((u) => u.name).join(', ')}`}
              >
                <span className="text-lg leading-none">{item.proposal!.emoji}</span>
                <div className="flex items-center gap-0.5">
                  {item.users.slice(0, 3).map((user) => (
                    <div
                      key={user.id}
                      className={`w-4 h-4 rounded-full text-white text-[8px] flex items-center justify-center font-medium ${
                        user.id === currentUser.id ? 'bg-blue-500 ring-1 ring-blue-300' : 'bg-gray-400'
                      }`}
                      title={user.name}
                    >
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                  ))}
                  {item.userCount > 3 && (
                    <span className="text-[10px] text-gray-500 ml-0.5">
                      +{item.userCount - 3}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
