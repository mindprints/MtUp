import { useEffect, useState } from 'react';
import { CreateProposalModal } from './CreateProposalModal';
import { IndividualCalendar } from './IndividualCalendar';
import { useAuth } from '@/lib/AuthContext';
import { useProposals } from '@/lib/ProposalContext';
import type { ActivityType } from '@/types';
import { isSupabaseMode } from '@/lib/runtimeConfig';

export function AppView() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createType, setCreateType] = useState<ActivityType>('event');
  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null);
  const { user } = useAuth();
  const { proposals, groups, activeGroupId, deleteProposal } = useProposals();
  const createDisabled = isSupabaseMode() && !activeGroupId && groups.length === 0;

  useEffect(() => {
    if (proposals.length === 0) {
      setSelectedProposalId(null);
      return;
    }

    setSelectedProposalId((prevSelectedProposalId) => {
      if (
        prevSelectedProposalId &&
        proposals.some((proposal) => proposal.id === prevSelectedProposalId)
      ) {
        return prevSelectedProposalId;
      }
      return proposals[0].id;
    });
  }, [proposals]);

  const handleDeleteAll = () => {
    if (
      window.confirm(
        `Are you sure you want to delete all ${proposals.length} proposals? This cannot be undone.`
      )
    ) {
      proposals.forEach((proposal) => {
        deleteProposal(proposal.id);
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6 dark:bg-slate-900 dark:border dark:border-slate-800">
        <div className="flex justify-end gap-2">
          {user?.isAdmin && proposals.length > 0 && (
            <button
              onClick={handleDeleteAll}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              Delete All ({proposals.length})
            </button>
          )}
          <button
            onClick={() => {
              setCreateType('event');
              setIsCreateModalOpen(true);
            }}
            disabled={createDisabled}
            title={createDisabled ? 'Waiting for group access to load' : 'Create event proposal'}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            + Event
          </button>
          <button
            onClick={() => {
              setCreateType('sejour');
              setIsCreateModalOpen(true);
            }}
            disabled={createDisabled}
            title={createDisabled ? 'Waiting for group access to load' : 'Create sejour proposal'}
            className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-md hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            + Sejour
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6 dark:bg-slate-900 dark:border dark:border-slate-800">
        <IndividualCalendar
          selectedProposalId={selectedProposalId}
          onSelectedProposalIdChange={setSelectedProposalId}
        />
      </div>

      <CreateProposalModal
        isOpen={isCreateModalOpen}
        initialType={createType}
        onProposalCreated={setSelectedProposalId}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  );
}
