-- Full bootstrap schema for Cloud Notes Platform.
-- For iterative deployments, prefer running individual scripts in infra/db/migrations.

\i infra/db/migrations/0001_extensions.sql
\i infra/db/migrations/0002_core_tables.sql
\i infra/db/migrations/0003_indexes_search.sql
