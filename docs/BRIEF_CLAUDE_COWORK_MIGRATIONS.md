# Brief for Claude Co-work: Run DB Migrations

## Context

We added two features to Perform Creative that require new database columns:

1. **Default product render** — Pipelines need to know which product image to use when there are multiple uploads. We added an `isDefault` flag on `product_renders` (one default per product).
2. **Competitor Ad mode in Iterate** — Users can run the Iterate pipeline from “our ad” or “competitor ad” and choose “adapt concept” vs “match style”. We added `iterationSourceType` and `iterationAdaptationMode` on `pipeline_runs`.

The SQL that adds these columns and backfills data lives in:

- `drizzle/migrations/0020_add_is_default_product_renders.sql`
- `drizzle/migrations/0021_add_iteration_source_type_adaptation.sql`

A script runs these for us: `scripts/run-custom-migrations.ts`. NPM commands: `npm run db:migrate` (or `npm run db:migrate:node` if tsx has issues).

## What’s done

- `.env` exists in the project root with `DATABASE_URL` pointing at the DigitalOcean MySQL instance (host, port 25060, username doadmin, password from App Platform / secure store).
- `.env` is in `.gitignore` and is not committed.
- The migration script and both SQL files are in the repo.

## What’s blocking

Running `npm run db:migrate` **from a local machine** fails with **connection ETIMEDOUT**. The database is not reachable from that network (likely because DigitalOcean MySQL only allows connections from trusted sources / App Platform, not from arbitrary IPs).

So the migrations have **not** been applied yet. The app will error when it tries to use the new columns until these migrations are run from a context that **can** reach the database.

## What we need you to do

**Goal:** Run the two custom migrations (0020 and 0021) against the same database the app uses, so the new columns exist and the app can use the new features.

**Option A — Run from somewhere that can reach the DB**

1. Use an environment that already has network access to the DigitalOcean MySQL instance (e.g. a DigitalOcean Droplet, App Platform one-off run, or a machine whose IP is in the DB’s “Trusted sources”).
2. In that environment, clone/pull the repo, add a `.env` with the same `DATABASE_URL` (get it from the team / App Platform / secure store).
3. From the project root run:  
   `npm run db:migrate`  
   or, if tsx fails:  
   `npm run db:migrate:node`
4. Confirm you see “Running 0020…”, “Running 0021…”, and “Migrations finished.”

**Option B — Run the SQL manually**

1. Connect to the same MySQL database using whatever client already works (e.g. DigitalOcean’s web SQL console, TablePlus, MySQL Workbench), using the same host, port, user, and database as in `DATABASE_URL`.
2. Run the contents of `drizzle/migrations/0020_add_is_default_product_renders.sql` (ALTER + UPDATE).
3. Run the contents of `drizzle/migrations/0021_add_iteration_source_type_adaptation.sql` (ALTER with two new columns).
4. If the columns already exist, you can ignore “Duplicate column” errors.

## How to verify

- After Option A or B, the database should have:
  - `product_renders.isDefault` (int, 0/1), with at least one row per product having `isDefault = 1` after the 0020 backfill.
  - `pipeline_runs.iterationSourceType` (enum: own_ad, competitor_ad) and `pipeline_runs.iterationAdaptationMode` (enum: concept, style, nullable).
- The app should then start without “Unknown column” errors when using default product render or Competitor Ad Iterate.

## Security

- Do not commit `.env` or paste real credentials into the brief.
- Use the team’s existing secure channel (e.g. 1Password, App Platform env, shared secret store) to get `DATABASE_URL` or the equivalent connection details for the environment where you run the migrations.

---

**Summary for Co-work:** Get the app’s `DATABASE_URL` into an environment that can reach the DB, then run `npm run db:migrate` (or the two SQL files by hand). Confirm both migrations complete so the new columns exist.
