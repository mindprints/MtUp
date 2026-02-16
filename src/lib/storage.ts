import type {
  AppData,
  User,
  Proposal,
  Availability,
  ProposalDecisionConfig,
  DecisionOption,
  DecisionVote,
  DecisionConfirmation,
  DecisionDimension,
} from '@/types';

const STORAGE_KEY = 'schedule-app-data';

// Mock users
const MOCK_USERS: User[] = [
  { id: '1', name: 'Alice', password: 'password', isAdmin: true },
  { id: '2', name: 'Bob', password: 'password', isAdmin: false },
  { id: '3', name: 'Charlie', password: 'password', isAdmin: false },
  { id: '4', name: 'Diana', password: 'password', isAdmin: false },
  { id: '5', name: 'Eve', password: 'password', isAdmin: false },
];

const INITIAL_DATA: AppData = {
  users: MOCK_USERS,
  proposals: [],
  availabilities: [],
  decisionConfigs: [],
  decisionOptions: [],
  decisionVotes: [],
  decisionConfirmations: [],
  currentUserId: null,
};

function normalizeData(rawData: unknown): AppData {
  const candidate = rawData as Partial<AppData> | null;
  return {
    users: candidate?.users ?? INITIAL_DATA.users,
    proposals: candidate?.proposals ?? [],
    availabilities: candidate?.availabilities ?? [],
    decisionConfigs: candidate?.decisionConfigs ?? [],
    decisionOptions: candidate?.decisionOptions ?? [],
    decisionVotes: candidate?.decisionVotes ?? [],
    decisionConfirmations: candidate?.decisionConfirmations ?? [],
    currentUserId:
      candidate?.currentUserId === undefined ? null : candidate.currentUserId,
  };
}

