// No SvelteKit imports — the route boundary resolves `db` (getDb(event.platform))
// and userId, passing both in; these functions never touch `event` or Response.
//
// Takes `db: DrizzleDb`, not `platform`: getDb() needs SvelteKit's
// request-scoped `event.platform`, which only exists in route code — resolving
// it here would leak a SvelteKit-specific type into this framework-free layer.
// Future use_case layers should follow the same convention.
import { eq } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';
import type { DrizzleDb } from '$lib/server/db';
import { user, profile } from '$lib/server/db/schema';
import { inputToProfile, type Field } from '$lib/internal/domain/profile';
import { dateToStr } from '$lib/utils/date';

// birthdate is serialised as a YYYY-MM-DD string (or null), not a Date.
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

// birthdate is stored as a Date but emitted as YYYY-MM-DD — a presentation
// concern, hence the dateToStr util here and not the domain.
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

// Returns null when the user row is missing.
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

	// leftJoin nulls (no profile row) are indistinguishable from an all-null
	// profile row, but toView() flattens both via `?.`/`??` — no branching needed.
	return toView({
		name: row.name,
		email: row.email,
		image: row.image,
		profile: { birthdate: row.birthdate, bio: row.bio, location: row.location }
	});
}

// Written atomically in one transaction (user + profile fields).
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
