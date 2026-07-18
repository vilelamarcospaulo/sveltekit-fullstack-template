import { eq } from 'drizzle-orm';
import { fail, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { getAuth } from '$lib/server/auth';
import { getDb } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import type { Actions, PageServerLoad } from './$types';

// Explicit shared shape for every addMember fail() call below — without
// this, each call site's inline object literal gets unioned separately, and
// svelte-check can't see that `addErrors.email`/`.role`/`.form` are valid on
// every branch.
type AddMemberErrors = Partial<Record<'form' | 'email' | 'role', string>>;

// load: resolves the org by slug server-side via better-auth's own
// get-full-organization endpoint (which already enforces "org must exist"),
// then checks the viewer is a member itself (that endpoint doesn't reject
// non-members on its own). Guard failures all redirect home, matching this
// app's "redirect on guard failure" convention (see CLAUDE.md).
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
	// Deliberately self-contained inline validation (not routed through
	// $lib/internal/domain/organization.ts, which only covers name/slug — a
	// different concern), same choice the Next.js sibling template makes in
	// its org/actions.ts.
	addMember: async (event) => {
		// ── 1. Auth check ────────────────────────────────────────────────────
		if (!event.locals.user) {
			const addErrors: AddMemberErrors = { form: 'Your session expired. Please sign in again.' };
			return fail(401, { addErrors });
		}

		const formData = await event.request.formData();
		const organizationId = String(formData.get('organizationId') ?? '');
		const email = String(formData.get('email') ?? '').trim();
		const role = String(formData.get('role') ?? '');

		// ── 2. Input validation ─────────────────────────────────────────────
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

		// ── 3. Permission check ─────────────────────────────────────────────
		// getAuth().api.addMember (below) is server-only and enforces NO
		// permission check of its own — it trusts the caller completely, so
		// this action must gate it itself. hasPermission resolves
		// `{ success: boolean, error: string | null }`, NOT a plain boolean
		// promise (verified in
		// node_modules/better-auth/dist/plugins/organization/organization.mjs,
		// the `/organization/has-permission` endpoint's
		// `ctx.json({ error: null, success: result })`).
		const permissionCheck = await auth.api.hasPermission({
			headers: event.request.headers,
			body: { organizationId, permissions: { member: ['create'] } }
		});
		if (!permissionCheck.success) {
			const addErrors: AddMemberErrors = { form: "You don't have permission to add members." };
			return fail(403, { addErrors });
		}

		// ── 4. Business logic ───────────────────────────────────────────────
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
	}
};
