import { useEffect, useState } from 'react';
import { CreateProposalModal } from './CreateProposalModal';
import { IndividualCalendar } from './IndividualCalendar';
import { useAuth } from '@/lib/AuthContext';
import { useProposals } from '@/lib/ProposalContext';

export function AppView() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null);
  const { user } = useAuth();
  const { proposals, deleteProposal } = useProposals();

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
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            + New Proposal
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
        onProposalCreated={setSelectedProposalId}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  );
}
