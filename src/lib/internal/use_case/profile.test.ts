// Mocks Drizzle's fluent query builder rather than hitting real Postgres (no
// integration test project exists yet). Each chain is a plain object whose
// methods return itself and resolves via `then` to a canned result.
import { describe, it, expect, vi } from 'vitest';
import type { DrizzleDb } from '$lib/server/db';
import { getProfile, updateProfile } from './profile';

function makeChain<T>(methods: string[], result: T) {
	const chain: Record<string, unknown> = {};
	for (const method of methods) {
		chain[method] = vi.fn(() => chain);
	}
	chain.then = (resolve: (value: T) => void) => resolve(result);
	return chain;
}

function createMockDb(options: {
	selectRows?: unknown[];
	updateRows?: unknown[];
	insertRows?: unknown[];
}) {
	const selectChain = makeChain(['from', 'leftJoin', 'where', 'limit'], options.selectRows ?? []);
	const updateChain = makeChain(['set', 'where', 'returning'], options.updateRows ?? []);
	const insertChain = makeChain(
		['values', 'onConflictDoUpdate', 'returning'],
		options.insertRows ?? []
	);

	const tx = {
		update: vi.fn(() => updateChain),
		insert: vi.fn(() => insertChain)
	};

	const db = {
		select: vi.fn(() => selectChain),
		transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(tx))
	};

	return { db: db as unknown as DrizzleDb, tx, selectChain, updateChain, insertChain };
}

describe('getProfile', () => {
	it('returns null when the user row is missing', async () => {
		const { db } = createMockDb({ selectRows: [] });
		const result = await getProfile(db, 'user-1');
		expect(result).toBeNull();
	});

	it('merges user + profile fields, serialising birthdate to YYYY-MM-DD', async () => {
		const { db } = createMockDb({
			selectRows: [
				{
					name: 'Ada Lovelace',
					email: 'ada@example.com',
					image: 'https://example.com/ada.png',
					birthdate: new Date(Date.UTC(1990, 5, 15)),
					bio: 'Mathematician.',
					location: 'London'
				}
			]
		});
		const result = await getProfile(db, 'user-1');
		expect(result).toEqual({
			name: 'Ada Lovelace',
			email: 'ada@example.com',
			image: 'https://example.com/ada.png',
			birthdate: '1990-06-15',
			bio: 'Mathematician.',
			location: 'London'
		});
	});

	it('flattens a missing profile row (leftJoin nulls) to null fields', async () => {
		const { db } = createMockDb({
			selectRows: [
				{
					name: 'Ada Lovelace',
					email: 'ada@example.com',
					image: null,
					birthdate: null,
					bio: null,
					location: null
				}
			]
		});
		const result = await getProfile(db, 'user-1');
		expect(result).toEqual({
			name: 'Ada Lovelace',
			email: 'ada@example.com',
			image: null,
			birthdate: null,
			bio: null,
			location: null
		});
	});
});

describe('updateProfile', () => {
	it('returns validation errors and never opens a transaction on invalid input', async () => {
		const { db } = createMockDb({});
		const result = await updateProfile(db, 'user-1', { name: '' });
		expect(result).toEqual({ ok: false, errors: { name: 'Name is required.' } });
		expect(db.transaction).not.toHaveBeenCalled();
	});

	it('persists valid input and returns the merged view', async () => {
		const { db } = createMockDb({
			updateRows: [
				{ name: 'Ada Lovelace', email: 'ada@example.com', image: 'https://example.com/ada.png' }
			],
			insertRows: [
				{ birthdate: new Date(Date.UTC(1990, 5, 15)), bio: 'Mathematician.', location: 'London' }
			]
		});

		const result = await updateProfile(db, 'user-1', {
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
				email: 'ada@example.com',
				image: 'https://example.com/ada.png',
				birthdate: '1990-06-15',
				bio: 'Mathematician.',
				location: 'London'
			}
		});
		expect(db.transaction).toHaveBeenCalledOnce();
	});
});
