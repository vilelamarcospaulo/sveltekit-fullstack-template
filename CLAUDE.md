# SvelteKit fullstack template — foundation phase

Sibling scaffold to `../nextjs-fullstack-template`: same core idea (auth, Postgres via Drizzle/Hyperdrive, deploy to Cloudflare Workers), built the SvelteKit way rather than ported line-for-line. This file documents what's actually here — **foundation phase only** (see "What's deferred" below).

## Stack

- **SvelteKit 2** (Svelte 5, runes mode forced project-wide via `vite.config.ts`'s `compilerOptions.runes`) + Vite.
- **better-auth** (`better-auth/minimal` entry point — same lib, smaller bundle since it skips built-in Kysely adapters we don't use) — Google OAuth sign-in via its native SvelteKit integration (`better-auth/svelte-kit`).
- **Drizzle ORM** + Postgres, via `drizzle-orm/postgres-js` (the `postgres` driver) and a Hyperdrive binding in production.
- **@sveltejs/adapter-cloudflare** — deploys to Cloudflare Workers (Workers target, not Pages).
- **shadcn-svelte-style components**, hand-written (see "shadcn-svelte CLI" below for why) + Tailwind v4.
- **Vitest** — `client` project (browser-mode, Playwright-driven, `*.svelte.test.ts`) and `server` project (Node, everything else) — SvelteKit's own default split from `sv add vitest`.

## Architecture

No `domain`/`use_case` layering yet (unlike the Next template) — foundation has no business logic beyond auth wiring, so there's nothing to isolate from the framework yet. That layering returns once profile CRUD / org multi-tenancy land (a `$lib/internal/domain` + `$lib/internal/use_case` split, mirroring the Next template's `src/internal/`).

- `src/lib/server/` — infra, compiler-enforced server-only (SvelteKit blocks any client-side import of this path — stronger than the Next template's convention-based `src/lib` separation):
  - `db/index.ts` — `getDb(platform?)`, `db/schema.ts` (app-owned tables, currently empty) + `db/auth.schema.ts` (better-auth-owned tables, generated — see below).
  - `auth.ts` — `getAuth(platform?)`.
  - `env.ts` — validated env reader.
  - `logger.ts` — dependency-free JSON console logger.
- `src/lib/auth-client.ts` — browser-side better-auth client (`better-auth/svelte`).
- `src/lib/components/ui/` — hand-written shadcn-svelte-style components (`button/` so far).
- `src/lib/components/` — app-specific components (`sign-in-button.svelte`).
- `src/hooks.server.ts` — mounts better-auth and populates `event.locals.session`/`user` once per request.
- `src/routes/` — pages, layouts, form actions, `+server.ts` handlers.

### SvelteKit vs. Next.js mapping (for context coming from the sibling template)

| Next.js (RSC)                                                | This app (SvelteKit)                                                                                                                                                |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| async Server Component fetching data                         | `+page.server.ts` / `+layout.server.ts` `load` function                                                                                                             |
| Server Action (`"use server"`)                               | form action (`+page.server.ts`'s `actions`) — not used yet in this phase                                                                                            |
| Route Handler (`app/api/*/route.ts`)                         | `+server.ts`                                                                                                                                                        |
| `middleware.ts` / `proxy.ts`                                 | `src/hooks.server.ts`'s `handle`                                                                                                                                    |
| `cache()`-wrapped session getter (dedup per RSC render pass) | `event.locals`, populated once in `hooks.server.ts` — every `load`/action/`+server.ts` for that request just reads it, no separate dedup wrapper needed             |
| `"use client"` directive                                     | nothing — every `.svelte` file does both SSR and interactivity                                                                                                      |
| convention-based `src/lib` server/client split               | compiler-enforced: importing `$lib/server/*` from client code fails the build                                                                                       |
| `getCloudflareContext()` (context-free, works anywhere)      | `event.platform` (request-scoped only — no context-free equivalent) — this is why `getDb`/`getAuth` take `platform` as a parameter instead of reading it internally |

## Auth

`src/lib/server/auth.ts`'s `getAuth(platform?)` builds a **fresh** better-auth instance per call — never cached at module scope. Reason: betterAuth() captures a concrete Drizzle client (and thus a `postgres` driver socket) at construction time; caching it would reuse a Workers TCP socket across requests in the same isolate, which isn't safe (same class of bug `db/index.ts` avoids — see below). `getEnv()` runs eagerly inside `getAuth()`, safe because it's itself request-scoped-safe.

- Google is the sole social provider. `rateLimit.enabled: false` — better-auth's built-in rate limiter uses per-process memory storage, which doesn't work across Cloudflare Workers' many concurrent, ephemeral isolates; a placeholder until a durable store (KV/D1) backs it, same reasoning as the Next template.
- `src/hooks.server.ts` is the **only** place `getAuth(...).api.getSession(...)` gets called per request — it populates `event.locals.session`/`user`, and mounts better-auth's own `/api/auth/*` routes via `svelteKitHandler`. Everything downstream (`load` functions, form actions, `+server.ts`) reads `event.locals` instead of calling `getSession` again.
- Client-side sign-in/out (`src/lib/auth-client.ts`, `src/lib/components/sign-in-button.svelte`) calls better-auth's client library directly (`signIn.social(...)`, `signOut()`) rather than a SvelteKit form action — this matches better-auth's own recommended SvelteKit pattern (the OAuth redirect flow is easier to drive from the client) and mirrors the Next template's identical choice for the same UI.

### Auth schema generation

`src/lib/server/db/auth.schema.ts` is **generated**, not hand-written (unlike the Next template, which hand-ported the schema with detailed comments cross-referencing better-auth's internals). Regenerate after changing `auth.ts`'s options (e.g. adding the organization plugin later):

```
pnpm run auth:schema   # runs: better-auth generate --config src/lib/server/auth.ts --output src/lib/server/db/auth.schema.ts --yes
```

**Gotcha**: the better-auth CLI needs a directly-constructed `export const auth = betterAuth({...})` to statically introspect — it does not accept a factory function. `getAuth(platform?)` in the real code is a factory (see "Auth" above), so if you need to regenerate the schema, temporarily swap in a plain singleton export (calling `getDb()`/`getEnv()` with no `platform` — the `DATABASE_URL` fallback covers this CLI context), run `auth:schema`, then revert to the factory. The generated schema doesn't depend on how `auth.ts` structures its exports, only on the `betterAuth()` options.

## Database

Same Hyperdrive-first/`DATABASE_URL`-fallback pattern as the Next template, adapted to SvelteKit:

- `src/lib/server/db/index.ts` exports `getDb(platform?: App.Platform): DrizzleDb` — never a cached singleton. A deployed Worker resolves `platform.env.HYPERDRIVE.connectionString`; everywhere else (Vitest, `drizzle-kit`, or `vite dev` if the binding isn't resolved) falls back to `$env/dynamic/private`'s `DATABASE_URL`.
- Driver: `drizzle-orm/postgres-js` (the `postgres` package), not `pg` — both work over Hyperdrive, this is just what `sv add drizzle` scaffolded. `nodejs_compat` is in `wrangler.jsonc`'s `compatibility_flags` because `postgres` needs Node's `net`/`tls` shims under `workerd`.
- Schema: `src/lib/server/db/schema.ts` re-exports `auth.schema.ts` (generated, see above) plus any app-owned tables (none yet).
- Config: `drizzle.config.ts`.
- Migrations/schema push: `pnpm run db:generate` + `db:migrate` (versioned SQL migrations) or `pnpm run db:push` (direct schema push, no migration files — faster for early-stage local iteration). `pnpm run db:studio` opens Drizzle Studio.

## Deployment

Single Cloudflare Worker for this phase (`wrangler.jsonc`) — the two-Worker split (app + independent Cloudflare Queues consumer, matching the Next template) arrives with the queue-demo phase.

- `pnpm run build` runs `wrangler types --check && vite build` (adapter-cloudflare outputs to `.svelte-kit/cloudflare/`).
- `pnpm run preview` runs the built Worker locally via `wrangler dev`, pinned to port 5173 (not `wrangler dev`'s own default of 4173) — deliberately matching `ORIGIN`/`vite dev`'s port. better-auth's `svelteKitHandler` compares the incoming request's actual origin against `baseURL` (`ORIGIN`) to decide whether a path is one of its own auth routes (`isAuthPath` in `better-auth/dist/integrations/svelte-kit.mjs`); a port mismatch there doesn't error, it silently falls through to SvelteKit's own router and 404s. If you ever run preview on a different port, update `ORIGIN` in `.env` to match, or every `/api/auth/*` request 404s.
- `pnpm run gen` regenerates `worker-configuration.d.ts` (the `Env` type) from `wrangler.jsonc` — rerun after changing bindings.
- Hyperdrive: `wrangler.jsonc`'s `hyperdrive[0].id` is a placeholder — replace with the id `wrangler hyperdrive create` prints for a real deploy. Not needed for local dev (`localConnectionString` covers that).
- `deploy/local/docker-compose.yaml` from the Next template became `compose.yaml` at the repo root here — that's `sv add drizzle`'s own convention (`pnpm run db:start` / `docker compose up -d`), not a deviation worth fighting.

**Gotcha**: run `pnpm run check` _before_ `pnpm run build`, not after (without cleaning). `@sveltejs/adapter-cloudflare`'s ambient typings pull in whatever's currently at `.svelte-kit/cloudflare/_worker.js` / `.svelte-kit/cloudflare-tmp/manifest.js` — `tsconfig.json`'s `exclude` can't block this, since `exclude` only stops the initial glob-discovery, not files reached via a reference from an already-included file. Before a build, those paths don't exist and `check` is clean; after a build, the bundled (unstrict, non-`checkJs`-clean) output gets swept into the type-check and produces dozens of spurious implicit-`any` errors that have nothing to do with your source. If you hit this, `rm -rf .svelte-kit/cloudflare .svelte-kit/cloudflare-tmp` and rerun `check`.

## shadcn-svelte CLI

`src/lib/components/ui/` components are **hand-written**, not generated via `shadcn-svelte init`/`add`. The CLI's `init` flow (v1.4.2) added a "choose a preset" step that fetches a preset list from a remote registry and hung indefinitely in this environment across multiple retries (network was reachable — `curl` to the registry host succeeded — the CLI's own flow just never progressed). Rather than keep fighting it, the component files were written by hand following the same structure the CLI would produce (`components.json`, `$lib/utils.ts`'s `cn()`, `cva`-based variants) — this is a reasonable fallback given shadcn's own philosophy is "you own these files" rather than an installed dependency. If the CLI's preset flow works in your environment, `shadcn-svelte add <component>` should still work against the existing `components.json` for new components; if it hangs again, hand-write following `button/` as the template.

## Testing

`vite.config.ts` defines two Vitest projects (via `@vitest/browser-playwright`, SvelteKit's own default from `sv add vitest`):

- **client** — `src/**/*.svelte.{test,spec}.{js,ts}`, real browser (Chromium via Playwright), excludes `src/lib/server/**`.
- **server** — everything else matching `*.{test,spec}.{js,ts}`, Node environment.

No integration-vs-real-Postgres project yet, and no Miniflare-backed Workers-runtime test project (the Next template's `worker`/`app-worker` projects) — those return with the queue-demo and full-parity phases. `pnpm test` runs everything once (`pnpm run test:unit -- --run`); `pnpm run test:unit` watches.

## What's deferred (not in this phase)

- `organization`/`member`/`invitation` schema + better-auth's organization plugin, org switcher UI.
- Profile CRUD (`$lib/internal/domain`/`use_case` layers, `/profile` route, API route) — and with it, the `domain`/`use_case` architectural split.
- Cloudflare Queues demo: job domain/use_case, producer client, a second independently-deployed Worker for the consumer, traceId propagation.
- Full Vitest project matrix (integration-vs-real-Postgres, Miniflare worker/app-worker projects) and CI (GitHub Actions).
- shadcn-svelte components beyond `button` (avatar, dropdown-menu, card, etc.) — added as later features need them.

## Conventions

- Commit messages follow Conventional Commits (`feat(scope): ...`, `fix(scope): ...`, `chore: ...`) — same as the Next template.
- pnpm, not npm — `pnpm-workspace.yaml`'s `allowBuilds` explicitly disables native build scripts for `@prisma/client`/`better-sqlite3` (unused optional deps of `drizzle-kit` — this project is Postgres-only).
