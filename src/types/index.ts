export type User = {
  id: string;
  name: string;
  password: string;
  isAdmin: boolean;
};

export type ActivityType = 'event' | 'sejour';

export type ActivityStatus = 'proposed' | 'scheduled' | 'confirmed';

export type Proposal = {
  id: string;
  groupId?: string;
  title: string;
  type: ActivityType;
  emoji: string;
  createdBy: string;
  createdAt: string;
  status: ActivityStatus;
  specifics?: {
    date?: string;
    time?: string;
    location?: string;
  };
  comments?: Comment[];
};

export type GroupSummary = {
  id: string;
  name: string;
  role: 'owner' | 'admin' | 'member';
};

export type Comment = {
  id: string;
  userId: string;
  proposalId: string;
  text: string;
  createdAt: string;
};

export type Availability = {
  id: string;
  userId: string;
  proposalId: string;
  dates: string[]; // ISO date strings
  timeSlots?: string[]; // ["12:00", "12:30", "13:00"] for events
};

export type DecisionDimension = 'time' | 'place' | 'requirement';

export type VotingMode = 'single' | 'multi' | 'ranked';

export type DecisionStatus = 'open' | 'pending_confirmation' | 'confirmed';

export type ProposalDecisionConfig = {
  proposalId: string;
  dimension: DecisionDimension;
  mode: VotingMode;
  status: DecisionStatus;
};

export type DecisionOption = {
  id: string;
  proposalId: string;
  dimension: DecisionDimension;
  label: string;
  createdBy: string;
  createdAt: string;
  metadata?: Record<string, string>;
};

export type DecisionVote = {
  id: string;
  proposalId: string;
  dimension: DecisionDimension;
  userId: string;
  rankedOptionIds?: string[];
  selectedOptionIds?: string[];
  updatedAt: string;
};

export type DecisionConfirmation = {
  id: string;
  proposalId: string;
  dimension: DecisionDimension;
  optionIds: string[];
  confirmedBy: string;
  confirmedAt: string;
  note?: string;
};

export type AppData = {
  users: User[];
  proposals: Proposal[];
  availabilities: Availability[];
  decisionConfigs: ProposalDecisionConfig[];
  decisionOptions: DecisionOption[];
  decisionVotes: DecisionVote[];
  decisionConfirmations: DecisionConfirmation[];
  currentUserId: string | null;
};
