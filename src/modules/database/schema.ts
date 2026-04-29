import { pgTable, text, timestamp, index } from 'drizzle-orm/pg-core';

// ─── Users ────────────────────────────────────────────────────────────────────

export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),               // "usr_<nanoid>"
    username: text('username').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    usernameIdx: index('users_username_idx').on(table.username),
  }),
);

// ─── Rooms ────────────────────────────────────────────────────────────────────

export const rooms = pgTable(
  'rooms',
  {
    id: text('id').primaryKey(),               // "room_<nanoid>"
    name: text('name').notNull().unique(),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.username),       // store username for display
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    nameIdx: index('rooms_name_idx').on(table.name),
    createdByIdx: index('rooms_created_by_idx').on(table.createdBy),
  }),
);

// ─── Messages ─────────────────────────────────────────────────────────────────

export const messages = pgTable(
  'messages',
  {
    id: text('id').primaryKey(),               // "msg_<nanoid>"
    roomId: text('room_id')
      .notNull()
      .references(() => rooms.id, { onDelete: 'cascade' }),
    username: text('username').notNull(),
    content: text('content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    roomIdIdx: index('messages_room_id_idx').on(table.roomId),
    createdAtIdx: index('messages_created_at_idx').on(table.createdAt),
    // Composite index for cursor-based pagination
    roomCursorIdx: index('messages_room_cursor_idx').on(
      table.roomId,
      table.createdAt,
      table.id,
    ),
  }),
);

// ─── Type exports ─────────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Room = typeof rooms.$inferSelect;
export type NewRoom = typeof rooms.$inferInsert;

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
