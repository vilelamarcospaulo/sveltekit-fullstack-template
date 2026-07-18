import { describe, it, expect } from 'vitest';
import { inputToProfile } from './profile';

describe('inputToProfile', () => {
	it('accepts a fully populated valid input', () => {
		const result = inputToProfile({
			name: 'Ada Lovelace',
			image: 'https://example.com/ada.png',
			birthdate: '1990-06-15',
			bio: 'Mathematician.',
			location: 'London'
		});
		expect(result).toEqual({
			ok: true,
			value: {
				name: 'Ada Lovelace',
				image: 'https://example.com/ada.png',
				birthdate: new Date(Date.UTC(1990, 5, 15)),
				bio: 'Mathematician.',
				location: 'London'
			}
		});
	});

	it('accepts a minimal input with only the required name', () => {
		const result = inputToProfile({ name: 'Ada' });
		expect(result).toEqual({
			ok: true,
			value: { name: 'Ada', image: null, birthdate: null, bio: null, location: null }
		});
	});

	it('trims the name via the str() coercion', () => {
		const result = inputToProfile({ name: '  Ada  ' });
		expect(result.ok).toBe(true);
		expect(result.ok && result.value.name).toBe('Ada');
	});

	describe('name', () => {
		it('rejects a missing name', () => {
			const result = inputToProfile({});
			expect(result).toEqual({ ok: false, errors: { name: 'Name is required.' } });
		});

		it('rejects a whitespace-only name', () => {
			const result = inputToProfile({ name: '   ' });
			expect(result).toEqual({ ok: false, errors: { name: 'Name is required.' } });
		});

		it('accepts a name at exactly 80 characters', () => {
			const result = inputToProfile({ name: 'a'.repeat(80) });
			expect(result.ok).toBe(true);
		});

		it('rejects a name over 80 characters', () => {
			const result = inputToProfile({ name: 'a'.repeat(81) });
			expect(result).toEqual({
				ok: false,
				errors: { name: 'Name must be 80 characters or fewer.' }
			});
		});
	});

	describe('image', () => {
		it('accepts an absent image as null', () => {
			const result = inputToProfile({ name: 'Ada', image: '' });
			expect(result.ok).toBe(true);
			expect(result.ok && result.value.image).toBeNull();
		});

		it('rejects a non-http(s) URL', () => {
			const result = inputToProfile({ name: 'Ada', image: 'ftp://example.com/a.png' });
			expect(result).toEqual({
				ok: false,
				errors: { image: 'Image must be a valid http(s) URL.' }
			});
		});

		it('rejects an unparseable image value', () => {
			const result = inputToProfile({ name: 'Ada', image: 'not a url' });
			expect(result).toEqual({
				ok: false,
				errors: { image: 'Image must be a valid http(s) URL.' }
			});
		});

		it('rejects an image URL over 2048 characters', () => {
			const longUrl = 'https://example.com/' + 'a'.repeat(2048);
			const result = inputToProfile({ name: 'Ada', image: longUrl });
			expect(result).toEqual({
				ok: false,
				errors: { image: 'Image must be a valid http(s) URL.' }
			});
		});
	});

	describe('birthdate', () => {
		it('accepts an absent birthdate as null', () => {
			const result = inputToProfile({ name: 'Ada', birthdate: '' });
			expect(result.ok).toBe(true);
			expect(result.ok && result.value.birthdate).toBeNull();
		});

		it('rejects a malformed birthdate', () => {
			const result = inputToProfile({ name: 'Ada', birthdate: 'not-a-date' });
			expect(result).toEqual({
				ok: false,
				errors: { birthdate: 'Birthdate must be a real date in the past.' }
			});
		});

		it('rejects an impossible calendar date', () => {
			const result = inputToProfile({ name: 'Ada', birthdate: '2000-02-30' });
			expect(result).toEqual({
				ok: false,
				errors: { birthdate: 'Birthdate must be a real date in the past.' }
			});
		});

		it('rejects a year before 1900', () => {
			const result = inputToProfile({ name: 'Ada', birthdate: '1899-12-31' });
			expect(result).toEqual({
				ok: false,
				errors: { birthdate: 'Birthdate must be a real date in the past.' }
			});
		});

		it('accepts exactly the year 1900', () => {
			const result = inputToProfile({ name: 'Ada', birthdate: '1900-01-01' });
			expect(result.ok).toBe(true);
		});

		it('rejects a future date', () => {
			const future = new Date();
			future.setUTCFullYear(future.getUTCFullYear() + 1);
			const yyyy = future.getUTCFullYear();
			const mm = String(future.getUTCMonth() + 1).padStart(2, '0');
			const dd = String(future.getUTCDate()).padStart(2, '0');
			const result = inputToProfile({ name: 'Ada', birthdate: `${yyyy}-${mm}-${dd}` });
			expect(result).toEqual({
				ok: false,
				errors: { birthdate: 'Birthdate must be a real date in the past.' }
			});
		});
	});

	describe('bio', () => {
		it('accepts an absent bio as null', () => {
			const result = inputToProfile({ name: 'Ada', bio: '' });
			expect(result.ok).toBe(true);
			expect(result.ok && result.value.bio).toBeNull();
		});

		it('accepts a bio at exactly 280 characters', () => {
			const result = inputToProfile({ name: 'Ada', bio: 'a'.repeat(280) });
			expect(result.ok).toBe(true);
		});

		it('rejects a bio over 280 characters', () => {
			const result = inputToProfile({ name: 'Ada', bio: 'a'.repeat(281) });
			expect(result).toEqual({
				ok: false,
				errors: { bio: 'Bio must be 280 characters or fewer.' }
			});
		});
	});

	describe('location', () => {
		it('accepts an absent location as null', () => {
			const result = inputToProfile({ name: 'Ada', location: '' });
			expect(result.ok).toBe(true);
			expect(result.ok && result.value.location).toBeNull();
		});

		it('accepts a location at exactly 120 characters', () => {
			const result = inputToProfile({ name: 'Ada', location: 'a'.repeat(120) });
			expect(result.ok).toBe(true);
		});

		it('rejects a location over 120 characters', () => {
			const result = inputToProfile({ name: 'Ada', location: 'a'.repeat(121) });
			expect(result).toEqual({
				ok: false,
				errors: { location: 'Location must be 120 characters or fewer.' }
			});
		});
	});

	it('collects errors from multiple invalid fields at once', () => {
		const result = inputToProfile({
			name: '',
			image: 'not-a-url',
			bio: 'a'.repeat(281),
			location: 'a'.repeat(121)
		});
		expect(result).toEqual({
			ok: false,
			errors: {
				name: 'Name is required.',
				image: 'Image must be a valid http(s) URL.',
				bio: 'Bio must be 280 characters or fewer.',
				location: 'Location must be 120 characters or fewer.'
			}
		});
	});
});
