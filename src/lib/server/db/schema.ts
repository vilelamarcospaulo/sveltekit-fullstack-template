// App-owned tables go here, alongside the re-exported better-auth-owned
// tables below.
import { pgTable, text, timestamp, date, uniqueIndex } from 'drizzle-orm/pg-core';
import { user } from './auth.schema';

// 1-1 extension of `user`: fields that aren't part of better-auth's own
// generated schema. `id` is app-generated (cuid2, via createId() in
// $lib/internal/use_case/profile.ts) rather than db-generated, matching the
// Next.js sibling template's src/lib/schema.ts `profile` table. userId is
// unique (not just indexed) to enforce the 1-1 relationship and to give
// `updateProfile`'s `onConflictDoUpdate` a target for its upsert.
export const profile = pgTable(
	'profile',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		birthdate: date('birthdate', { mode: 'date' }),
		bio: text('bio'),
		location: text('location'),
		createdAt: timestamp('created_at').defaultNow().notNull(),
		updatedAt: timestamp('updated_at')
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull()
	},
	(table) => [uniqueIndex('profile_user_id_key').on(table.userId)]
);

export * from './auth.schema';
