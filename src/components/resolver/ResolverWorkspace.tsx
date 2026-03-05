import { ResolverAlternativesPanel } from '@/components/resolver/ResolverAlternativesPanel';
import { ResolverAvailabilityPanel } from '@/components/resolver/ResolverAvailabilityPanel';
import { ResolverCommentsPanel } from '@/components/resolver/ResolverCommentsPanel';
import { ResolverDecisionPanel } from '@/components/resolver/ResolverDecisionPanel';
import { ResolverSummaryCard } from '@/components/resolver/ResolverSummaryCard';
import type { Availability, Proposal, User } from '@/types';

type ResolverWorkspaceProps = {
  proposal: Proposal | null;
  currentUser: User;
  availabilities: Availability[];
  userNameById: Map<string, string>;
  alternativeCount: number;
  commentCount: number;
  onAddComment: (proposalId: string, text: string) => void;
};

export function ResolverWorkspace({
  proposal,
  currentUser,
  availabilities,
  userNameById,
  alternativeCount,
  commentCount,
  onAddComment,
}: ResolverWorkspaceProps) {
  if (!proposal) {
    return (
      <div className="flex min-h-0 items-center justify-center rounded-xl border border-dashed border-gray-300 bg-gray-50 p-6 text-sm text-gray-600 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
        Select a proposal to begin resolving it.
      </div>
    );
  }

  return (
    <div className="min-h-0 overflow-y-auto rounded-xl border border-gray-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
      <div className="space-y-3">
        <ResolverSummaryCard
          proposal={proposal}
          creatorName={userNameById.get(proposal.createdBy) || 'Unknown'}
          alternativeCount={alternativeCount}
          commentCount={commentCount}
        />
        <ResolverAlternativesPanel proposalId={proposal.id} userNameById={userNameById} />
        <ResolverAvailabilityPanel
          proposal={proposal}
          availabilities={availabilities}
          userNameById={userNameById}
        />
        <ResolverDecisionPanel proposal={proposal} dimension="time" currentUser={currentUser} />
        <ResolverDecisionPanel proposal={proposal} dimension="place" currentUser={currentUser} />
        <ResolverDecisionPanel
          proposal={proposal}
          dimension="requirement"
          currentUser={currentUser}
        />
        <ResolverCommentsPanel
          proposal={proposal}
          currentUserId={currentUser.id}
          userNameById={userNameById}
          onAddComment={onAddComment}
        />
      </div>
    </div>
  );
}
