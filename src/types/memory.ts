export type MemoryScopeType = 'person' | 'group' | 'proposal' | 'place';

export type MemoryStatus =
  | 'reported'
  | 'confirmed'
  | 'inferred'
  | 'needs_confirmation'
  | 'contradicted';

export type MemoryDurability = 'durable' | 'seasonal' | 'ephemeral';

export type MemorySourceKind =
  | 'user_message'
  | 'interview'
  | 'tool_result'
  | 'manual_edit'
  | 'manual_seed';

export type MemoryRecord = {
  id: string;
  groupId?: string | null;
  scopeType: MemoryScopeType;
  scopeId: string;
  factType: string;
  value: Record<string, unknown>;
  status: MemoryStatus;
  durability: MemoryDurability;
  validFrom?: string;
  validTo?: string;
  sourceKind: MemorySourceKind;
  sourceRef?: string;
  observedAt: string;
  updatedAt: string;
};

export type EvidenceKind = 'memory' | 'tool_result' | 'participant_message';

export type EvidenceLink = {
  id: string;
  proposalId: string;
  targetType: 'candidate_time' | 'candidate_place' | 'recommendation' | 'memory_fact';
  targetId: string;
  evidenceKind: EvidenceKind;
  evidenceRef: string;
  note?: string;
  capturedAt: string;
};

export type ProposalFieldStatus = 'missing' | 'candidate' | 'narrowed' | 'confirmed';

export type ProposalFieldProgress = {
  timeStatus: ProposalFieldStatus;
  placeStatus: ProposalFieldStatus;
  participantsStatus: 'open' | 'collecting' | 'settled';
  requirementsStatus: 'unknown' | 'partial' | 'captured';
};
