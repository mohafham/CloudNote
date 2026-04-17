# Cloud Notes Platform - MVP and Delivery Roadmap

## Goal
Deliver a stable cloud notes product quickly, then layer advanced collaboration and productivity features.

## Phase 1 - Core MVP (Weeks 1-4)
### Scope
- Authentication (register/login/logout)
- Guest mode with warning: You will not receive cloud benefits
- Notes CRUD (create, edit, delete, list)
- Note titles
- Folder CRUD with visual distinction from notes
- Top search bar with title-first search priority
- Discord-inspired cozy UI baseline

### Exit Criteria
- User can create and manage notes/folders reliably.
- Search and navigation work across all notes.
- Guest mode limitations are enforced.

## Phase 2 - Cloud and Sharing (Weeks 5-7)
### Scope
- Cloud persistence and multi-device sync
- Share action on note popup and note-card hover
- Copy-link sharing with View only and Can edit permissions
- Basic permission management (revoke or update access)
- Attachments: images and PDF with attachment card UI

### Exit Criteria
- Shared notes open correctly with chosen access level.
- Notes and attachments sync correctly across devices.

## Phase 3 - Real-Time Collaboration (Weeks 8-10)
### Scope
- Simultaneous multi-user editing
- Fast update propagation and conflict-safe editing
- Visual collaboration indicators (active collaborators)

### Exit Criteria
- Two or more users can edit same note with consistent content.
- Permission model is enforced during live editing.

## Phase 4 - Advanced Productivity (Weeks 11-13)
### Scope
- Full checklist system (home, folder, embedded)
- Inter-note linking via keyword mentions
- Voice-to-text input
- Simple diagram tools inside notes

### Exit Criteria
- All advanced features are usable and persisted.
- Performance remains acceptable under normal usage.

## Recommended Backlog Priorities
1. Must Have: Auth, notes CRUD, folders, search, cloud sync
2. Should Have: Sharing permissions, attachments, checklist workflows
3. Could Have: Real-time collaboration polish, inter-note linking
4. Future: Voice-to-text accuracy upgrades, advanced diagram editor

## Quality Gates Per Phase
- Unit tests for business logic and permissions
- Integration tests for APIs and sync behavior
- E2E tests for core user flows
- Basic security checks (auth, access control, file upload validation)
