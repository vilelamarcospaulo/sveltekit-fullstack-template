import { createAuthClient } from 'better-auth/svelte';
import { organizationClient } from 'better-auth/client/plugins';

// Browser-side client. baseURL is omitted — better-auth defaults to the
// current origin, and the server mounts its API routes at /api/auth/* via
// hooks.server.ts's svelteKitHandler.
export const authClient = createAuthClient({
	plugins: [organizationClient()]
});

export const { signIn, signOut, useSession } = authClient;
