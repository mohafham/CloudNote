# Acceptance Test Suite (BDD)

These feature files encode acceptance scenarios from `docs/User_Stories_Acceptance_Tests.md`.

## Suggested Runner
- Cucumber.js or Playwright + Gherkin adapter

## Feature Coverage
- `auth_guest.feature` -> registration, login, guest warning
- `notes_folders_checklists.feature` -> CRUD, folders, checklist interactions
- `sharing_permissions.feature` -> share links, collaborators, permission enforcement
- `search_attachments_linking.feature` -> search, attachments, note links
- `realtime_sync.feature` -> realtime collaboration and cloud sync behavior
