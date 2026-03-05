# mtUp - Group Activity Scheduling App
## Instructions for Coding AI

## Overview
mtUp is a mobile-first group scheduling app that helps friends coordinate activities and trips (sejours). The app moves beyond simple calendar OAuth to focus on proposal-based consensus building with AI assistance.

---

## Core Architecture

### Tech Stack
- React + TypeScript
- Vite
- Tailwind CSS + shadcn/ui
- localStorage for data persistence (mockup phase)
- date-fns for date handling

### Data Models

```typescript
type User = {
  id: string;
  name: string;
  password: string;
  isAdmin: boolean;
};

type ActivityType = 'event' | 'sejour';
type ActivityStatus = 'proposed' | 'polling' | 'resolved' | 'scheduled';
type AnchorType = 'location' | 'time' | 'activity' | 'social' | 'none';

type Proposal = {
  id: string;
  title: string;
  type: ActivityType;
  emoji: string;
  createdBy: string;
  createdAt: string;
  status: ActivityStatus;
  
  // Dynamic anchor system
  anchor: {
    type: AnchorType;
    field: string;
    discriminating: boolean;
  };
  
  details: {
    date?: string;
    time?: string;
    location?: string;
    activity?: string;
    requirements?: string;
    duration?: { start: string; end: string }; // for sejours
  };
  
  locked: string[];      // fields that can't be changed
  flexible: string[];    // fields open to alternatives
  alternatives: Alternative[];
  aiContext: string;     // original user intent
  
  // For sejours
  sejourType?: 'core_window' | 'rolling_trip' | 'fixed';
  participations?: RollingSejourParticipation[];
  
  // Related activities
  relatedActivities?: {
    id: string;
    relationship: 'same_location' | 'consecutive' | 'alternative' | 'series';
    note?: string;
  }[];
  
  comments?: Comment[];
};

type Alternative = {
  id: string;
  proposalId: string;
  field: 'date' | 'time' | 'location' | 'requirements';
  value: string;
  suggestedBy: string;
  supportedBy: string[]; // user IDs who +1'd
};

type Availability = {
  id: string;
  userId: string;
  proposalId: string;
  dates: string[];        // ISO date strings
  timeSlots?: string[];   // for events only
};

// For rolling sejours
type RollingSejourParticipation = {
  userId: string;
  checkIn: string;
  checkOut: string;
  overlap: string[];      // other user IDs present during stay
};

type Comment = {
  id: string;
  userId: string;
  proposalId: string;
  text: string;
  createdAt: string;
};
```

---

## Critical Concept: Dynamic Specificity Hierarchy

**Rule:** Whatever is specified first (most concrete) becomes the anchor. Everything else is negotiable around it.

### Anchor Detection Patterns

```typescript
function detectAnchor(userInput: string): {
  anchor: AnchorType;
  discriminating: boolean;
} {
  // Location-anchored: "Trip to France", "Let's go to Lyon"
  if (/\b(to|in|at)\s+[A-Z][a-z]+/.test(userInput)) {
    return { anchor: 'location', discriminating: true };
  }
  
  // Time-anchored: "Tonight", "Get out today", "This Friday"
  if (/\b(tonight|today|tomorrow|this\s+\w+)\b/.test(userInput)) {
    return { anchor: 'time', discriminating: true };
  }
  
  // Activity-anchored: "Cardgame", "Play tennis", "Dinner"
  if (/\b(play|game|dinner|lunch|movie|concert)\b/.test(userInput)) {
    return { anchor: 'activity', discriminating: true };
  }
  
  // Social-anchored: "Hang out", "Do something", "Catch up"
  if (/\b(hang\s*out|catch\s*up|get\s*together|meet\s*up|do\s*something)\b/.test(userInput)) {
    return { anchor: 'social', discriminating: false };
  }
  
  return { anchor: 'none', discriminating: false };
}
```

### Alternative Validation Based on Anchor

```typescript
function isValidAlternative(
  proposal: Proposal,
  alternative: Alternative,
  anchor: AnchorType
): { valid: boolean; reason?: string } {
  
  switch (anchor) {
    case 'location':
      if (alternative.field === 'location') {
        // Must be same region/nearby
        if (!isSameRegion(proposal.location, alternative.value)) {
          return { 
            valid: false, 
            reason: "Different region - create new trip instead" 
          };
        }
      }
      return { valid: true };
      
    case 'time':
      if (alternative.field === 'date') {
        const daysDiff = getDaysDifference(proposal.date, alternative.value);
        if (daysDiff > 1) {
          return { 
            valid: false, 
            reason: "Timing is the point - create new activity instead" 
          };
        }
      }
      return { valid: true };
      
    case 'activity':
      if (alternative.field === 'title') {
        return { 
          valid: false, 
          reason: "Different activity - create new proposal" 
        };
      }
      return { valid: true };
      
    case 'social':
      return { valid: true }; // Almost anything goes
      
    default:
      return { valid: true };
  }
}
```

