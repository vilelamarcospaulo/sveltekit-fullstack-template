// No framework imports — usable from a form action or a .svelte component.
//
// Slug uniqueness isn't checked here — better-auth's org plugin enforces it
// (throws ORGANIZATION_ALREADY_EXISTS), surfaced as a form error at the boundary.
import { str } from '$lib/utils/str';

export type Field = 'name' | 'slug';

export type Organization = {
	name: string;
	slug: string;
};

export type ValidationResult =
	{ ok: true; value: Organization } | { ok: false; errors: Partial<Record<Field, string>> };

const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function validateName(rawName: unknown): { name: string; error?: string } {
	const name = str(rawName);
	if (name.length === 0) {
		return { name, error: 'Name is required.' };
	}
	if (name.length > 100) {
		return { name, error: 'Name must be 100 characters or fewer.' };
	}
	return { name };
}

function validateSlug(rawSlug: unknown): { slug: string; error?: string } {
	const slug = str(rawSlug);
	if (slug.length === 0) {
		return { slug, error: 'Slug is required.' };
	}
	if (slug.length > 50) {
		return { slug, error: 'Slug must be 50 characters or fewer.' };
	}
	if (!SLUG_PATTERN.test(slug)) {
		return {
			slug,
			error: 'Slug must be lowercase letters, numbers, and single hyphens only (e.g. "acme-inc").'
		};
	}
	return { slug };
}

// Used by both create and edit flows — the slug is editable in both, not
// just at creation.
export function inputToOrganization(input: Record<string, unknown>): ValidationResult {
	const errors: Partial<Record<Field, string>> = {};

	const { name, error: nameError } = validateName(input.name);
	if (nameError) errors.name = nameError;

	const { slug, error: slugError } = validateSlug(input.slug);
	if (slugError) errors.slug = slugError;

	if (Object.keys(errors).length > 0) {
		return { ok: false, errors };
	}
	return { ok: true, value: { name, slug } };
}

// Derives a slug suggestion from a name — pure and lossy; callers still run
// it through validateSlug since it can still collide or end up empty.
export function slugify(name: string): string {
	return str(name)
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}
