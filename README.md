# Schedule App

A collaborative scheduling application for friends to coordinate events and trips.

## Features (In Development)

- ✅ User authentication (5 mock users)
- ✅ localStorage persistence
- ✅ Activity proposals with emoji identifiers
- ✅ Event vs Sejour type selection
- ✅ Proposal list with response tracking
- ✅ Individual calendar with click-and-drag availability marking
- ✅ Month navigation and visual date marking
- ✅ Master calendar showing aggregate availability
- ✅ Consensus detection and highlighting
- ✅ Color-coded availability visualization
- 🚧 Comments and specificity refinement
- 🚧 Activity status transitions

## Setup

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

## Mock Users

All users have the password: `password`

- Alice (admin)
- Bob
- Charlie
- Diana
- Eve

## Tech Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- localStorage for data persistence

## Current Status

**Phase 1: Authentication ✅**
- [x] User login/logout
- [x] localStorage integration
- [x] Auth context
- [x] Basic dashboard layout

**Phase 2: Proposal Creation ✅**
- [x] Create proposal modal
- [x] Emoji selection from pool
- [x] Event vs Sejour toggle
- [x] Proposal list view with status indicators
- [x] Response tracking

**Phase 3: Individual Calendar ✅**
- [x] Month grid view
- [x] Click-and-drag date selection
- [x] Emoji marking for proposals
- [x] Visual indicators for availability
- [x] Month navigation (Previous/Today/Next)

**Phase 4: Master Calendar ✅**
- [x] Aggregate view showing all users
- [x] Color-coded overlap visualization (green = all available, blue = most, yellow = some)
- [x] Proposal filtering
- [x] Consensus detection and highlighting
- [x] Detailed date modal showing available/unavailable users
- [x] User avatar display

**Phase 5: Activity Details (Next)**
- [ ] Proposal detail modal with full info
- [ ] Comments section
- [ ] Specificity refinement workflow
- [ ] Status transitions (proposed → scheduled → confirmed)
- [ ] Edit/delete proposals
