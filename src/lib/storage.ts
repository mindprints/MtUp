import type { AppData, User, Proposal, Availability } from '@/types';

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
  currentUserId: null,
};

export const storage = {
  // Get all data from localStorage
  getData(): AppData {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      this.setData(INITIAL_DATA);
      return INITIAL_DATA;
    }
    return JSON.parse(stored);
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

  // Reset to initial data (for development)
  reset(): void {
    this.setData(INITIAL_DATA);
  },
};
