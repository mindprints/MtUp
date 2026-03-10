import { useEffect, useState, useMemo } from 'react';
import { ResolverQueue, type ResolverFilter } from '@/components/resolver/ResolverQueue';
import { ResolverWorkspace } from '@/components/resolver/ResolverWorkspace';
import { useAuth } from '@/lib/AuthContext';
import { useProposals } from '@/lib/ProposalContext';
import { proposalThreadStore } from '@/lib/proposalThreadStore';
import { generateId } from '@/lib/utils';

export function ResolverScreen() {
  const { user } = useAuth();
  const { proposals, groupUsers, availabilities, updateProposal } = useProposals();
  const [selectedProposalId, setSelectedProposalId] = useState<string | null>(null);
  const [filter, setFilter] = useState<ResolverFilter>('all');
  const [showConfirmed, setShowConfirmed] = useState(false);
  const [mobileView, setMobileView] = useState<'queue' | 'workspace'>('queue');

  const userNameById = useMemo(() => {
    const map = new Map(groupUsers.map((member) => [member.id, member.name]));
    if (user && !map.has(user.id)) {
      map.set(user.id, user.name);
    }
    return map;
  }, [groupUsers, user]);

  const visibleProposals = useMemo(() => proposals.filter((proposal) => {
    if (!user) return false;
    if (!showConfirmed && proposal.status === 'confirmed') return false;
    if (filter === 'event') return proposal.type === 'event';
    if (filter === 'sejour') return proposal.type === 'sejour';
    if (filter === 'mine') return proposal.createdBy === user?.id;
    return true;
  }), [proposals, showConfirmed, filter, user]);

  useEffect(() => {
    if (showConfirmed) return;
    if (visibleProposals.length > 0) return;
    if (!proposals.some((proposal) => proposal.status === 'confirmed')) return;
    setShowConfirmed(true);
  }, [proposals, showConfirmed, visibleProposals]);

  useEffect(() => {
    if (visibleProposals.length === 0) {
      setSelectedProposalId(null);
      setMobileView('queue');
      return;
    }

    if (!selectedProposalId || !visibleProposals.some((proposal) => proposal.id === selectedProposalId)) {
      setSelectedProposalId(visibleProposals[0].id);
    }
  }, [selectedProposalId, visibleProposals]);

  if (!user) return null;

  const selectedProposal =
    visibleProposals.find((proposal) => proposal.id === selectedProposalId) || null;

  const commentCountByProposalId = Object.fromEntries(
    proposals.map((proposal) => [proposal.id, proposal.comments?.length || 0])
  );

  const alternativeCountByProposalId = Object.fromEntries(
    proposals.map((proposal) => [
      proposal.id,
      proposalThreadStore
        .listForProposal(proposal.id)
        .filter((entry) => entry.kind === 'field_change').length,
    ])
  );

  const handleAddComment = async (proposalId: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const proposal = proposals.find((entry) => entry.id === proposalId);
    if (!proposal) return;

    await updateProposal(proposalId, {
      comments: [
        ...(proposal.comments || []),
        {
          id: generateId(),
          userId: user.id,
          proposalId,
          text: trimmed,
          createdAt: new Date().toISOString(),
        },
      ],
    });
  };

  const handleSelectProposal = (proposalId: string) => {
    setSelectedProposalId(proposalId);
    setMobileView('workspace');
  };

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col gap-3 overflow-hidden">
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setMobileView('queue')}
          className={`rounded-lg border px-3 py-2 text-sm font-medium ${
            mobileView === 'queue'
              ? 'border-blue-600 bg-blue-600 text-white'
              : 'border-gray-300 bg-white text-gray-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200'
          }`}
        >
          List
        </button>
        <button
          type="button"
          onClick={() => setMobileView('workspace')}
          className={`rounded-lg border px-3 py-2 text-sm font-medium ${
            mobileView === 'workspace'
              ? 'border-blue-600 bg-blue-600 text-white'
              : 'border-gray-300 bg-white text-gray-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200'
          }`}
        >
          Details
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {mobileView === 'queue' ? (
          <ResolverQueue
            proposals={visibleProposals}
            selectedProposalId={selectedProposalId}
            onSelectProposal={handleSelectProposal}
            filter={filter}
            onFilterChange={setFilter}
            showConfirmed={showConfirmed}
            onShowConfirmedChange={setShowConfirmed}
            currentUserId={user.id}
            userNameById={userNameById}
            commentCountByProposalId={commentCountByProposalId}
            alternativeCountByProposalId={alternativeCountByProposalId}
          />
        ) : (
          <div className="h-full min-h-0">
            <ResolverWorkspace
              proposal={selectedProposal}
              proposals={proposals}
              currentUser={user}
              availabilities={availabilities}
              userNameById={userNameById}
              alternativeCount={selectedProposal ? alternativeCountByProposalId[selectedProposal.id] || 0 : 0}
              commentCount={selectedProposal ? commentCountByProposalId[selectedProposal.id] || 0 : 0}
              onAddComment={handleAddComment}
            />
          </div>
        )}
      </div>
    </div>
  );
}
