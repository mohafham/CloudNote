# Cloud Notes Platform - User Stories and Acceptance Tests

## Story US-01 Registration and Login
As a new user, I want to register and sign in so that my notes sync to cloud.

### Acceptance Criteria
- User can register with email, password, and display name.
- User can log in with credentials.
- Access and refresh tokens are issued after successful authentication.

## Story US-02 Guest Mode Warning
As a trial visitor, I want guest mode so that I can try note creation without account setup.

### Acceptance Criteria
- Guest mode option is visible on landing experience.
- Warning text is shown: You will not receive cloud benefits.
- Guest data does not sync to cloud.

## Story US-03 Notes CRUD
As a user, I want to create, edit, and delete notes using a lightweight popup flow.

### Acceptance Criteria
- Plus button starts note creation.
- Note title and content can be edited.
- User can delete own notes.
- Notes render on home screen after save.

## Story US-04 Folder Organization
As a user, I want folders so I can organize notes and checklists.

### Acceptance Criteria
- User can create, rename, and delete folders.
- Folder card looks visually distinct from note card.
- Notes and checklist notes can be assigned to folders.

## Story US-05 Checklist Workflow
As a user, I want checklists on home page and inside notes so I can manage tasks quickly.

### Acceptance Criteria
- User can create standalone checklist notes.
- Checklist items can be added, toggled, reordered, and removed.
- Embedded checklist blocks can be added inside normal notes.
- Standalone checklist remains interactive directly on home screen.

## Story US-06 Sharing and Permissions
As a note owner, I want copy-link sharing with access control so I can collaborate safely.

### Acceptance Criteria
- Share action is available in note popup and note card hover.
- User can create share link with View only or Can edit.
- Owner can update or revoke share links.
- Owner can add collaborators by account email and set access role.

## Story US-07 Search and Navigation
As a user, I want keyword search so that I can quickly locate notes.

### Acceptance Criteria
- Search input is shown at top of home page.
- Query is case-insensitive.
- Title matches rank above body-only matches.

## Story US-08 Cloud Sync Across Devices
As a signed-in user, I want notes to sync so that I can access them on multiple devices.

### Acceptance Criteria
- Note data is stored in cloud database.
- User sees the same notes after signing in from another device.
- Updates are reflected without manual refresh.

## Story US-09 Attachments
As a user, I want to attach images and PDFs so that notes can include supporting files.

### Acceptance Criteria
- Allowed attachment types: image/png, image/jpeg, image/webp, application/pdf.
- File size limit is enforced by configuration.
- Attachment card displays file metadata similar to email style.

## Story US-10 Real-Time Collaboration
As a collaborator, I want to edit a note with others simultaneously.

### Acceptance Criteria
- Multiple users can join same note room.
- Edits and checklist updates broadcast quickly to participants.
- View-only users cannot publish modifying events.

## Story US-11 Inter-Note Linking
As a user, I want to link notes from other notes using keyword-style references.

### Acceptance Criteria
- User can create relation from source note to target note.
- Linked items are listed and navigable in UI.

## Story US-12 Voice-to-Text and Diagram Blocks
As a user, I want voice and diagram blocks within notes.

### Acceptance Criteria
- User can add note blocks of type voice_transcript and diagram.
- Block payload persists with note.
- Blocks can be edited or deleted.

## Story US-13 Security and Compatibility
As a platform owner, I want secure and compatible operation.

### Acceptance Criteria
- Auth is mandatory for cloud routes.
- TLS is required in deployed environment.
- App supports modern desktop and laptop browsers.
- Unauthorized share or edit attempts are rejected.
