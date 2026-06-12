# CLAUDE.md

## 항상 무조건 한글로 답변

## 명확하지 않은 요청 처리 규칙
- 요청이 모호하거나 변경 범위가 불분명한 경우, 편집을 시작하기 전에 반드시 간결한 확인 질문을 먼저 한다.
- 사소한 변경(타이핑 수정, 변수명 변경 등)은 즉시 처리해도 된다.
- 복잡하거나 영향 범위가 큰 작업은 구현 전에 반드시 핵심 사항을 먼저 확인한다.
- 질문은 열린 질문보다 a/b/c 선택형이나 yes/no 형태로 한다.
- 사용자가 "그냥 해줘"라고 하면, 가정한 사항들을 번호 목록으로 제시하고 승인을 받은 뒤 진행한다.
- 명확하게 지시하지 않은 변경은 반드시 승인 후에 처리

## 작업이 완료되면 커밋 메시지 작성해서 커밋

## 작업이 완료되면 어떤 요청이였는지 간략히 정리

## caveman
Terse like caveman. Technical substance exact. Only fluff die.
Drop: articles, filler (just/really/basically), pleasantries, hedging.
Fragments OK. Short synonyms. Code unchanged.
Pattern: [thing] [action] [reason]. [next step].

ACTIVE EVERY RESPONSE. No revert. 

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.
When the user types `/graphify`, invoke the `skill` tool with `skill: "graphify"` before doing anything else.
Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SvelteForge Factory Cost is a SvelteKit admin dashboard using Svelte 5, Tailwind CSS v4, custom session-based auth with Arctic OAuth, and Drizzle ORM with SQLite.

## Commands

```bash
pnpm dev              # Start dev server
pnpm build            # Production build
pnpm preview          # Preview production build
pnpm check            # Type-check with svelte-check
pnpm check:watch      # Type-check in watch mode

pnpm db:generate      # Generate Drizzle migrations from schema
pnpm db:push          # Push schema changes directly to database
pnpm db:studio        # Open Drizzle Studio GUI
pnpm db:seed          # Seed database with sample data (npx tsx)

pnpm test             # Run all unit tests (Vitest)
pnpm test:watch       # Run tests in watch mode
pnpm test:e2e         # Run E2E tests (Playwright)

# Run a single test file
npx vitest run src/routes/\(app\)/users/users.test.ts

pnpm lint             # ESLint
pnpm format           # Prettier (write)
pnpm format:check     # Prettier (check only)
```

## Architecture

### Tech Stack

- **Svelte 5** with runes API (`$props`, `$state`, `$derived`, `{@render}`)
- **Tailwind CSS v4** — native CSS with `@theme` directive in `src/app.css`, no JS config file. OKLCH color system
- **shadcn-svelte** — UI components in `$lib/components/ui/`, added via `npx shadcn-svelte@latest add <component>`
- **Custom session auth** — SHA-256 hashed tokens with @oslojs/crypto, Argon2id password hashing, optional OAuth via Arctic (Google, GitHub)
- **Drizzle ORM** — SQLite with better-sqlite3, WAL mode. Schema in `src/lib/server/db/schema.ts`
- **LayerChart v2** — D3-based charts. Marked `noExternal` in `vite.config.ts` alongside `svelte-ux` for SSR compatibility
- **Package manager:** pnpm

### Routing & Auth

Routes use SvelteKit route groups for layout separation:

- `(app)/` — Protected routes. Auth guard in `(app)/+layout.server.ts` redirects unauthenticated users to `/login`
- `(auth)/` — Public auth routes (login, register, OAuth callbacks at `login/google/`, `login/github/`)
- `(public)/` — Public pages (pricing)
- `logout/` — Standalone logout action (server-only)
- `api/search/` — Search endpoint for command palette
- `sitemap.xml/` — Auto-generated sitemap

