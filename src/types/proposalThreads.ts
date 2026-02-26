export type ProposalContributionKind =
  | 'affirmation'
  | 'availability'
  | 'field_change'
  | 'comment';

export type ProposalContributionField = 'date' | 'time' | 'place' | 'requirements' | 'general';

export type ProposalContribution = {
  id: string;
  proposalId: string;
  userId: string;
  kind: ProposalContributionKind;
  field?: ProposalContributionField;
  value: Record<string, unknown>;
  createdAt: string;
  provenance: 'implicit_proposer' | 'explicit_click' | 'inferred_from_delta' | 'manual_entry';
};
