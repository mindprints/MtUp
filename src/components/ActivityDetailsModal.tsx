import { useState } from 'react';
import { Modal } from './Modal';
import { ResolverDecisionPanel } from '@/components/resolver/ResolverDecisionPanel';
import type { DecisionDimension, Proposal, User } from '@/types';

type ActivityDetailsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  proposal: Proposal;
  currentUser: User;
};

const DIMENSIONS: Array<{ id: DecisionDimension; label: string }> = [
  { id: 'time', label: 'Time' },
  { id: 'place', label: 'Place' },
  { id: 'requirement', label: 'Requirements' },
];

export function ActivityDetailsModal({
  isOpen,
  onClose,
  proposal,
  currentUser,
}: ActivityDetailsModalProps) {
  const [activeDimension, setActiveDimension] = useState<DecisionDimension>('time');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Activity Details">
      <div className="space-y-4">
        <div className="rounded-md border border-gray-200 p-3 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{proposal.emoji}</span>
            <div>
              <p className="font-semibold text-gray-900 dark:text-slate-100">{proposal.title}</p>
              <p className="text-xs capitalize text-gray-600 dark:text-slate-300">{proposal.type}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {DIMENSIONS.map((dimension) => {
            const isActive = activeDimension === dimension.id;
            return (
              <button
                key={dimension.id}
                type="button"
                onClick={() => setActiveDimension(dimension.id)}
                className={`rounded-md border px-3 py-1.5 text-sm ${
                  isActive
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {dimension.label}
              </button>
            );
          })}
        </div>

        <ResolverDecisionPanel
          proposal={proposal}
          dimension={activeDimension}
          currentUser={currentUser}
        />
      </div>
    </Modal>
  );
}
