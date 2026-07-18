// Called from ".svelte" components only — `load`/actions call the use_case
// layer directly instead of round-tripping through this app's own API.
import type { ApiErrorBody } from '$lib/types/api';

export class ApiError extends Error {
	readonly status: number;
	readonly errors: Record<string, string>;

	constructor(status: number, errors: Record<string, string>) {
		const first = Object.values(errors)[0] ?? 'Request failed.';
		super(first);
		this.name = 'ApiError';
		this.status = status;
		this.errors = errors;
	}
}

// Subclass so callers can distinguish 401 via instanceof, not status checks.
export class AuthError extends ApiError {
	constructor(errors: Record<string, string>) {
		super(401, errors);
		this.name = 'AuthError';
	}
}

export async function apiFetch<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
	// Let network rejections (TypeError: Failed to fetch, etc.) propagate raw;
	// callers handle them in their own catch branch.
	const res = init !== undefined ? await fetch(input, init) : await fetch(input);

	// Attempt to parse the body as JSON regardless of status, because both
	// success and error envelopes use JSON.
	let json: unknown;
	try {
		json = await res.json();
	} catch {
		const fallback: Record<string, string> = {
			_body: `Server returned ${res.status} with non-JSON body.`
		};
		if (res.status === 401) throw new AuthError(fallback);
		throw new ApiError(res.status, fallback);
	}

	if (!res.ok) {
		const envelope = json as Partial<ApiErrorBody>;
		const errors: Record<string, string> =
			envelope?.errors && typeof envelope.errors === 'object'
				? (envelope.errors as Record<string, string>)
				: { _body: `Request failed with status ${res.status}.` };

		if (res.status === 401) throw new AuthError(errors);
		throw new ApiError(res.status, errors);
	}

	return json as T;
}
