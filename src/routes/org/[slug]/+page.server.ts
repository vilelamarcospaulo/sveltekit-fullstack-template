import { eq } from 'drizzle-orm';
import { fail, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { getAuth } from '$lib/server/auth';
import { getDb } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { inputToOrganization, type Field } from '$lib/internal/domain/organization';
import type { Actions, PageServerLoad } from './$types';

// Shared shape for every addMember fail() call — inline literals would union
// separately, and svelte-check couldn't see all fields as valid on every branch.
type AddMemberErrors = Partial<Record<'form' | 'email' | 'role', string>>;

// Same reasoning, for updateOrganization — plus a catch-all `form` key for
// failures not tied to one field.
type UpdateOrganizationErrors = Partial<Record<Field | 'form', string>>;

// getFullOrganization enforces "org exists" but not membership, so we check
// the viewer is a member ourselves. Guard failures redirect home.
export const load: PageServerLoad = async (event) => {
	if (!event.locals.user) {
		redirect(302, '/');
	}

	const auth = getAuth(event.platform);

	let organization;
	try {
		organization = await auth.api.getFullOrganization({
			headers: event.request.headers,
			query: { organizationSlug: event.params.slug }
		});
	} catch {
		redirect(302, '/');
	}
	if (!organization) {
		redirect(302, '/');
	}

	const viewerMember = organization.members.find((m) => m.userId === event.locals.user!.id);
	if (!viewerMember) {
		redirect(302, '/');
	}

	return {
		organization: {
			id: organization.id,
			name: organization.name,
			slug: organization.slug
		},
		viewerRole: viewerMember.role,
		viewerUserId: event.locals.user.id,
		members: organization.members
	};
};

export const actions: Actions = {
	// Self-contained inline validation — domain/organization.ts only covers
	// name/slug, a different concern.
	addMember: async (event) => {
		if (!event.locals.user) {
			const addErrors: AddMemberErrors = { form: 'Your session expired. Please sign in again.' };
			return fail(401, { addErrors });
		}

		const formData = await event.request.formData();
		const organizationId = String(formData.get('organizationId') ?? '');
		const email = String(formData.get('email') ?? '').trim();
		const role = String(formData.get('role') ?? '');

		if (!organizationId) {
			const addErrors: AddMemberErrors = { form: 'Missing organization.' };
			return fail(400, { addErrors });
		}
		if (!email || !email.includes('@')) {
			const addErrors: AddMemberErrors = { email: 'Enter a valid email address.' };
			return fail(400, { addErrors });
		}
		if (role !== 'admin' && role !== 'member') {
			const addErrors: AddMemberErrors = { role: 'Choose a valid role.' };
			return fail(400, { addErrors });
		}

		const auth = getAuth(event.platform);

		// addMember enforces no permission check itself, so this action gates
		// it via hasPermission (resolves `{ success, error }`, not a boolean).
		//
		// `permission: undefined` must be passed explicitly — the endpoint's
		// zod schema rejects the `permissions`-only union branch when
		// `permission` is absent rather than present-but-undefined. Omitting it
		// 500s with "APIError: [body] Invalid input".
		const permissionCheck = await auth.api.hasPermission({
			headers: event.request.headers,
			body: { organizationId, permission: undefined, permissions: { member: ['create'] } }
		});
		if (!permissionCheck.success) {
			const addErrors: AddMemberErrors = { form: "You don't have permission to add members." };
			return fail(403, { addErrors });
		}

		const [targetUser] = await getDb(event.platform)
			.select({ id: user.id })
			.from(user)
			.where(eq(user.email, email))
			.limit(1);
		if (!targetUser) {
			const addErrors: AddMemberErrors = {
				email: 'No account exists with that email yet — they need to sign up first.'
			};
			return fail(400, { addErrors });
		}

		try {
			await auth.api.addMember({
				body: { organizationId, userId: targetUser.id, role }
			});
		} catch (error) {
			if (
				error instanceof APIError &&
				error.body?.code === 'USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION'
			) {
				const addErrors: AddMemberErrors = {
					email: 'That person is already a member of this organization.'
				};
				return fail(400, { addErrors });
			}
			throw error;
		}

		return { addSuccess: true };
	},

	// Same four-step shape as addMember. Redirects to the new slug on success
	// (rather than returning form data in place) so the URL never goes stale.
	updateOrganization: async (event) => {
		if (!event.locals.user) {
			const updateErrors: UpdateOrganizationErrors = {
				form: 'Your session expired. Please sign in again.'
			};
			return fail(401, { updateErrors });
		}

		const formData = await event.request.formData();
		const organizationId = String(formData.get('organizationId') ?? '');
		if (!organizationId) {
			const updateErrors: UpdateOrganizationErrors = { form: 'Missing organization.' };
			return fail(400, { updateErrors });
		}

		const validation = inputToOrganization({
			name: formData.get('name'),
			slug: formData.get('slug')
		});
		if (!validation.ok) {
			const updateErrors: UpdateOrganizationErrors = validation.errors;
			return fail(400, { updateErrors });
		}
		const { name, slug } = validation.value;

		const auth = getAuth(event.platform);

		// Mirrors addMember's permission check (including `permission:
		// undefined` — see above) so a non-owner/admin gets a clean field
		// error instead of the endpoint's bare FORBIDDEN throw.
		const permissionCheck = await auth.api.hasPermission({
			headers: event.request.headers,
			body: { organizationId, permission: undefined, permissions: { organization: ['update'] } }
		});
		if (!permissionCheck.success) {
			const updateErrors: UpdateOrganizationErrors = {
				form: "You don't have permission to update this organization."
			};
			return fail(403, { updateErrors });
		}

		try {
			// POST /organization/update, body `{ organizationId, data: {...} }`,
			// requireHeaders: true.
			await auth.api.updateOrganization({
				body: { organizationId, data: { name, slug } },
				headers: event.request.headers
			});
		} catch (error) {
			// better-auth derives APIError.body.code from the message via
			// `.toUpperCase().replace(/ /g,'_').replace(/[^A-Z0-9_]/g,'')` — hence
			// this exact code string.
			if (error instanceof APIError && error.body?.code === 'ORGANIZATION_SLUG_ALREADY_TAKEN') {
				const updateErrors: UpdateOrganizationErrors = { slug: 'That slug is already taken.' };
				return fail(400, { updateErrors });
			}
			throw error;
		}

		redirect(302, `/org/${slug}`);
	}
};
