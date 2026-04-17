# Cloud Notes Platform - Software Requirements Specification

Version: 1.0  
Date: 2026-04-15

## 1. Purpose
This document defines the functional and non-functional requirements for a cloud-based notes platform with real-time collaboration, sharing, and productivity features.

## 2. Scope
The system allows users to create, manage, organize, search, and share notes and checklists across devices. Registered users receive cloud sync and collaboration features. Guest users can use local notes with limited functionality.

## 3. User Roles
- Guest User: Can use local notes only, no cloud sync or collaboration.
- Registered User: Full cloud note management, sharing, syncing, attachments.
- Collaborator: External user with View or Edit permission on shared notes.

## 4. Functional Requirements

### FR-01 Authentication and Guest Access
- FR-01.1 The system shall allow users to register and sign in with credentials.
- FR-01.2 The system shall support persistent login after first successful sign-in.
- FR-01.3 The system shall provide a Guest mode option.
- FR-01.4 Guest mode shall show the warning text: You will not receive cloud benefits.
- FR-01.5 Guest users shall not have cloud sync, sharing, or collaboration features.

### FR-02 Basic Notes Operations
- FR-02.1 Users shall create notes from a prominent plus button on the home screen.
- FR-02.2 Note creation and editing shall use a lightweight popup workflow similar to sticky-note apps.
- FR-02.3 Users shall edit and delete notes.
- FR-02.4 Users shall view all saved notes on the home screen.
- FR-02.5 Each note shall support a user-defined title.

### FR-03 Folders and Organization
- FR-03.1 Users shall create, rename, and delete folders.
- FR-03.2 Folders and notes shall appear on the home screen.
- FR-03.3 Folder cards shall be visually distinct from note cards.
- FR-03.4 A folder shall contain multiple content types: normal notes and checklists.

### FR-04 Checklist Support
- FR-04.1 Users shall create checklists from the home screen.
- FR-04.2 Users shall create checklists inside folders.
- FR-04.3 Users shall embed checklists inside normal notes.
- FR-04.4 Checklists on the home screen shall be directly interactive without opening a popup.
- FR-04.5 Checklist behavior shall support task-style interactions: add item, mark complete, unmark, delete item, and reorder items.

### FR-05 Sharing and Permissions
- FR-05.1 Every note shall have a Share action in note edit popup.
- FR-05.2 Every note shall expose Share action on card hover from the home page.
- FR-05.3 Share shall support copy-link flow.
- FR-05.4 During sharing, user shall select access level: View only or Can edit.
- FR-05.5 The system shall support public sharing link for allowed notes.
- FR-05.6 Note owner shall be able to change or revoke sharing access.

### FR-06 Search and Navigation
- FR-06.1 The home page shall have a search bar at the top.
- FR-06.2 Search shall be keyword-based and case-insensitive.
- FR-06.3 Search results priority shall be: title matches first, then note body matches.
- FR-06.4 Selecting a search result shall open or focus the corresponding note.

### FR-07 Cloud Storage and Sync
- FR-07.1 Registered user notes shall be stored in cloud storage.
- FR-07.2 Notes shall be available across user devices after sign-in.
- FR-07.3 Changes shall sync automatically without manual refresh.

### FR-08 Attachments
- FR-08.1 Users shall upload files inside notes.
- FR-08.2 Supported attachment types shall include images and PDF files.
- FR-08.3 Attached files shall be displayed as clean attachment cards similar to email attachment UI.
- FR-08.4 Users shall remove attachments from notes.

### FR-09 Real-Time Collaboration
- FR-09.1 Multiple users shall edit the same note simultaneously.
- FR-09.2 Edits made by one collaborator shall be reflected to others in near real time.
- FR-09.3 Access control rules (View or Edit) shall be enforced during collaboration.

### FR-10 Inter-Note Linking
- FR-10.1 Users shall link one note inside another note using keyword mention syntax.
- FR-10.2 Linked note references shall be clickable and open the target note.

### FR-11 Voice-to-Text and Diagram Tools
- FR-11.1 Users shall create voice-to-text note content.
- FR-11.2 Users shall create simple diagrams inside notes.
- FR-11.3 Diagram content shall be saved as part of note data.

### FR-12 Theme and UX
- FR-12.1 The UI theme shall follow a cozy, Discord-inspired visual style.
- FR-12.2 Colors and contrast shall prioritize readability and reduced eye strain.
- FR-12.3 Core interactions (create, edit, share, search) shall be simple and low-friction.

## 5. Non-Functional Requirements

### NFR-01 Performance
- NFR-01.1 The main views shall respond within a few seconds under normal network conditions.
- NFR-01.2 Note save operations shall complete without noticeable delay.
- NFR-01.3 Search results for typical datasets shall return quickly.
- NFR-01.4 Collaboration updates shall propagate quickly after edits.

### NFR-02 Security
- NFR-02.1 Authentication is required for cloud-enabled user data.
- NFR-02.2 Data in transit shall be protected with TLS.
- NFR-02.3 Sensitive cloud data shall be stored securely.
- NFR-02.4 Sharing permissions shall prevent unauthorized editing.

### NFR-03 Compatibility
- NFR-03.1 The system shall run on common modern browsers.
- NFR-03.2 The system shall support desktop and laptop devices.

### NFR-04 File Handling
- NFR-04.1 The system shall support file upload and attachment workflows.
- NFR-04.2 Maximum file size limits shall be enforced by configuration.
- NFR-04.3 Unsupported file types shall be rejected with clear messages.

### NFR-05 Collaboration Quality
- NFR-05.1 Multiple users shall be able to access and edit shared notes.
- NFR-05.2 Collaborative changes shall reflect quickly and consistently.

## 6. Assumptions
- Guest mode data is stored locally in browser storage.
- Cloud features are available only for registered users.
- Public link behavior can be configured by workspace security policy.

## 7. Out of Scope for Initial Release
- Offline-first conflict resolution for long offline sessions.
- Advanced diagramming beyond simple shapes/connectors.
- Enterprise admin and audit console.

## 8. Acceptance Criteria Summary
- User can register/login and use cloud notes across devices.
- Guest mode is available and displays cloud-benefit warning.
- User can create/edit/delete/view notes and checklists.
- User can organize notes with visually distinct folders.
- User can share notes by link with View or Edit permission.
- Search returns title matches before content matches.
- Attachments (images, PDF) can be uploaded and displayed.
- Multiple collaborators can edit same note with visible live changes.
- Voice-to-text and simple diagrams can be added inside notes.