---

## Sejour (Multi-Day Trip) Handling

### Overlap Detection

```typescript
function calculateOverlap(
  range1: { start: string; end: string },
  range2: { start: string; end: string }
): {
  days: number;
  dates: string[];
  percentage: number; // of shorter range
  isHandoff: boolean;
} {
  // Calculate overlapping dates
  const dates = getOverlappingDates(range1, range2);
  const days = dates.length;
  
  const shorterDuration = Math.min(
    getDuration(range1),
    getDuration(range2)
  );
  
  const percentage = days / shorterDuration;
  
  // Handoff = only 1 day overlap at boundaries
  const isHandoff = days === 1 && (
    dates[0] === range1.end || 
    dates[0] === range2.start
  );
  
  return { days, dates, percentage, isHandoff };
}
```

### Sejour Resolution Decision Matrix

| Overlap Days | Overlap % | Action | Sejour Type |
|--------------|-----------|--------|-------------|
| 0 | 0% | Auto-fork to separate activity | N/A |
| 1 (handoff) | <10% | Auto-fork + link as consecutive | N/A |
| 1-2 | 10-30% | Warn user, suggest fork | rolling_trip |
| 3+ | 30-50% | Accept as alternative | rolling_trip |
| 3+ | 50%+ | Accept as alternative | core_window |
| 100% | 100% | Same activity | fixed |

```typescript
function resolveSejourOverlap(
  original: Proposal,
  suggested: DateRange,
  suggestedBy: User
) {
  const overlap = calculateOverlap(original.details.duration!, suggested);
  
  // No overlap → Auto-fork
  if (overlap.days === 0) {
    return {
      action: 'fork',
      newActivity: {
        title: `${original.title} #2`,
        dates: suggested,
        location: original.details.location,
        relatedTo: original.id,
        relationship: 'same_location'
      }
    };
  }
  
  // Back-to-back → Fork + link consecutive
  if (overlap.isHandoff) {
    return {
      action: 'fork',
      newActivity: {
        title: `${original.title} (Week 2)`,
        dates: suggested,
        relatedTo: original.id,
        relationship: 'consecutive'
      },
      notification: `${original.lastParticipant} could extend to join both!`
    };
  }
  
  // Minimal overlap → Warn
  if (overlap.percentage < 0.3) {
    return {
      action: 'warn',
      message: `Only ${overlap.days} days overlap. Create separate trip?`,
      options: ['Keep as alternative', 'Create separate']
    };
  }
  
  // Good overlap → Add as alternative
  if (overlap.days >= 3) {
    return {
      action: 'alternative',
      sejourType: overlap.percentage >= 0.5 ? 'core_window' : 'rolling_trip'
    };
  }
  
  return { action: 'alternative', sejourType: 'rolling_trip' };
}
```

### Rolling Trip Timeline Calculation

```typescript
function calculateRollingTimeline(
  participations: RollingSejourParticipation[]
): {
  date: string;
  present: string[];
  arriving: string[];
  departing: string[];
}[] {
  const allDates = getAllDatesInRange(
    participations.map(p => ({ start: p.checkIn, end: p.checkOut }))
  );
  
  return allDates.map(date => {
    const present = participations
      .filter(p => isDateInRange(date, p.checkIn, p.checkOut))
      .map(p => p.userId);
      
    const arriving = participations
      .filter(p => p.checkIn === date)
      .map(p => p.userId);
      
    const departing = participations
      .filter(p => p.checkOut === date)
      .map(p => p.userId);
      
    return { date, present, arriving, departing };
  });
}

