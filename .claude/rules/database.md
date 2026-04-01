---
paths:
  - "drizzle/**"
  - "server/db.ts"
---
# Database Rules

## Schema
- All tables defined in `drizzle/schema.ts` — single source of truth
- Relations in `drizzle/relations.ts`
- Use `mysqlTable`, `mysqlEnum`, `varchar`, `int`, `text`, `json`, `timestamp` from `drizzle-orm/mysql-core`
- Always include `id: int("id").autoincrement().primaryKey()`
- Always include `createdAt: timestamp("createdAt").defaultNow().notNull()`
- Export `Insert*` and select types: `typeof table.$inferInsert`, `typeof table.$inferSelect`

## Migrations
- Run `pnpm db:push` to generate + apply migrations via drizzle-kit
- Migrations are NOT auto-run on deploy — must run manually post-deploy
- Custom migrations in `drizzle/migrations/` run via `pnpm db:migrate`
- Never modify existing migration SQL files — create new ones

## Query Patterns
- All queries in `server/db.ts` as flat exported async functions
- Always `await getDb()` and handle null (DB may not be connected)
- Use `eq()`, `and()`, `desc()` from `drizzle-orm` for conditions/ordering
- For inserts: `(result as any)[0]?.insertId` to get auto-increment ID
- For upserts: `onDuplicateKeyUpdate({ set: {...} })`

## Health Check
- Required tables listed in `server/_core/index.ts` health endpoint
- When adding a new table, update the `requiredTables` array in the health check
