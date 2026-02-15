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

export type AppData = {
  users: User[];
  proposals: Proposal[];
  availabilities: Availability[];
  currentUserId: string | null;
};
