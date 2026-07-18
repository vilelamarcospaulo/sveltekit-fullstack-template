# Handover

Status snapshot of `sveltekit-fullstack-template` as of this writing. For architecture detail, read `CLAUDE.md` first — this doc is "what's the state of things and what's next," not "how does it work."

## What this is

A SvelteKit sibling to `../nextjs-fullstack-template`: same core idea (Google OAuth, organization multi-tenancy, Postgres via Drizzle/Hyperdrive, Cloudflare Queues background jobs, deploy to Cloudflare Workers), built idiomatically per-framework rather than ported line-for-line. Built in two passes:

1. **Foundation phase** — scaffold, auth, DB, Cloudflare deploy pipeline, verified end-to-end (real Google OAuth sign-in, live Worker preview).
2. **Feature phase** — profile CRUD, org multi-tenancy, and a Cloudflare Queues demo, built in parallel by three isolated agents and merged.

Plus this current pass: an `/api/profile` JSON API + live demo (closing a documented-but-unfulfilled pattern gap), a CI workflow, and Cloudflare deployment prep.

## Is it running right now?

No — nothing is left running from this session. To bring it up:

```bash
pnpm run db:start   # local Postgres, port 5433 (5432 is taken by the Next.js sibling's own container)
pnpm run dev        # http://localhost:5173
```

`.env` already exists locally (gitignored) with a real `BETTER_AUTH_SECRET` and **real Google OAuth credentials** you configured earlier in this project's life — sign-in actually works end to end, not just up to the redirect.

## What's implemented and verified

| Feature                                                | Where                                                                                                      | Verified how                                                                                                                      |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Google OAuth sign-in/out                               | `src/hooks.server.ts`, `src/lib/server/auth.ts`, `src/lib/components/sign-in-button.svelte`                | Live: real Google redirect, session cookie, sign-out                                                                              |
| Profile CRUD                                           | `src/routes/profile/`, `src/lib/internal/{domain,use_case}/profile.ts`                                     | `check`/`lint`/`build` clean, DB table confirmed, redirect-when-unauthenticated confirmed                                         |
| **`/api/profile` JSON API (GET-only) + live demo**     | `src/routes/api/profile/+server.ts`, `src/lib/components/profile-api-demo.svelte`, `src/lib/api-client.ts` | Live: GET returns the correct 401 envelope when unauthenticated; writes go through the profile form's server action, not this API |
| **`/api/hello` JSON API + live demo on the home page** | `src/routes/api/hello/+server.ts`, `src/lib/components/api-hello-demo.svelte`                              | `check`/`lint`/`test`/`build` clean; mirrors the Next.js sibling template's `/api/hello` route + `ApiHelloDemo` card              |
| Org multi-tenancy                                      | `src/routes/org/`, `src/lib/server/auth.ts` (organization plugin), `src/lib/components/navbar.svelte`      | `check`/`lint`/`build` clean, DB tables confirmed, redirect-when-unauthenticated confirmed                                        |
| Cloudflare Queues demo                                 | `src/lib/server/queue.ts`, `src/worker/`, `wrangler.queue.jsonc`                                           | Live: full `job_started → job_completed` log chain exercised locally via the queue worker's local-push simulation                 |

All of the above also passed a full `pnpm run check && pnpm run lint && pnpm run test && pnpm run build` sweep on the actual merged/integrated `main` branch, not just in isolation.

## What's NOT tested (be honest with yourself about this)

- **No automated tests for any feature.** `src/lib/vitest-examples/` (2 files) are leftover scaffolding examples from `sv add vitest`. Profile, org, and jobs were verified with `check`/`lint`/`build` + manual `curl`/browser smoke tests during development — none of that is captured as a test file that'll catch a future regression.
- **No integration tests against real Postgres**, no Miniflare-backed Worker runtime tests (the Next.js sibling's `integration`/`worker`/`app-worker` Vitest projects have no equivalent here).
- **The org feature's navbar dropdown** (`useListOrganizations`/`useActiveOrganization`, org switching) was verified by the building agent via `check`/`lint`/`build` and reading better-auth's source to confirm the nanostore-atom return shape — I have not personally clicked through it in a browser with a real multi-org account.

## CI

`.github/workflows/ci.yaml` — added this session. Runs on every push/PR:

- **`app` job** (matrix: `lint`, `check`, `test`, `build`) — against a Postgres service container (currently unused by the test suite itself, wired up for when integration tests land).
- **`queue-worker` job** — `wrangler deploy --config wrangler.queue.jsonc --dry-run`, confirming the independent consumer Worker still bundles cleanly.

**Never actually run on GitHub** — there's no remote configured for this repo (it's a fresh local `git init` from earlier in this project's life), so this workflow has only been verified by manually replicating each step locally with the exact same env vars the workflow declares (see the commit that added it for what was checked). First real push to a GitHub remote is the actual first run.

**Deliberately does not deploy anything** — per your ask, this is CI (verify), not CD (ship). See `DEPLOYMENT.md` for what deploying for real requires, and its "Known gaps" section for what a deploy job would need if you want to add one later.

## Deployment readiness (Cloudflare)

**Not deployed anywhere.** `DEPLOYMENT.md` (added this session) is the full runbook: Hyperdrive provisioning, Cloudflare Queues creation, secrets, deploy order, post-deploy verification steps. Every step in it requires your Cloudflare account access — `wrangler login`, resource creation, `wrangler secret put` — none of which I can do from here. What IS proven:

- `pnpm run build` succeeds (adapter-cloudflare output).
- `wrangler dev` previews both Workers locally against simulated bindings.
- The queue worker's `wrangler deploy --dry-run` bundles cleanly with no real account.
- `pnpm run deploy` / `pnpm run queue-worker:deploy` exist and are the right commands — just never pointed at a real account.

Concretely blocking a real deploy: `wrangler.jsonc`'s Hyperdrive `id` is still the scaffolded placeholder, the `hello`/`hello-dlq` queues don't exist on any real account, and no secrets (`BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID/SECRET`, `ORIGIN`) are set anywhere Cloudflare can see them. `DEPLOYMENT.md` walks through fixing all three.

## Suggested next steps, roughly in order

1. **If you want to actually deploy**: work through `DEPLOYMENT.md` yourself (needs your Cloudflare account) — I can help troubleshoot but can't execute the account-scoped steps.
2. **If you want real test coverage before that**: pick one feature (profile is probably the simplest) and write unit tests for its `domain`/`use_case` layer first — those are pure functions/DB orchestration with no SvelteKit runtime coupling, the cheapest tests to write and the highest-value (validation logic bugs are exactly what these would catch). Component/route tests are more work for less coverage per test.
3. **Push to a real GitHub remote** so `ci.yaml` actually runs once — right now its correctness rests on my local replication of each step, not a real CI run.
4. Everything else in CLAUDE.md's "What's deferred" section, in whatever order matters to you.
