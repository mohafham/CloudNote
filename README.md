# Cloud Notes Platform Monorepo

This workspace scaffolds a cloud-first notes platform based on the SRS in `docs/SRS.md`.

## Workspace Structure
- `apps/frontend` - React + Vite UI shell (Discord-inspired cozy theme)
- `apps/backend` - Express + PostgreSQL REST API
- `apps/realtime` - WebSocket collaboration gateway
- `packages/shared` - Shared TypeScript types/contracts
- `infra/db` - SQL schema and migration scripts
- `tests/acceptance` - BDD acceptance feature files
- `docs` - SRS, architecture, roadmap, user stories

## Quick Start
1. Copy `.env.example` to `.env` and fill secrets.
2. Start infrastructure:
   - `docker compose up -d`
3. Create database (if needed):
   - `pnpm db:create`
4. Apply database migrations:
   - `pnpm db:migrate`
5. Install dependencies:
   - `pnpm install`
6. Run all apps:
   - `pnpm dev`

## Realtime Model
The realtime service provides note rooms and broadcasts note and checklist events. The payload contract aligns with `docs/openapi.yaml` and backend auth expectations.

## Storage Model
Attachments use S3-compatible object storage (MinIO in local development). Backend endpoints mint upload/download URLs and persist attachment metadata in PostgreSQL.

## Continuous Integration
On every push, GitHub Actions executes:
1. PostgreSQL service startup
2. Database creation (`pnpm db:create`)
3. SQL migration application (`pnpm db:migrate`)
4. Backend integration tests (`pnpm --filter @cloud-notes/backend test:integration`)

Workflow file:
- `.github/workflows/backend-ci.yml`