export const storage = {
  // Get all data from localStorage
  getData(): AppData {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      this.setData(INITIAL_DATA);
      return INITIAL_DATA;
    }
    return normalizeData(JSON.parse(stored));
  },

  // Set all data to localStorage
  setData(data: AppData): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  },

  // Get current user
  getCurrentUser(): User | null {
    const data = this.getData();
    if (!data.currentUserId) return null;
    return data.users.find((u) => u.id === data.currentUserId) || null;
  },

  // Login
  login(name: string, password: string): User | null {
    const data = this.getData();
    const user = data.users.find(
      (u) => u.name === name && u.password === password
    );
    if (user) {
      data.currentUserId = user.id;
      this.setData(data);
      return user;
    }
    return null;
  },

  // Logout
  logout(): void {
    const data = this.getData();
    data.currentUserId = null;
    this.setData(data);
  },

  // Add proposal
  addProposal(proposal: Proposal): void {
    const data = this.getData();
    data.proposals.push(proposal);
    this.setData(data);
  },

  // Update proposal
  updateProposal(proposalId: string, updates: Partial<Proposal>): void {
    const data = this.getData();
    const index = data.proposals.findIndex((p) => p.id === proposalId);
    if (index !== -1) {
      data.proposals[index] = { ...data.proposals[index], ...updates };
      this.setData(data);
    }
  },

  // Delete proposal
  deleteProposal(proposalId: string): void {
    const data = this.getData();
    data.proposals = data.proposals.filter((p) => p.id !== proposalId);
    data.availabilities = data.availabilities.filter(
      (a) => a.proposalId !== proposalId
    );
    data.decisionConfigs = data.decisionConfigs.filter(
      (config) => config.proposalId !== proposalId
    );
    data.decisionOptions = data.decisionOptions.filter(
      (option) => option.proposalId !== proposalId
    );
    data.decisionVotes = data.decisionVotes.filter(
      (vote) => vote.proposalId !== proposalId
    );
    data.decisionConfirmations = data.decisionConfirmations.filter(
      (confirmation) => confirmation.proposalId !== proposalId
    );
    this.setData(data);
  },

  // Get proposals
  getProposals(): Proposal[] {
    return this.getData().proposals;
  },

  // Add or update availability
  setAvailability(availability: Availability): void {
    const data = this.getData();
    const index = data.availabilities.findIndex(
      (a) => a.userId === availability.userId && a.proposalId === availability.proposalId
    );
    if (index !== -1) {
      data.availabilities[index] = availability;
    } else {
      data.availabilities.push(availability);
    }
    this.setData(data);
  },

  // Get availability for a specific user and proposal
  getAvailability(userId: string, proposalId: string): Availability | null {
    const data = this.getData();
    return data.availabilities.find(
      (a) => a.userId === userId && a.proposalId === proposalId
    ) || null;
  },

  // Get all availabilities for a proposal
  getProposalAvailabilities(proposalId: string): Availability[] {
    const data = this.getData();
    return data.availabilities.filter((a) => a.proposalId === proposalId);
  },

  // Get all availabilities for a user
  getUserAvailabilities(userId: string): Availability[] {
    const data = this.getData();
    return data.availabilities.filter((a) => a.userId === userId);
  },

  // Delete availability
  deleteAvailability(userId: string, proposalId: string): void {
    const data = this.getData();
    data.availabilities = data.availabilities.filter(
      (a) => !(a.userId === userId && a.proposalId === proposalId)
    );
    this.setData(data);
  },

  // Get decision config for a proposal and dimension
  getDecisionConfig(
    proposalId: string,
    dimension: DecisionDimension
  ): ProposalDecisionConfig | null {
    const data = this.getData();
    return (
      data.decisionConfigs.find(
        (config) =>
          config.proposalId === proposalId && config.dimension === dimension
      ) || null
    );
  },

  // Add or update decision config
  setDecisionConfig(config: ProposalDecisionConfig): void {
    const data = this.getData();
    const index = data.decisionConfigs.findIndex(
      (existingConfig) =>
        existingConfig.proposalId === config.proposalId &&
        existingConfig.dimension === config.dimension
    );
    if (index !== -1) {
      data.decisionConfigs[index] = config;
    } else {
      data.decisionConfigs.push(config);
    }
    this.setData(data);
  },

  // Get decision options for a proposal and dimension
  getDecisionOptions(
    proposalId: string,
    dimension: DecisionDimension
  ): DecisionOption[] {
    const data = this.getData();
    return data.decisionOptions.filter(
      (option) =>
        option.proposalId === proposalId && option.dimension === dimension
    );
  },

  // Add decision option
  addDecisionOption(option: DecisionOption): void {
    const data = this.getData();
    data.decisionOptions.push(option);
    this.setData(data);
  },

  // Delete decision option
  deleteDecisionOption(optionId: string): void {
    const data = this.getData();
    data.decisionOptions = data.decisionOptions.filter(
      (option) => option.id !== optionId
    );
    data.decisionVotes = data.decisionVotes.map((vote) => ({
      ...vote,
      rankedOptionIds: vote.rankedOptionIds?.filter((id) => id !== optionId),
      selectedOptionIds: vote.selectedOptionIds?.filter((id) => id !== optionId),
    }));
    data.decisionConfirmations = data.decisionConfirmations.map(
      (confirmation) => ({
        ...confirmation,
        optionIds: confirmation.optionIds.filter((id) => id !== optionId),
      })
    );
    this.setData(data);
  },

  // Get decision votes for a proposal and dimension
  getDecisionVotes(
    proposalId: string,
    dimension: DecisionDimension
  ): DecisionVote[] {
    const data = this.getData();
    return data.decisionVotes.filter(
      (vote) => vote.proposalId === proposalId && vote.dimension === dimension
    );
  },

  // Add or update decision vote for a user/proposal/dimension
  setDecisionVote(vote: DecisionVote): void {
    const data = this.getData();
    const index = data.decisionVotes.findIndex(
      (existingVote) =>
        existingVote.userId === vote.userId &&
        existingVote.proposalId === vote.proposalId &&
        existingVote.dimension === vote.dimension
    );
    if (index !== -1) {
      data.decisionVotes[index] = vote;
    } else {
      data.decisionVotes.push(vote);
    }
    this.setData(data);
  },

  // Delete decision vote for a user/proposal/dimension
  deleteDecisionVote(
    userId: string,
    proposalId: string,
    dimension: DecisionDimension
  ): void {
    const data = this.getData();
    data.decisionVotes = data.decisionVotes.filter(
      (vote) =>
        !(
          vote.userId === userId &&
          vote.proposalId === proposalId &&
          vote.dimension === dimension
        )
    );
    this.setData(data);
  },

  // Add decision confirmation
  addDecisionConfirmation(confirmation: DecisionConfirmation): void {
    const data = this.getData();
    data.decisionConfirmations.push(confirmation);
    this.setData(data);
  },

  // Get decision confirmations for a proposal and dimension
  getDecisionConfirmations(
    proposalId: string,
    dimension: DecisionDimension
  ): DecisionConfirmation[] {
    const data = this.getData();
    return data.decisionConfirmations.filter(
      (confirmation) =>
        confirmation.proposalId === proposalId &&
        confirmation.dimension === dimension
    );
  },

  // Reset to initial data (for development)
  reset(): void {
    this.setData(INITIAL_DATA);
  },
};
