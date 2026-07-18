// Coerce an unknown value to a trimmed string; null/undefined become "".
// Generic input sanitiser for raw form/HTTP values — carries no domain
// meaning. Ported from the Next.js sibling template's src/utils/str.ts.
export function str(value: unknown): string {
	return value !== undefined && value !== null ? String(value).trim() : '';
}
