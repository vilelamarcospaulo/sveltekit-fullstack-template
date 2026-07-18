import { pgTable, text, timestamp, date, uniqueIndex } from 'drizzle-orm/pg-core';
import { user } from './auth.schema';

// `id` is app-generated (cuid2), not db-generated. userId is unique (not
// just indexed) to enforce the 1-1 relationship and give updateProfile's
// onConflictDoUpdate a target.
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
