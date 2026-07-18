import { fail, redirect } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { getProfile, updateProfile } from '$lib/internal/use_case/profile';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const user = event.locals.user;
	if (!user) {
		redirect(302, '/');
	}

	const db = getDb(event.platform);
	const view = await getProfile(db, user.id);

	return {
		profile: {
			name: view?.name ?? user.name ?? '',
			email: view?.email ?? user.email ?? '',
			image: view?.image ?? '',
			birthdate: view?.birthdate ?? '',
			bio: view?.bio ?? '',
			location: view?.location ?? ''
		}
	};
};

export const actions: Actions = {
	default: async (event) => {
		const user = event.locals.user;
		if (!user) {
			redirect(302, '/');
		}

		const formData = await event.request.formData();
		const input = {
			name: formData.get('name'),
			image: formData.get('image'),
			birthdate: formData.get('birthdate'),
			bio: formData.get('bio'),
			location: formData.get('location')
		};

		const db = getDb(event.platform);
		const result = await updateProfile(db, user.id, input);

		if (!result.ok) {
			// Echo back what the user typed (not the last-saved DB values) so a
			// failed submission doesn't wipe out their in-progress edits.
			return fail(400, {
				errors: result.errors,
				values: {
					name: String(input.name ?? ''),
					image: String(input.image ?? ''),
					birthdate: String(input.birthdate ?? ''),
					bio: String(input.bio ?? ''),
					location: String(input.location ?? '')
				}
			});
		}

		return { success: true, profile: result.value };
	}
};
