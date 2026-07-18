// Shared API contract types used by both the server (+server.ts routes) and
// the client (api-client.ts, and any component calling one of these routes).
// Mirrors the Next.js sibling template's src/types/api.ts — the envelope
// shape is a framework-independent convention, not something SvelteKit- or
// Next-specific.

// The error envelope returned by every non-2xx JSON response from a
// src/routes/api/**/+server.ts route.
//
// Key conventions:
//   _auth   — authentication/session failure (not a form field)
//   _body   — request body parse failure (malformed JSON, wrong Content-Type)
//   <field> — a per-field validation error whose key matches the input field name
//
// Underscore-prefixed keys are non-field errors; consumers should surface them
// as toasts/banners rather than attaching them to a specific input element.
export type ApiErrorBody = {
	errors: Record<string, string>;
};

// Re-export the canonical response view so clients and server code can import
// from one place. The source of truth is the use-case layer — this just
// bridges it.
export type { ProfileView } from '$lib/internal/use_case/profile';
