// True when value parses as an http: or https: URL. Generic predicate — the
// "avatar must be http(s)" rule that consumes it lives in the domain.
// Ported from the Next.js sibling template's src/utils/url.ts.
export function isHttpUrl(value: string): boolean {
	try {
		const { protocol } = new URL(value);
		return protocol === 'http:' || protocol === 'https:';
	} catch {
		return false;
	}
}