function findPeakOverlap(timeline: Timeline[]): {
  dates: string[];
  participants: string[];
  count: number;
} {
  const maxCount = Math.max(...timeline.map(t => t.present.length));
  const peakDates = timeline.filter(t => t.present.length === maxCount);
  
  return {
    dates: peakDates.map(t => t.date),
    participants: peakDates[0].present,
    count: maxCount
  };
}
```

---

## Calendar Interaction

### Individual Calendar
- Users mark availability by clicking/dragging dates
- Selected proposal determines what gets marked
- For events: day-level marking (30-min time slots added later in specificity phase)
- For sejours: multi-day range selection

### Multi-User Display
- Individual calendar shows ALL users' availability, not just current user
- Each proposal displays:
  - Emoji icon
  - User avatar bubbles (up to 3 visible, then "+X")
  - Current user's avatar highlighted in blue
  - Other users' avatars in gray
  - Opacity: 100% if current user marked, 50% if not

```typescript
// Calendar cell data structure
type CalendarCellData = {
  date: Date;
  proposalUsersMap: Map<string, Set<User>>; // proposalId -> users available
  isPast: boolean;
};
```

### Past Date Handling
- Dates before today are:
  - Grayed out (bg-gray-100, opacity-50)
  - Non-interactive (cursor-not-allowed)
  - Day number has strikethrough
  - Tooltip: "Past date - cannot be scheduled"

```typescript
const isPast = isBefore(startOfDay(date), startOfDay(new Date()));
```

---

## User Interface Screens

### Screen 1: Snooky (AI Assistant)
**Purpose:** Help users create proposals or query existing activities

**UI Elements:**
- Chat-like interface
- Input: "Meeting in my office on monday at 15"
- AI drafts structured proposal form with fields:
  - Title (pre-filled or editable)
  - Date (with date picker)
  - Time (with time picker)  
  - Participants (pre-filled: "Everyone in active group")
  - Location (pre-filled or editable)
  - Requirements (optional)
  - Comments (optional)
- Buttons: [Confirm] [Cancel] [Activities]

**AI Behavior:**
- Detects anchor type from user input
- Locks anchor field with 🔒 icon
- Marks flexible fields with ✏️ icon
- Stores original context in `aiContext` field

### Screen 2: Activities List
**Purpose:** View all active proposals, subscribe to activities

**UI Elements:**
- List of activity cards showing:
  - Emoji + Title
  - Creator: "by Alice"
  - Status badge (Proposed/Polling/Resolved/Scheduled)
  - Subscription count: "2/7 subscribed"
  - User avatars (A, B, C...)
  - Date/Time/Location if specified
- Each card clickable → Activity Detail screen
- Floating action button: "+ New Proposal"

### Screen 3: Activity Detail (NEW - NEEDS IMPLEMENTATION)
**Purpose:** Show full details, alternatives, and allow subscription

**UI Elements:**
```
┌──────────────────────────┐
│ 🎮 Cardgame Tomorrow     │
│ by Alice                 │
│ 🔒 Activity: Cardgame    │ ← Locked anchor
│ ✏️ Date: Tomorrow        │ ← Flexible
├──────────────────────────┤
│ 📅 2026-03-06            │
│ 🕐 19:00 (suggested)     │
│ 📍 Ricks (suggested)     │
│ 💬 Don't be late         │
├──────────────────────────┤
│ Subscribed: A, G (2/7)   │
│ [Subscribe] [Unsubscribe]│
├──────────────────────────┤
│ 💡 Suggested Alternatives│
│ ┌────────────────────┐   │
│ │ 📅 Wed (Bob +2) ★  │   │
│ │ 🕐 20:00 (G +1)    │   │
│ │ 📍 Tom's (G +2) ★  │   │
│ └────────────────────┘   │
│ [+1 Alternative]         │
├──────────────────────────┤
│ [View Calendar]          │
│ [Resolve Activity] ←admin│
└──────────────────────────┘
```

### Screen 4: Resolver (NEW - NEEDS IMPLEMENTATION)
**Purpose:** Make final decisions on alternatives when consensus exists

**Trigger Conditions:**
- Proposer/admin clicks "Resolve Activity"
- OR auto-appears when 60%+ of group has responded

**UI Elements:**
```
┌──────────────────────────┐
│ Resolve Activity         │
├──────────────────────────┤
│ ✅ Activity: Cardgame    │
│    7/7 agree             │
├──────────────────────────┤
│ ✅ Date: Tomorrow        │
│    6/7 agree             │
├──────────────────────────┤
│ ⚡ Time (choose):        │
│ ○ 19:00 (4 votes) ←      │
│ ○ 20:00 (3 votes)        │
├──────────────────────────┤
│ ⚡ Location:             │
│ ○ Ricks (3 votes)        │
│ ○ Tom's (4 votes) ←      │
├──────────────────────────┤
│ [Lock In Majority]       │
│ [Create 2 Variants]      │
│ [Keep Polling]           │
└──────────────────────────┘
```

**Resolver Logic:**
- Fields with 60%+ consensus: Auto-mark as ✅
- Fields with split vote: Show as ⚡ needs decision
- Options:
  - **Lock In Majority:** Takes highest-voted option for each field
  - **Create Variants:** Forks into separate activities for each combination
  - **Keep Polling:** Sends notification to non-responders

### Screen 5: Calendar View (Pop-up)
**Purpose:** Visual timeline showing all users' availability

**For Events (single day):**
```
        March
