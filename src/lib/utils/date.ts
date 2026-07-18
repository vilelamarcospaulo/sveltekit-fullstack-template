// Pure, no business rules — callers layer past-only/range checks on top.
//
// Both operate on UTC components: Postgres's timezone-less `date()` column
// is always read back as UTC midnight regardless of server TZ. Using local
// components would drift a day when read on a host with a different offset.

// Parses YYYY-MM-DD into a UTC-midnight Date, or null for malformed/
// impossible dates (e.g. Feb 30).
export function strToDate(value: string): Date | null {
	const parts = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (!parts) return null;
	const year = parseInt(parts[1], 10);
	const month = parseInt(parts[2], 10) - 1; // 0-indexed
	const day = parseInt(parts[3], 10);
	const d = new Date(Date.UTC(year, month, day));
	const isReal = d.getUTCFullYear() === year && d.getUTCMonth() === month && d.getUTCDate() === day;
	return isReal ? d : null;
}

// Inverse of strToDate — UTC components, matching a `date()` column read
// back from Postgres.
export function dateToStr(d: Date): string {
	const yyyy = d.getUTCFullYear();
	const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
	const dd = String(d.getUTCDate()).padStart(2, '0');
	return `${yyyy}-${mm}-${dd}`;
}
