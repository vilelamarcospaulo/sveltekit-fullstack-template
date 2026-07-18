import { createAuthClient } from 'better-auth/svelte';

// Browser-side client. baseURL is omitted — better-auth defaults to the
// current origin, and the server mounts its API routes at /api/auth/* via
// hooks.server.ts's svelteKitHandler.
export const authClient = createAuthClient();

export const { signIn, signOut, useSession } = authClient;
