# Deployment Guide (Cloudflare)

This app deploys to two independent Cloudflare Workers — no Docker/VPS path. `compose.yaml` at the repo root is local-dev-only (Postgres).

- **The app** — `wrangler.jsonc`, built via `@sveltejs/adapter-cloudflare`, deployed with `pnpm run deploy`.
- **The Cloudflare Queues consumer worker** — `wrangler.queue.jsonc`, deployed with `pnpm run worker:deploy`.

For local development, see `README.md`'s "Getting started" — this doc is production-deployment only.

**Status as of this writing: not yet deployed anywhere.** Everything below has been verified locally (`pnpm run build`, `wrangler dev` previews, `wrangler deploy --dry-run` for the worker) but never run against a real Cloudflare account. Every step in this doc requires your Cloudflare account access, which I don't have — this is a runbook for you (or whoever deploys) to follow, not something I can complete unattended.

## One-time setup

### 1. Authenticate

```bash
pnpm exec wrangler login
```

### 2. Provision Hyperdrive (Postgres access for the app Worker)

```bash
pnpm exec wrangler hyperdrive create sveltekit-fullstack-template --connection-string="<your-production-postgres-connection-string>"
```

Copy the printed `id` into `wrangler.jsonc`'s `hyperdrive[0].id` — it's currently the placeholder `00000000000000000000000000000000`.

### 3. Create the Cloudflare Queues used by the async-job demo

```bash
pnpm exec wrangler queues create hello
pnpm exec wrangler queues create hello-dlq
```

`wrangler.queue.jsonc` already declares the consumer/DLQ bindings for these by name — no further config changes needed once they exist on your account.

### 4. Set the app Worker's production vars/secrets

All of these are read by the **app** Worker (`wrangler.jsonc`), not the background-job worker — the background-job worker only consumes messages, it never reads app config. Non-secret values can go in `wrangler.jsonc`'s `vars` block (not present yet — add one, or use `wrangler secret put` for everything, which also works for non-secret values, just less visible in the repo):

```bash
pnpm exec wrangler secret put BETTER_AUTH_SECRET   # openssl rand -base64 32
pnpm exec wrangler secret put GOOGLE_CLIENT_ID
pnpm exec wrangler secret put GOOGLE_CLIENT_SECRET
```

`ORIGIN` must be your real production URL (e.g. `https://your-app.example.com`) — better-auth's `svelteKitHandler` compares every request's actual origin against this to decide whether a path is one of its own `/api/auth/*` routes (see `CLAUDE.md`'s Deployment section — a mismatch here doesn't error, it silently 404s every auth request, exactly like the local port-mismatch gotcha documented there):

```bash
pnpm exec wrangler secret put ORIGIN
```

Also update the Google OAuth client's **Authorized redirect URI** and **Authorized JS origin** in the [Google Cloud Console](https://console.cloud.google.com/apis/credentials) to match your production `ORIGIN` (they're currently only configured for `http://localhost:5173`).

**Only if using the real-Cloudflare-account path for the async-job demo** (as opposed to the local-dev-only `QUEUE_LOCAL_PUSH_URL` bridge — see `.env.example`'s "Option B"):

```bash
pnpm exec wrangler secret put CLOUDFLARE_ACCOUNT_ID
pnpm exec wrangler secret put CLOUDFLARE_API_TOKEN        # needs "Queues Edit" permission
pnpm exec wrangler secret put CLOUDFLARE_HELLO_QUEUE_ID   # the *id* wrangler queues create printed, not the name "hello"
```

### 5. Apply the database schema against production Postgres

There's no in-Worker migration step — Drizzle's CLI is a plain Node process run from your own machine or CI:

```bash
DATABASE_URL="<production-connection-string>" pnpm exec drizzle-kit migrate
```

(Or `pnpm exec drizzle-kit push` for a direct, non-versioned push — same tradeoff as local dev, see `README.md`.)

### 6. Update `wrangler.jsonc`'s `name` if needed

Both `wrangler.jsonc` and `wrangler.queue.jsonc` currently use the scaffolded names (`sveltekit-fullstack-template` / `sveltekit-fullstack-template-worker`) — these become your Worker's subdomain/URL (`<name>.<your-subdomain>.workers.dev`) unless you attach a custom domain. Rename before deploying if you want something else.

## Deploy

```bash
pnpm run worker:deploy   # the background-job consumer
pnpm run deploy          # the app itself (runs `pnpm run build` first)
```

Order matters the first time: deploy the worker before (or at the same time as) the app, so the `hello`/`hello-dlq` queues have a live consumer attached before the app can push anything real to them.

## Verifying a deploy

- `pnpm exec wrangler tail` (app) / `pnpm exec wrangler tail --config wrangler.queue.jsonc` (worker) — live log streaming, same JSON logger output you see locally (`src/lib/server/logger.ts` / `src/worker/logger.ts`).
- Hit the deployed URL's `/api/auth/get-session` — should return `200 null` when unauthenticated (matches the local smoke test in this project's development history), not a 404 (a 404 here means the `ORIGIN` secret doesn't match the actual deployed URL — see step 4 above).
- Sign in with Google for real, edit your profile, create an organization, enqueue an async job — the four things this template actually does.

## Known gaps before this is production-hardened

- **Rate limiting is disabled** (`src/lib/server/auth.ts`'s `rateLimit: { enabled: false }`) — better-auth's built-in limiter uses per-process memory, which doesn't work across Cloudflare's many concurrent, ephemeral isolates. Needs a durable store (Workers KV or D1) behind it before this matters in production.
- **No CI/CD deploy automation** — `.github/workflows/ci.yaml` runs lint/typecheck/test/build and a worker bundle dry-run on every push, but nothing in CI actually deploys. Wiring that up (e.g. a manually-triggered or main-branch-only deploy job using `wrangler deploy` with `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID` as GitHub secrets) is a reasonable next step once you're ready to deploy automatically, not before — this doc only covers manual deployment.
- **No monitoring/alerting** beyond Cloudflare's own dashboard and `wrangler tail`.
