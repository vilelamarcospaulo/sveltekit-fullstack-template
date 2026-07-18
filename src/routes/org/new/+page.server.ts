import { fail, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { getAuth } from '$lib/server/auth';
import { inputToOrganization, type Field } from '$lib/internal/domain/organization';
import type { Actions, PageServerLoad } from './$types';

// Shared shape for every fail() call — inline literals would union
// separately, hiding valid fields from svelte-check.
type FieldErrors = Partial<Record<Field, string>>;

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
			// Passes `headers` (unlike auth.ts's signup-time call) — a real
			// session exists here, so normal session-based auth applies.
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
