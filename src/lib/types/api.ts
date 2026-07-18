// Key conventions for ApiErrorBody's `errors` map:
//   _auth   — authentication/session failure (not a form field)
//   _body   — request body parse failure (malformed JSON, wrong Content-Type)
//   <field> — per-field validation error, keyed by input field name
//
// Underscore-prefixed keys are non-field errors — surface as toasts/banners,
// not attached to an input.
export type ApiErrorBody = {
	errors: Record<string, string>;
};

// Re-exported so clients/server code share one import — source of truth is
// the use-case layer.
export type { ProfileView } from '$lib/internal/use_case/profile';
