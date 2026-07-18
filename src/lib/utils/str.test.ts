import { describe, it, expect } from 'vitest';
import { str } from './str';

describe('str', () => {
	it('trims a string', () => {
		expect(str('  hello  ')).toBe('hello');
	});

	it('coerces null/undefined to empty string', () => {
		expect(str(null)).toBe('');
		expect(str(undefined)).toBe('');
	});

	it('coerces non-string values via String()', () => {
		expect(str(42)).toBe('42');
		expect(str(true)).toBe('true');
	});

	it('leaves an already-clean string untouched', () => {
		expect(str('clean')).toBe('clean');
	});
});
