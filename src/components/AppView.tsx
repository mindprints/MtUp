import { useState } from 'react';
import { CreateProposalModal } from './CreateProposalModal';
import { ProposalList } from './ProposalList';
import { IndividualCalendar } from './IndividualCalendar';
import { MasterCalendar } from './MasterCalendar';
import { useAuth } from '@/lib/AuthContext';
import { useProposals } from '@/lib/ProposalContext';

export function AppView() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const { user } = useAuth();
  const { proposals, deleteProposal } = useProposals();

  const handleDeleteAll = () => {
    if (window.confirm(`Are you sure you want to delete all ${proposals.length} proposals? This cannot be undone.`)) {
      proposals.forEach(proposal => {
        deleteProposal(proposal.id);
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Activity Proposals</h2>
          <div className="flex gap-2">
            {user?.isAdmin && proposals.length > 0 && (
              <button
                onClick={handleDeleteAll}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                🗑️ Delete All ({proposals.length})
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
        
        <ProposalList />
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <IndividualCalendar />
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <MasterCalendar />
      </div>

      <CreateProposalModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  );
}