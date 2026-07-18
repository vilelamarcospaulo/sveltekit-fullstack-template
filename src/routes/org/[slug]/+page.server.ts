import { eq } from 'drizzle-orm';
import { fail, redirect } from '@sveltejs/kit';
import { APIError } from 'better-auth/api';
import { getAuth } from '$lib/server/auth';
import { getDb } from '$lib/server/db';
import { user } from '$lib/server/db/schema';
import { inputToOrganization, type Field } from '$lib/internal/domain/organization';
import type { Actions, PageServerLoad } from './$types';

// Explicit shared shape for every addMember fail() call below — without
// this, each call site's inline object literal gets unioned separately, and
// svelte-check can't see that `addErrors.email`/`.role`/`.form` are valid on
// every branch.
type AddMemberErrors = Partial<Record<'form' | 'email' | 'role', string>>;

// Same reasoning, for updateOrganization below — name/slug come from the
// shared domain validator (Field = 'name' | 'slug'), plus a catch-all
// `form` key for auth/permission failures that aren't tied to one field.
type UpdateOrganizationErrors = Partial<Record<Field | 'form', string>>;

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
		//
		// `permission: undefined` must be passed explicitly (not just omitted)
		// — the endpoint's body schema is a union keyed on `permission` vs
		// `permissions`, and the installed zod version (4.4.3) rejects the
		// `permissions`-only branch when the `permission` key is absent
		// entirely rather than present-but-undefined (verified directly
		// against the installed zod package: `z.object({ permission:
		// z.undefined(), permissions: z.record(...) }).safeParse({ permissions:
		// {...} })` fails, but `.safeParse({ permission: undefined, permissions:
		// {...} })` succeeds). Without this, every hasPermission call in this
		// file 500s with "APIError: [body] Invalid input".
		const permissionCheck = await auth.api.hasPermission({
			headers: event.request.headers,
			body: { organizationId, permission: undefined, permissions: { member: ['create'] } }
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
	},

	// Rename an organization and/or change its slug. Follows the exact same
	// four-step defensive shape as addMember above (session check → input
	// validation → explicit permission check → mutation), and — since the
	// slug this page's own URL is keyed on can change — redirects to the
	// new slug on success rather than returning form data in place, so the
	// URL never goes stale relative to the org's actual slug.
	updateOrganization: async (event) => {
		// ── 1. Auth check ────────────────────────────────────────────────────
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

		// ── 2. Input validation ─────────────────────────────────────────────
		// Full inputToOrganization (name + slug), not the name-only validator —
		// this app lets both be edited after creation, unlike the assumption
		// baked into an earlier, now-removed helper.
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

		// ── 3. Permission check ─────────────────────────────────────────────
		// Mirrors addMember's own defense-in-depth check above (including the
		// explicit `permission: undefined` — see its comment for why) — the
		// /organization/update endpoint enforces `organization: ['update']`
		// itself too (see
		// node_modules/better-auth/dist/plugins/organization/routes/crud-org.mjs's
		// updateOrganization handler), but this action gates it explicitly up
		// front so a non-owner/admin gets a clean field error instead of
		// relying solely on the endpoint's own FORBIDDEN throw.
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

		// ── 4. Business logic ───────────────────────────────────────────────
		try {
			// Verified shape against crud-org.mjs's updateOrganization endpoint:
			// POST /organization/update, body `{ organizationId, data: {...} }`,
			// requireHeaders: true.
			await auth.api.updateOrganization({
				body: { organizationId, data: { name, slug } },
				headers: event.request.headers
			});
		} catch (error) {
			// better-auth derives APIError.body.code from the thrown message via
			// `message.toUpperCase().replace(/ /g, '_').replace(/[^A-Z0-9_]/g, '')`
			// (node_modules/better-call/dist/error.mjs) — for
			// ORGANIZATION_ERROR_CODES.ORGANIZATION_SLUG_ALREADY_TAKEN ("Organization
			// slug already taken") that resolves to this exact code.
			if (error instanceof APIError && error.body?.code === 'ORGANIZATION_SLUG_ALREADY_TAKEN') {
				const updateErrors: UpdateOrganizationErrors = { slug: 'That slug is already taken.' };
				return fail(400, { updateErrors });
			}
			throw error;
		}

		redirect(302, `/org/${slug}`);
	}
};
