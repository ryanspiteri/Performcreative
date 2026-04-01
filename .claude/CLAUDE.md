# PerformCreative — Project Brain

@CLAUDE.md

## Architecture

Single-app monorepo: Express server serves both tRPC API and Vite-built React SPA.

```
client/           → React SPA (Vite + Shadcn UI + Wouter routing)
  src/pages/      → Page components (one per route)
  src/components/ → Shared + UI components (Shadcn in ui/)
  src/lib/        → tRPC client, utils
  src/hooks/      → Custom React hooks
server/           → Express backend
  _core/          → Framework plumbing (index, trpc, context, env, oauth, vite)
  routers/        → tRPC router modules (canva, organic)
  routers.ts      → Root appRouter merging all sub-routers
  services/       → Business logic (pipelines, AI integrations, sync)
  config/         → Brand asset configs
  db.ts           → All database query helpers (single file)
  storage.ts      → S3-compatible file storage via Forge proxy
shared/           → Code shared between client + server (types, constants, errors)
drizzle/          → Schema, relations, migrations (SQL + meta snapshots)
  schema.ts       → All table definitions (source of truth)
  relations.ts    → Drizzle relation definitions
  migrations/     → Custom migration SQL scripts
```

## Key Patterns

### tRPC
- Router defined in `server/routers.ts`, sub-routers in `server/routers/`
- Three procedure levels: `publicProcedure`, `protectedProcedure` (requires user), `adminProcedure` (requires admin role)
- Client uses `@trpc/react-query` via `client/src/lib/trpc.ts`
- Transformer: superjson

### Auth
- OAuth flow via Manus SDK (`server/_core/sdk.ts` → `server/_core/oauth.ts`)
- JWT cookie-based sessions (`server/_core/cookies.ts`)
- Context extracts user from request (`server/_core/context.ts`)
- Admin check: `user.role === 'admin'` (owner auto-promoted via `OWNER_OPEN_ID`)

### Database
- MySQL on DigitalOcean, connected via `DATABASE_URL`
- Drizzle ORM with `mysql2` driver
- Lazy singleton connection in `server/db.ts` → `getDb()`
- All DB helpers in `server/db.ts` (no repository pattern — flat export functions)
- Migrations: `pnpm db:push` generates + runs via drizzle-kit

### File Storage
- S3-compatible via Forge proxy (`BUILT_IN_FORGE_API_URL` + `BUILT_IN_FORGE_API_KEY`)
- `storagePut(key, data, contentType)` → `{ key, url }`
- Large uploads use multer middleware (bypasses tRPC), routes in `server/_core/index.ts`

### AI Services
- Claude/Anthropic for briefs, analysis, scripts (`server/services/claude.ts`)
- Gemini for image generation (`server/services/geminiPromptBuilder.ts`)
- OpenAI Whisper for transcription (`server/services/whisper.ts`)
- LLM service layer in `server/_core/llm.ts`

### Pipelines
- **Video pipeline**: competitor ad → transcript → scripts → ClickUp tasks
- **Static pipeline**: image analysis → brief → Gemini generation → review
- **Iteration pipeline**: winning ad → analysis → variations
- **UGC clone**: upload video → transcribe → extract structure → generate variants
- **Organic video**: content creation for social media
- **Face swap**: portrait validation → Magic Hour API

## Common Workflows

### Adding a new tRPC endpoint
1. Add procedure to relevant router in `server/routers/` or `server/routers.ts`
2. Import any new DB helpers from `server/db.ts`
3. Call from client via `trpc.routerName.procedureName.useQuery()` or `.useMutation()`

### Adding a new DB table
1. Define table in `drizzle/schema.ts`
2. Add relations in `drizzle/relations.ts` if needed
3. Run `pnpm db:push` to generate + run migration
4. Add query helpers in `server/db.ts`
5. Update health check table list in `server/_core/index.ts`

### Adding a new page
1. Create component in `client/src/pages/`
2. Add route in `client/src/App.tsx` inside `AuthenticatedRoutes`
3. Add sidebar nav link in `client/src/components/AppLayout.tsx`

## Commands
- `pnpm dev` — Start dev server (port 3000, hot reload)
- `pnpm build` — Production build (Vite client + esbuild server → dist/)
- `pnpm start` — Run production server
- `pnpm test` — Run vitest
- `pnpm check` — TypeScript check (no emit)
- `pnpm db:push` — Generate + run Drizzle migrations
- `pnpm format` — Prettier format all files

## Products
Active ONEST products defined in `drizzle/schema.ts` → `ACTIVE_PRODUCTS` array:
Hyperburn, Thermosleep, Hyperload, Thermoburn, Carb Control, Protein + Collagen, Creatine, HyperPump, AminoLoad, Marine Collagen, SuperGreens, Whey ISO Pro
