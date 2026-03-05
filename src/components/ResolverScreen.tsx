import { useEffect, useState } from 'react';
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

  if (!user) return null;

  const userNameById = new Map(groupUsers.map((member) => [member.id, member.name]));
  if (!userNameById.has(user.id)) {
    userNameById.set(user.id, user.name);
  }

  const visibleProposals = proposals.filter((proposal) => {
    if (!showConfirmed && proposal.status === 'confirmed') return false;
    if (filter === 'event') return proposal.type === 'event';
    if (filter === 'sejour') return proposal.type === 'sejour';
    if (filter === 'mine') return proposal.createdBy === user.id;
    return true;
  });

  useEffect(() => {
    if (visibleProposals.length === 0) {
      setSelectedProposalId(null);
      return;
    }

    if (!selectedProposalId || !visibleProposals.some((proposal) => proposal.id === selectedProposalId)) {
      setSelectedProposalId(visibleProposals[0].id);
    }
  }, [selectedProposalId, visibleProposals]);

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

  const handleAddComment = (proposalId: string, text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const proposal = proposals.find((entry) => entry.id === proposalId);
    if (!proposal) return;

    updateProposal(proposalId, {
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

  return (
    <div className="grid h-full min-h-0 gap-3 lg:grid-cols-[320px_minmax(0,1fr)]">
      <ResolverQueue
        proposals={visibleProposals}
        selectedProposalId={selectedProposalId}
        onSelectProposal={setSelectedProposalId}
        filter={filter}
        onFilterChange={setFilter}
        showConfirmed={showConfirmed}
        onShowConfirmedChange={setShowConfirmed}
        currentUserId={user.id}
        userNameById={userNameById}
        commentCountByProposalId={commentCountByProposalId}
        alternativeCountByProposalId={alternativeCountByProposalId}
      />
      <ResolverWorkspace
        proposal={selectedProposal}
        currentUser={user}
        availabilities={availabilities}
        userNameById={userNameById}
        alternativeCount={selectedProposal ? alternativeCountByProposalId[selectedProposal.id] || 0 : 0}
        commentCount={selectedProposal ? commentCountByProposalId[selectedProposal.id] || 0 : 0}
        onAddComment={handleAddComment}
      />
    </div>
  );
}
