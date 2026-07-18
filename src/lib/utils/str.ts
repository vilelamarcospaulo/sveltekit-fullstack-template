export function str(value: unknown): string {
	return value !== undefined && value !== null ? String(value).trim() : '';
}
