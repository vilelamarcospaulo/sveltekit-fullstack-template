import { fail, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { getAuth } from '$lib/server/auth';
import { inputToOrganization, type Field } from '$lib/internal/domain/organization';
import type { Actions, PageServerLoad } from './$types';

// Explicit shared shape for every fail() call below — without this, each
// call site's inline object literal gets unioned separately, and svelte-check
// can't see that `errors.name`/`errors.slug` are valid on every branch.
type FieldErrors = Partial<Record<Field, string>>;

// Guard: only signed-in users can create an organization. Matches this app's
// existing "redirect on guard failure" convention (see CLAUDE.md).
export const load: PageServerLoad = ({ locals }) => {
	if (!locals.user) {
		redirect(302, '/');
	}
};

export const actions: Actions = {
	default: async (event) => {
		if (!event.locals.user) {
			redirect(302, '/');
		}

		const formData = await event.request.formData();
		const validation = inputToOrganization({
			name: formData.get('name'),
			slug: formData.get('slug')
		});
		if (!validation.ok) {
			return fail(400, { errors: validation.errors as FieldErrors });
		}

		const { name, slug } = validation.value;

		try {
			// Unlike the databaseHooks.user.create.after signup-time call in
			// $lib/server/auth.ts, this call DOES pass `headers` — there IS a
			// session here (this route is guarded above), so better-auth's normal
			// session-based authorization path applies.
			await getAuth(event.platform).api.createOrganization({
				body: { name, slug, userId: event.locals.user.id },
				headers: event.request.headers
			});
		} catch (error) {
			if (error instanceof APIError && error.body?.code === 'ORGANIZATION_ALREADY_EXISTS') {
				const errors: FieldErrors = { slug: 'That slug is already taken.' };
				return fail(400, { errors });
			}
			throw error;
		}

		redirect(302, `/org/${slug}`);
	}
};
