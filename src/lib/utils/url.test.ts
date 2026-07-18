import { describe, it, expect } from 'vitest';
import { isHttpUrl } from './url';

describe('isHttpUrl', () => {
	it('accepts http and https URLs', () => {
		expect(isHttpUrl('http://example.com')).toBe(true);
		expect(isHttpUrl('https://example.com/avatar.png')).toBe(true);
	});

	it('rejects other protocols', () => {
		expect(isHttpUrl('ftp://example.com')).toBe(false);
		expect(isHttpUrl('javascript:alert(1)')).toBe(false);
		expect(isHttpUrl('data:text/plain;base64,aGk=')).toBe(false);
	});

	it('rejects unparseable strings', () => {
		expect(isHttpUrl('not a url')).toBe(false);
		expect(isHttpUrl('')).toBe(false);
	});
});
