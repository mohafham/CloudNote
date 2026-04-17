# Database Migrations

## Order
1. `0001_extensions.sql`
2. `0002_core_tables.sql`
3. `0003_indexes_search.sql`

## Apply Manually
```bash
psql "$DATABASE_URL" -f infra/db/migrations/0001_extensions.sql
psql "$DATABASE_URL" -f infra/db/migrations/0002_core_tables.sql
psql "$DATABASE_URL" -f infra/db/migrations/0003_indexes_search.sql
```

## Notes
- `notes.search_vector` is maintained by trigger for title-first and content search.
- `attachments.mime_type` is restricted to image formats and PDF by default.
- Sharing is modeled with user collaborators (`note_collaborators`) and public links (`note_share_links`).
