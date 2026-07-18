# SvelteKit Starter Kit (foundation phase)

A SvelteKit sibling to [`nextjs-fullstack-template`](../nextjs-fullstack-template): same core idea — Google OAuth sign-in, Drizzle/Postgres via Hyperdrive, deployed to Cloudflare Workers — built the SvelteKit way rather than ported line-for-line. See [`CLAUDE.md`](./CLAUDE.md) for the full architecture writeup and what's deferred to later phases.

## Stack

- **[SvelteKit 2](https://svelte.dev/docs/kit)** (Svelte 5, runes) + Vite
- **[better-auth](https://www.better-auth.com)** — Google OAuth sign-in, native SvelteKit integration
- **[Drizzle ORM](https://orm.drizzle.team)** + Postgres, via `drizzle-orm/postgres-js`, with a [Hyperdrive](https://developers.cloudflare.com/hyperdrive/) binding in production
- **[@sveltejs/adapter-cloudflare](https://developers.cloudflare.com/workers/framework-guides/web-apps/sveltekit/)** — deploys the app to Cloudflare Workers
- **shadcn-svelte-style components** (hand-written — see `CLAUDE.md`) + Tailwind v4
- **[Vitest](https://vitest.dev)** — browser-mode component tests + Node server tests

## Getting started

You'll need Node.js 20.9+, pnpm, and a Postgres database.

**1. Install dependencies**

```bash
pnpm install
```

**2. Start Postgres**

```bash
pnpm run db:start
```

Or point `DATABASE_URL` at any Postgres instance you already have.

**3. Configure environment variables**

```bash
cp .env.example .env
```

Fill in `BETTER_AUTH_SECRET` (generate with `openssl rand -base64 32`) and `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` (from a [Google OAuth client](https://console.cloud.google.com/apis/credentials); authorized redirect URI `http://localhost:5173/api/auth/callback/google`) to sign in. Everything else has a working local default.

**4. Push the database schema**

```bash
pnpm run db:push
```

(Or `pnpm run db:generate` + `pnpm run db:migrate` for versioned migration files instead of a direct push.)

**5. Start the dev server**

```bash
pnpm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Scripts

| Command                               | Description                                                                                                      |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `pnpm run dev`                        | Start the dev server                                                                                             |
| `pnpm run build`                      | Production build (regenerates Cloudflare types, then `vite build`)                                               |
| `pnpm run preview`                    | Run the built Worker locally via `wrangler dev`                                                                  |
| `pnpm run gen`                        | Regenerate `worker-configuration.d.ts` from `wrangler.jsonc`                                                     |
| `pnpm run check` / `check:watch`      | Type-check (`svelte-check`)                                                                                      |
| `pnpm run lint`                       | Prettier check + ESLint                                                                                          |
| `pnpm run format`                     | Prettier write                                                                                                   |
| `pnpm test` / `test:unit`             | Run tests once / watch mode                                                                                      |
| `pnpm run db:push`                    | Push the Drizzle schema directly (no migration files)                                                            |
| `pnpm run db:generate` / `db:migrate` | Generate / apply versioned SQL migrations                                                                        |
| `pnpm run db:studio`                  | Open Drizzle Studio                                                                                              |
| `pnpm run auth:schema`                | Regenerate `src/lib/server/db/auth.schema.ts` from the better-auth config (see `CLAUDE.md` for the CLI's gotcha) |

## Deployment

Deploys to a single Cloudflare Worker via `@sveltejs/adapter-cloudflare` (`wrangler.jsonc`). Postgres access goes through a Hyperdrive binding in production — replace the placeholder `id` in `wrangler.jsonc`'s `hyperdrive` block with the one `wrangler hyperdrive create` prints for your database before deploying for real.

```bash
pnpm run build
pnpm exec wrangler deploy
```

## Learn more

- [SvelteKit Documentation](https://svelte.dev/docs/kit)
- [better-auth Documentation](https://www.better-auth.com/docs)
- [Drizzle ORM Documentation](https://orm.drizzle.team/docs/overview)
- [Cloudflare Workers + SvelteKit](https://developers.cloudflare.com/workers/framework-guides/web-apps/sveltekit/)
