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
  payload?: {
    kind: 'create_proposal';
    proposalDraft: {
      title: string;
      type: 'event' | 'sejour';
      emoji?: string;
      specifics?: {
        date?: string;
        time?: string;
        location?: string;
      };
      form?: {
        dates?: string;
        times?: string;
        invitees?: string;
        place?: string;
        requirements?: string;
        comments?: string;
      };
    };
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