Session validation runs on every request via `hooks.server.ts`, populating `event.locals.user` and `event.locals.session`. OAuth providers are environment-driven — see `.env.example` for configuration.

`event.locals.user` is `SessionUser` (a subset of `User` — no `passwordHash`, no timestamps). Use the full `User` type only when querying the DB directly.

Sessions live 30 days and auto-extend whenever a request arrives with <15 days remaining (logic in `validateSession`). The cookie holds the raw token; the DB stores its SHA-256 hash as the session ID — a leaked DB cannot be used to forge sessions.

The `(app)/+layout.server.ts` guard also enforces **maintenance mode**: when `appSettings.maintenanceMode === "true"`, non-admin users get a 503. Admins bypass it.

### Key Directories

- `src/lib/server/` — Server-only code (auth, OAuth, database). Never import from client-side code
- `src/lib/server/auth.ts` — Session management (create, validate, invalidate, cookies)
- `src/lib/server/oauth.ts` — Arctic OAuth providers (conditional on env vars)
- `src/lib/server/db/schema.ts` — Drizzle schema (users, sessions, pages, notifications, oauthAccounts, appSettings, passwordResetTokens)
- `src/lib/server/db/seed.ts` — Database seeder (run via `pnpm db:seed`, uses `npx tsx` not SvelteKit aliases)
- `src/lib/server/id.ts` — Crypto ID generator (`generateId()`)
- `src/lib/components/ui/` — shadcn-svelte components (don't edit directly, re-add to update)
- `src/lib/components/` — App-level components (sidebar, theme toggle, command palette, notification bell)
- `src/lib/hooks/` — Svelte 5 reactive utilities (e.g., `is-mobile.svelte.ts`)
- `src/lib/utils.ts` — `cn()` helper (clsx + tailwind-merge) and component type utilities
- `src/lib/utils/` — Export utilities (CSV/JSON), user-agent parser

### Database

SQLite database file: `svelteforge.db` (project root, gitignored). Roles enum: `admin | editor | viewer`. First registered user gets `admin` role.

**Notifications with `userId = NULL` are global** — every user sees them. Per-user notifications set `userId` to the recipient. The `(app)/+layout.server.ts` filter (`eq(userId, X) OR isNull(userId)`) is the canonical pattern for any notification query.

### Testing

Tests co-locate with their route: e.g., `src/routes/(app)/users/users.test.ts` tests the `users/+page.server.ts` load and actions.

**Test DB pattern:** Tests mock `$lib/server/db/index.js` with a getter that returns an in-memory SQLite database created via `createTestDb()` from `test-utils.ts`. The mock must be set up before dynamically importing the server module:

```ts
vi.mock("$lib/server/db/index.js", () => ({
	get db() {
		return testDb;
	},
}));
const { load, actions } = await import("./+page.server.js");
```

After modifying `schema.ts`, also update the `SCHEMA_SQL` in `test-utils.ts` and run `pnpm db:push`.

`test-utils.ts` also exports `createTestUser(db, overrides)`, `createMockLocals(userId, role)`, `createFormData(entries)`, and `createMockRequest(formData)` — use these instead of hand-rolling fixtures in each test. `createTestUser` hashes `"password123"` with the same Argon2id parameters used in production.

### Patterns

- Forms use SvelteKit form actions with `use:enhance` for progressive enhancement
- Dark/light mode via `mode-watcher` — use `mode.current` (runes object), NOT `$mode`
- App shell layout: sidebar (`app-sidebar.svelte`) + topbar with breadcrumbs (generated from URL pathname)
- `App.Locals` typed in `src/app.d.ts` — `user: SessionUser | null`, `session: Session | null`
- `seed.ts` runs outside SvelteKit context — use relative imports (not `$lib/`) and `generateId()` from `$lib/server/id.js`
- LayerChart and `svelte-ux` must stay in `ssr.noExternal` in `vite.config.ts` — without it, SSR breaks on chart pages
