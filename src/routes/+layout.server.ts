import type { LayoutServerLoad } from './$types';

// Populated once per request by hooks.server.ts; every route under this
// layout gets `data.user` without calling getAuth().api.getSession() again.
export const load: LayoutServerLoad = ({ locals }) => {
	return { user: locals.user ?? null };
};
