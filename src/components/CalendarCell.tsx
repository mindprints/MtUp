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
  onProposalClick: (proposalId: string, date: Date, ctrlKey: boolean) => void;
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
  onProposalClick,
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
    if (!isDragging) {
      onCellClick(date, e.ctrlKey || e.metaKey);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Drag interactions are disabled at the parent, but keep handler shape stable.
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
        }))
        .filter((item) => item.proposal)
        .slice(0, 6) // Max 6 proposals per cell
    : [];

  const hasSejour = proposalsWithUsers.some((item) => item.proposal!.type === 'sejour');

  return (
    <div
      className={`
        relative min-h-[100px] border border-gray-200 dark:border-slate-700 p-2 select-none transition-colors
        ${!isCurrentMonth ? 'bg-gray-50 text-gray-400 dark:bg-slate-900 dark:text-slate-600' : 'bg-white dark:bg-slate-900'}
        ${hasSejour && !isPast ? 'bg-teal-50/70 dark:bg-teal-950/20' : ''}
        ${today ? 'ring-2 ring-blue-500' : ''}
        ${isPast ? 'bg-gray-100 dark:bg-slate-800 opacity-50' : 'hover:bg-gray-50 dark:hover:bg-slate-800'}
      `}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onMouseEnter={handleMouseEnter}
      onMouseUp={handleMouseUp}
      title={isPast ? 'Past date' : ''}
    >
      <div className={`text-sm font-medium ${today ? 'text-blue-600' : isPast ? 'text-gray-400 dark:text-slate-500 line-through' : 'dark:text-slate-100'}`}>
        {dayNumber}
      </div>

      {/* Display proposals with user counts */}
      {proposalsWithUsers.length > 0 && (
        <div className="mt-1 space-y-1">
          {proposalsWithUsers.map((item) => {
            const isCurrentUserMarked = item.users.some((u) => u.id === currentUser.id);
            const otherUsers = item.users.filter((u) => u.id !== currentUser.id);
            const visibleOtherUsers = otherUsers.slice(0, 2);
            return (
              <div
                key={item.proposal!.id}
                className={`w-full flex items-center gap-1 whitespace-nowrap overflow-hidden rounded px-1 ${
                  item.proposal!.type === 'sejour'
                    ? 'bg-teal-100/80 border border-dashed border-teal-400 dark:bg-teal-900/30 dark:border-teal-700'
                    : ''
                } ${
                  isCurrentUserMarked ? 'opacity-100' : 'opacity-50'
                }`}
                title={`${item.proposal!.title}: ${item.users
                  .map((u) => (u.id === currentUser.id ? 'Me' : u.name))
                  .join(', ')}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onProposalClick(item.proposal!.id, date, e.ctrlKey || e.metaKey);
                }}
              >
                <span className="text-lg leading-none shrink-0">{item.proposal!.emoji}</span>
                <div className="flex items-center gap-0.5 shrink-0">
                  {visibleOtherUsers.map((user) => (
                    <div
                      key={user.id}
                      className="w-4 h-4 rounded-full text-white text-[8px] flex items-center justify-center font-medium bg-gray-400"
                      title={user.name}
                    >
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                  ))}
                  {otherUsers.length > visibleOtherUsers.length && (
                    <span className="text-[10px] text-gray-500 dark:text-slate-400 ml-0.5">
                      +{otherUsers.length - visibleOtherUsers.length}
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
