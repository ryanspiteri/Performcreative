---
paths:
  - "client/**/*.tsx"
  - "client/**/*.ts"
  - "client/**/*.css"
---
# Frontend Rules

## Routing
- Uses Wouter (not React Router) — `<Route path="..." component={...} />`
- All authenticated routes go inside `AuthenticatedRoutes` in `client/src/App.tsx`
- Wrap in `<AppLayout>` for sidebar navigation

## Components
- UI primitives: Shadcn UI in `client/src/components/ui/` — do not modify these directly
- Custom components in `client/src/components/`
- Pages in `client/src/pages/` — one component per route

## Data Fetching
- Use tRPC React Query hooks: `trpc.routerName.procedure.useQuery()` / `.useMutation()`
- tRPC client configured in `client/src/lib/trpc.ts`
- Invalidate queries after mutations: `utils.routerName.procedure.invalidate()`

## Styling
- Tailwind CSS v4 with `tw-animate-css`
- Use `cn()` utility from `client/src/lib/utils.ts` for conditional classes
- Dark theme by default via `ThemeProvider` (next-themes)
- Follow existing Shadcn patterns for consistent spacing and color tokens

## State
- Server state via TanStack Query (through tRPC)
- Local state via React hooks — no global state library
- Auth state via `useAuth()` hook from `client/src/_core/hooks/useAuth.ts`

## Forms
- Use `react-hook-form` with `@hookform/resolvers` for Zod validation
- Shadcn `<Form>` components for consistent form UI
