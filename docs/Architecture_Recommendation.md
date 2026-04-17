# Cloud Notes Platform - Architecture Recommendation

## 1. Suggested Tech Stack
### Frontend
- React + TypeScript + Vite
- State management: Zustand or Redux Toolkit
- Rich text editor: Tiptap
- Styling: Tailwind CSS with custom Discord-inspired design tokens

### Backend
- Node.js + TypeScript with NestJS or Express
- REST APIs for core resources
- WebSocket channel for collaboration and presence

### Data and Storage
- PostgreSQL for users, notes, folders, sharing permissions, links
- Redis for session cache and collaboration presence
- Object storage (S3-compatible) for image/PDF attachments

### Real-Time Collaboration Engine
- CRDT approach (Yjs) with websocket provider
- Server persists CRDT snapshots and merges

### Auth and Security
- JWT-based auth with refresh token rotation
- Password hashing with bcrypt or argon2
- TLS everywhere, role-based permission checks for note access

## 2. Core Domain Model
- User: account profile and auth identity
- Note: title, content, type (note/checklist), owner, timestamps
- Folder: name, owner, visual style metadata
- ChecklistItem: content, checked state, order
- Attachment: noteId, file metadata, storage URL
- SharePermission: noteId, targetUser or publicToken, role (view/edit)
- NoteLink: sourceNoteId, targetNoteId, alias text
- CollaborationSession: active editors and connection status

## 3. API Surface (Initial)
- POST /auth/register
- POST /auth/login
- GET /notes
- POST /notes
- PATCH /notes/:id
- DELETE /notes/:id
- GET /folders
- POST /folders
- PATCH /folders/:id
- DELETE /folders/:id
- POST /notes/:id/share
- PATCH /notes/:id/share/:shareId
- DELETE /notes/:id/share/:shareId
- POST /notes/:id/attachments
- DELETE /notes/:id/attachments/:attachmentId
- GET /search?q=keyword

## 4. Realtime Events (WebSocket)
- note.join
- note.leave
- note.patch
- note.cursor
- checklist.item.update
- collaboration.presence

## 5. Security Controls
- Enforce permission check on every note read/write request.
- Validate upload MIME type and max size.
- Scan uploaded files for malware where available.
- Rate limit auth and share endpoints.
- Record audit logs for sharing changes and permission updates.

## 6. Performance Targets (Practical)
- Initial page load target: under 3 seconds on broadband.
- Note save acknowledgement: under 1 second typical.
- Search response target: under 1.5 seconds for moderate datasets.
- Collaboration update propagation: under 500 ms typical.

## 7. Deployment Blueprint
- Frontend hosted on CDN platform.
- Backend on container service with autoscaling.
- Managed PostgreSQL and Redis.
- Object storage for attachments.
- CI/CD pipeline with test gates before deployment.

## 8. Risks and Mitigations
- Real-time merge conflicts: use CRDT and server snapshot checkpoints.
- Upload abuse: strict file validation, quotas, and rate limiting.
- Permission leaks: centralized authorization middleware plus tests.
- UI complexity: ship in phases, protect MVP from feature overload.