Mo Tu We Th Fr Sa Su
 3  4  5  6  7  8  9
      🎮    ← Cardgame proposal
      A     ← Alice available
      B     ← Bob available
      G     ← G available
```

**For Sejours (multi-day rolling trip):**
```
┌──────────────────────────┐
│ 🏖️ Trip to France        │
│ Rolling Trip: Jun 10-20  │
├──────────────────────────┤
│ Timeline:                │
│                          │
│ Jun 10-11 ──┐            │
│   A, B      │            │
│ Jun 12-14 ──┼── Peak 🔥  │
│   A, B, C   │   (3 ppl)  │
│ Jun 15-17 ──┤            │
│   A, C      │            │
│ Jun 18-20 ──┘            │
│   D         │            │
├──────────────────────────┤
│ 🏠 Accommodation Needs:  │
│ • Jun 10-11: 2 people    │
│ • Jun 12-14: 3 people 🔥 │
│ • Jun 15-17: 2 people    │
│ • Jun 18-20: 1 person    │
└──────────────────────────┘
```

---

## Key Features to Implement

### 1. Auto-Select Newly Created Proposals
```typescript
// In IndividualCalendar component
useEffect(() => {
  if (proposals.length > 0) {
    const mostRecent = proposals[proposals.length - 1];
    setSelectedProposalId(mostRecent.id);
  }
}, [proposals.length]);
```

### 2. Proposal Selector UI
- Show all active proposals as clickable buttons
- Selected proposal highlighted with blue ring + checkmark
- Selected proposal determines what clicking/dragging marks on calendar

### 3. Click and Drag Marking
- Click empty cell: Marks with selected proposal's emoji
- Drag across cells: Marks range with selected proposal
- Ctrl+Click: Removes marking
- No toggle menu needed - selection is explicit via proposal buttons

### 4. All Users Visible
- Calendar cells show all users' availability
- Not just current user
- Current user highlighted differently (blue vs gray avatars)

### 5. Activity Forking Logic
```typescript
function shouldForkActivity(
  original: Proposal,
  alternative: Alternative | DateRange
): { fork: boolean; reason: string; relationship?: string } {
  
  // Check anchor conflicts
  if (original.anchor.discriminating) {
    const anchorField = original.anchor.field;
    if (alternative.field === anchorField) {
      // Violates locked anchor
      return { 
        fork: true, 
        reason: `Different ${anchorField} - anchor is locked`,
        relationship: 'alternative'
      };
    }
  }
  
  // For sejours: check overlap
  if (original.type === 'sejour' && alternative.dates) {
    const overlap = calculateOverlap(
      original.details.duration!,
      alternative.dates
    );
    
    if (overlap.days === 0) {
      return { 
        fork: true, 
        reason: 'No date overlap',
        relationship: 'same_location'
      };
    }
    
    if (overlap.isHandoff) {
      return {
        fork: true,
        reason: 'Back-to-back trips',
        relationship: 'consecutive'
      };
    }
  }
  
  return { fork: false, reason: '' };
}
```

---

## Implementation Priorities

### Phase 1: Core Infrastructure ✅ (DONE)
- User auth
- Proposal creation
- Individual calendar with marking
- Master calendar basic view

### Phase 2: Multi-User Display & Smart Selection (NEXT)
- [ ] Show all users on individual calendar with avatars
- [ ] Auto-select newly created proposals
- [ ] Proposal selector buttons UI
- [ ] Remove toggle menu, use direct selection

### Phase 3: Activity Detail & Alternatives
- [ ] Activity Detail screen
- [ ] Alternative suggestion UI
- [ ] +1 voting on alternatives
- [ ] Related activities linking

### Phase 4: Resolver & Consensus
- [ ] Resolver screen
- [ ] Consensus calculation (60% threshold)
- [ ] Fork to variants
- [ ] Status transitions (proposed → polling → resolved)

### Phase 5: Sejour Intelligence
- [ ] Rolling trip timeline display
- [ ] Peak overlap detection
- [ ] Accommodation needs calculation
- [ ] Auto-fork logic for zero-overlap dates
- [ ] Consecutive trip linking

### Phase 6: AI Enhancement (Snooky)
- [ ] Natural language parsing
- [ ] Anchor detection
- [ ] Smart field locking
- [ ] Alternative validation
- [ ] Fork suggestions

---

## Critical Validations

### Before Accepting Alternative
```typescript
// 1. Check anchor compatibility
const anchorCheck = isValidAlternative(proposal, alternative, proposal.anchor.type);
if (!anchorCheck.valid) {
  suggestFork(anchorCheck.reason);
  return;
}

