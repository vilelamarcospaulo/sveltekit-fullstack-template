// No framework imports — usable from a form action, `load`, or client-side
// Svelte code; nothing here touches the $lib/server boundary.
import { strToDate } from '$lib/utils/date';
import { str } from '$lib/utils/str';
import { isHttpUrl } from '$lib/utils/url';

export type Field = 'name' | 'image' | 'birthdate' | 'bio' | 'location';

export type Profile = {
	name: string;
	image: string | null;
	birthdate: Date | null;
	bio: string | null;
	location: string | null;
};

export type ValidationResult =
	{ ok: true; value: Profile } | { ok: false; errors: Partial<Record<Field, string>> };

// Optional fields coerce empty/absent to null.
export function inputToProfile(input: Record<string, unknown>): ValidationResult {
	const errors: Partial<Record<Field, string>> = {};

	const name = str(input.name);
	if (name.length === 0) {
		errors.name = 'Name is required.';
	} else if (name.length > 80) {
		errors.name = 'Name must be 80 characters or fewer.';
	}

	let image: string | null = null;
	const rawImage = str(input.image);
	if (rawImage.length > 0) {
		if (rawImage.length > 2048 || !isHttpUrl(rawImage)) {
			errors.image = 'Image must be a valid http(s) URL.';
		} else {
			image = rawImage;
		}
	}

	let birthdate: Date | null = null;
	const rawBirthdate = str(input.birthdate);
	if (rawBirthdate.length > 0) {
		// strToDate handles parsing + real-date check; the past/range rule is ours.
		const parsed = strToDate(rawBirthdate);
		if (!parsed || parsed.getUTCFullYear() < 1900 || parsed > new Date()) {
			errors.birthdate = 'Birthdate must be a real date in the past.';
		} else {
			birthdate = parsed;
		}
	}

	let bio: string | null = null;
	const rawBio = str(input.bio);
	if (rawBio.length > 280) {
		errors.bio = 'Bio must be 280 characters or fewer.';
	} else if (rawBio.length > 0) {
		bio = rawBio;
	}

	let location: string | null = null;
	const rawLocation = str(input.location);
	if (rawLocation.length > 120) {
		errors.location = 'Location must be 120 characters or fewer.';
	} else if (rawLocation.length > 0) {
		location = rawLocation;
	}

	if (Object.keys(errors).length > 0) {
		return { ok: false, errors };
	}
	return { ok: true, value: { name, image, birthdate, bio, location } };
}
