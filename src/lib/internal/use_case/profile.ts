// Profile use cases: orchestration between the route boundary (src/routes/)
// and the data store (Drizzle). No SvelteKit imports — the boundary resolves
// `db` (via $lib/server/db's getDb(event.platform)) and the session's userId,
// and passes both in; these functions never touch `event`, headers, or
// Response.
//
// Deviation from the Next.js sibling template's use_case/profile.ts: there,
// getDb() is context-free (Next's getCloudflareContext() works anywhere) so
// the use case calls it internally. Here, getDb(platform?: App.Platform)
// needs SvelteKit's request-scoped `event.platform`, which only exists in
// route code — resolving it here would require threading a SvelteKit/
// Cloudflare-specific type (App.Platform) into this framework-free internal
// layer. So every function below takes an already-resolved `db: DrizzleDb`
// as its first parameter instead, and the caller (a `load` function or form
// action) does `const db = getDb(event.platform)` and passes it in. Future
// features (org, queues) should follow the same `db`-not-`platform`
// convention for their use_case layers.
import { eq } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import type { DrizzleDb } from '$lib/server/db';
import { user, profile } from '$lib/server/db/schema';
import { inputToProfile, type Field } from '$lib/internal/domain/profile';
import { dateToStr } from '$lib/utils/date';

// The serialised shape returned to the boundary: a user's display fields
// merged with their optional 1-1 profile. birthdate is a YYYY-MM-DD string
// (or null).
export type ProfileView = {
	name: string;
	email: string;
	image: string | null;
	birthdate: string | null;
	bio: string | null;
	location: string | null;
};

export type UpdateProfileResult =
	{ ok: true; value: ProfileView } | { ok: false; errors: Partial<Record<Field, string>> };

// Flatten a user (+ optional profile) into the serialised view. birthdate is
// stored as a Date but emitted as YYYY-MM-DD (a presentation concern, hence
// the dateToStr util and not the domain).
function toView(user: {
	name: string;
	email: string;
	image: string | null;
	profile: {
		birthdate: Date | null;
		bio: string | null;
		location: string | null;
	} | null;
}): ProfileView {
	return {
		name: user.name,
		email: user.email,
		image: user.image,
		birthdate: user.profile?.birthdate ? dateToStr(user.profile.birthdate) : null,
		bio: user.profile?.bio ?? null,
		location: user.profile?.location ?? null
	};
}

// Read a user's own profile. Returns null when the user row is missing.
export async function getProfile(db: DrizzleDb, userId: string): Promise<ProfileView | null> {
	const rows = await db
		.select({
			name: user.name,
			email: user.email,
			image: user.image,
			birthdate: profile.birthdate,
			bio: profile.bio,
			location: profile.location
		})
		.from(user)
		.leftJoin(profile, eq(profile.userId, user.id))
		.where(eq(user.id, userId))
		.limit(1);

	const row = rows[0];
	if (!row) return null;

	// The leftJoin returns birthdate/bio/location as null when there's no
	// profile row at all — indistinguishable here from a profile row whose
	// fields happen to all be null, but toView() flattens both cases to the
	// same ProfileView output via `?.`/`??`, so no branching is needed.
	return toView({
		name: row.name,
		email: row.email,
		image: row.image,
		profile: { birthdate: row.birthdate, bio: row.bio, location: row.location }
	});
}

// Validate raw input (never trust the caller) and persist it. user.{name,image}
// and the profile fields are written atomically in one transaction.
export async function updateProfile(
	db: DrizzleDb,
	userId: string,
	input: Record<string, unknown>
): Promise<UpdateProfileResult> {
	const result = inputToProfile(input);
	if (!result.ok) return { ok: false, errors: result.errors };

	const { name, image, birthdate, bio, location } = result.value;

	const value = await db.transaction(async (tx) => {
		const [updatedUser] = await tx
			.update(user)
			.set({ name, image })
			.where(eq(user.id, userId))
			.returning({ name: user.name, email: user.email, image: user.image });

		const [updatedProfile] = await tx
			.insert(profile)
			.values({ id: createId(), userId, birthdate, bio, location })
			.onConflictDoUpdate({
				target: profile.userId,
				set: { birthdate, bio, location }
			})
			.returning({
				birthdate: profile.birthdate,
				bio: profile.bio,
				location: profile.location
			});

		return toView({ ...updatedUser, profile: updatedProfile });
	});

	return { ok: true, value };
}
