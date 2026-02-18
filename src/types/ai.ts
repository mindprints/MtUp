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
};

export type AiChatRequest = {
  threadId?: string;
  message: string;
  context?: {
    userId?: string;
    activeGroupId?: string | null;
    selectedProposalId?: string | null;
  };
};

export type AiChatResponse = {
  threadId: string;
  mode: 'answer' | 'action_proposal';
  assistantMessage: AiMessage;
  actionProposal?: AiActionProposal;
};
