<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Database changes

Connection configuration must be kept in the project `.env` (ignored by Git); `.env.example` contains placeholders only. Migration and startup scripts load `.env`. Existing server environment variables take precedence.

User requirement: keep all database deployment and migration scripts in `migration/`.
Every future PostgreSQL schema or stored-data transformation must be supplied as a new numbered SQL file in `migration/sql/` in the same change as the application code.
Never modify or delete an applied migration. Use the next migration number for corrections.
Do not introduce runtime CREATE/ALTER statements for new schema changes. Apply migrations through `migration/migrate.mjs` and update `migration/README.md` when deployment steps change.
Verify both a fresh database and upgrade/repeat application without losing existing records. Keep credentials out of tracked files.
