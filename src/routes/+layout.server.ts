import type { LayoutServerLoad } from './$types';

// Populated by hooks.server.ts; routes get `data.user` without calling
// getSession() again.
export const load: LayoutServerLoad = ({ locals }) => {
	return { user: locals.user ?? null };
};
