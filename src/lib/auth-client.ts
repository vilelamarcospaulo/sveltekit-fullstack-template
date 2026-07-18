import { createAuthClient } from 'better-auth/svelte';
import { organizationClient } from 'better-auth/client/plugins';

// baseURL omitted — better-auth defaults to the current origin, matching
// where hooks.server.ts mounts /api/auth/*.
export const authClient = createAuthClient({
	plugins: [organizationClient()]
});

export const { signIn, signOut, useSession } = authClient;
