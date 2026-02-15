import { Modal } from './Modal';
import type { Proposal, User } from '@/types';
import { format } from 'date-fns';

type DateDetailModalProps = {
  isOpen: boolean;
  onClose: () => void;
  date: Date;
  proposal: Proposal | null;
  availableUsers: User[];
  unavailableUsers: User[];
};

export function DateDetailModal({
  isOpen,
  onClose,
  date,
  proposal,
  availableUsers,
  unavailableUsers,
}: DateDetailModalProps) {
  if (!proposal) return null;

  const dateStr = format(date, 'EEEE, MMMM d, yyyy');
  const totalUsers = availableUsers.length + unavailableUsers.length;
  const percentage = totalUsers > 0 ? (availableUsers.length / totalUsers) * 100 : 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={dateStr}>
      <div className="space-y-4">
        {/* Proposal info */}
        <div className="flex items-center gap-3 pb-4 border-b">
          <span className="text-4xl">{proposal.emoji}</span>
          <div>
            <h3 className="font-semibold text-lg text-gray-900">{proposal.title}</h3>
            <p className="text-sm text-gray-600 capitalize">{proposal.type}</p>
          </div>
        </div>

        {/* Consensus meter */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">Consensus</span>
            <span className="text-sm font-semibold text-gray-900">
              {availableUsers.length}/{totalUsers} ({Math.round(percentage)}%)
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${
                percentage === 100
                  ? 'bg-green-500'
                  : percentage >= 80
                  ? 'bg-green-400'
                  : percentage >= 60
                  ? 'bg-yellow-400'
                  : percentage >= 40
                  ? 'bg-orange-400'
                  : 'bg-red-400'
              }`}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

        {/* Available users */}
        {availableUsers.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">
              Available ({availableUsers.length})
            </h4>
            <div className="space-y-2">
              {availableUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded"
                >
                  <div className="w-8 h-8 rounded-full bg-green-500 text-white text-sm flex items-center justify-center font-medium">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-gray-900">{user.name}</span>
                  {user.isAdmin && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                      Admin
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Unavailable users */}
        {unavailableUsers.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">
              Not Available ({unavailableUsers.length})
            </h4>
            <div className="space-y-2">
              {unavailableUsers.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center gap-2 p-2 bg-gray-50 border border-gray-200 rounded opacity-60"
                >
                  <div className="w-8 h-8 rounded-full bg-gray-400 text-white text-sm flex items-center justify-center font-medium">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-gray-700">{user.name}</span>
                  {user.isAdmin && (
                    <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">
                      Admin
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {availableUsers.length === 0 && unavailableUsers.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p>No availability data for this date</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
