export type AiMessageRole = 'user' | 'assistant' | 'system';

export type AiMessage = {
  id: string;
  role: AiMessageRole;
  content: string;
  createdAt: string;
};

export type AiActionProposal = {
  id: string;
  type: string;
  summary: string;
  requiresApproval: boolean;
  impact?: string;
  /**
   * When kind === 'create_proposal', the payload must include a primary proposalDraft (proposalDraft: AiProposalDraft)
   * and may include alternative drafts (proposalDrafts?: AiProposalDraft[]).
   * If proposalDrafts is provided, the first element should be the same as the primary proposalDraft.
   */
  payload?: {
    kind: 'create_proposal';
    proposalDraft: AiProposalDraft;
    proposalDrafts?: AiProposalDraft[];
  };
};

export type AiProposalDraft = {
  id: string;
  title: string;
  type: 'event' | 'sejour';
  emoji?: string;
  specifics?: {
    date?: string;
    time?: string;
    startTime?: string;
    endTime?: string;
    location?: string;
  };
  form?: {
    dates?: string;
    times?: string;
    startTime?: string;
    endTime?: string;
    invitees?: string;
    place?: string;
    requirements?: string;
    comments?: string;
  };
};

export type AiChatRequest = {
  threadId?: string;
  message: string;
  context?: {
    userId?: string;
    activeGroupId?: string | null;
    selectedProposalId?: string | null;
    uiMode?: 'propose' | 'activities' | 'admin' | 'workspace';
    memoryHints?: Array<{
      id: string;
      factType: string;
      status: string;
      summary: string;
      observedAt: string;
    }>;
  };
};

export type AiChatResponse = {
  threadId: string;
  mode: 'answer' | 'action_proposal';
  assistantMessage: AiMessage;
  actionProposal?: AiActionProposal;
};
