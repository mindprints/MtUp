import type { Proposal, User } from '@/types';

export function canConfirmDecision(user: User | null, proposal: Proposal): boolean {
  if (!user) return false;
  return user.isAdmin || proposal.createdBy === user.id;
}