// 2. Check overlap for sejours
if (proposal.type === 'sejour') {
  const overlapCheck = resolveSejourOverlap(proposal, alternative);
  if (overlapCheck.action === 'fork') {
    createForkedActivity(overlapCheck.newActivity);
    return;
  }
}

// 3. Add as valid alternative
addAlternative(alternative);
```

### Before Forking Activity
```typescript
// 1. Notify original proposer
notifyUser(proposal.createdBy, {
  type: 'activity_forked',
  original: proposal.title,
  new: newActivity.title,
  reason: forkReason
});

// 2. Create link between activities
proposal.relatedActivities.push({
  id: newActivity.id,
  relationship: relationshipType,
  note: `Created from alternative suggestion`
});

// 3. Transfer relevant participants
if (relationshipType === 'consecutive') {
  // Suggest last participant of original could join new
  suggestExtension(proposal.lastParticipant, newActivity);
}
```

---

## Storage Schema (localStorage)

```typescript
const STORAGE_KEY = 'mtup-data';

type StorageData = {
  users: User[];
  proposals: Proposal[];
  availabilities: Availability[];
  currentUserId: string | null;
};

// Helper functions
storage.getProposals(): Proposal[]
storage.addProposal(proposal: Proposal): void
storage.updateProposal(id: string, updates: Partial<Proposal>): void
storage.deleteProposal(id: string): void
storage.setAvailability(availability: Availability): void
storage.getUserAvailabilities(userId: string): Availability[]
storage.getProposalAvailabilities(proposalId: string): Availability[]
```

---

## Testing Scenarios

### Scenario 1: Simple Event
1. Alice creates "Cardgame tomorrow"
2. Detected anchor: activity (Cardgame is locked)
3. Bob marks available
4. Charlie marks available, suggests "Wednesday instead"
5. Alternative added to proposal
6. Consensus reached (2/3 for tomorrow)
7. Alice resolves, locks in tomorrow

### Scenario 2: Location-Anchored Sejour
1. Alice creates "Trip to France, June 10-17"
2. Detected anchor: location (France is locked)
3. Bob marks June 10-14 available
4. Charlie marks June 12-17 available
5. System detects rolling trip (good overlap)
6. Diana suggests "June 20-27"
7. System auto-forks to "France #2" (zero overlap)
8. Links as related (same location)

### Scenario 3: Time-Anchored Event
1. Bob creates "Get out tonight"
2. Detected anchor: time (tonight is locked)
3. Charlie suggests "Friday instead"
4. System rejects: violates time anchor
5. Suggests creating separate "Get out Friday" activity

---

## Error Handling

### Common Edge Cases
1. **No overlap on sejour dates:** Auto-fork with notification
2. **Anchor violation:** Show explanation, suggest fork
3. **<40% consensus after 3 days:** Prompt proposer to resolve or archive
4. **Marking past dates:** Block with tooltip
5. **Empty proposal title:** Require minimum input
6. **No participants:** Warn before creating

---

## Notes for AI Implementation

1. **Start with the data model** - Get types right first
2. **Implement anchor detection** - This drives all other logic
3. **Build overlap calculator** - Critical for sejour handling
4. **Create validation layer** - Before accepting alternatives
5. **Add fork logic** - With proper relationship linking
6. **Build UI incrementally** - Detail screen, then Resolver
7. **Test with scenarios** - Use the testing scenarios above

The key insight is the **dynamic specificity hierarchy** - understanding what the user cares about most (the anchor) determines what alternatives are valid and when to fork.

## Current State

✅ **Working:**
- Basic auth
- Proposal creation with emoji selection
- Individual calendar with click/drag marking  
- Master calendar with consensus colors
- Past date blocking

⚠️ **Needs Update:**
- Individual calendar should show ALL users (not just current)
- Auto-select newly created proposals
- Proposal selector buttons
- Remove toggle menu

❌ **Not Built Yet:**
- Activity Detail screen
- Resolver screen
- Anchor detection
- Alternative validation
- Fork logic
- Rolling trip timeline
- Snooky AI integration

Good luck!
