import { describe, it, expect } from 'vitest';
import { strToDate, dateToStr } from './date';

describe('strToDate', () => {
	it('parses a well-formed calendar date to UTC midnight', () => {
		const d = strToDate('2000-01-15');
		expect(d).not.toBeNull();
		expect(d?.toISOString()).toBe('2000-01-15T00:00:00.000Z');
	});

	it('rejects malformed strings', () => {
		expect(strToDate('not-a-date')).toBeNull();
		expect(strToDate('2000/01/15')).toBeNull();
		expect(strToDate('2000-1-15')).toBeNull();
		expect(strToDate('')).toBeNull();
	});

	it('rejects impossible calendar dates', () => {
		expect(strToDate('2000-02-30')).toBeNull();
		expect(strToDate('2001-02-29')).toBeNull(); // not a leap year
		expect(strToDate('2000-13-01')).toBeNull();
	});

	it('accepts a leap day in a leap year', () => {
		expect(strToDate('2000-02-29')).not.toBeNull();
	});
});

describe('dateToStr', () => {
	it('formats UTC components as YYYY-MM-DD', () => {
		expect(dateToStr(new Date(Date.UTC(2000, 0, 15)))).toBe('2000-01-15');
	});

	it('pads single-digit month and day', () => {
		expect(dateToStr(new Date(Date.UTC(2000, 8, 5)))).toBe('2000-09-05');
	});

	it('round-trips with strToDate', () => {
		const str = '1999-12-31';
		const d = strToDate(str);
		expect(d).not.toBeNull();
		expect(dateToStr(d as Date)).toBe(str);
	});
});
