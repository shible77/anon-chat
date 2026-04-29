-- Migration: 0000_initial_schema
-- Generated for: anon-chat

CREATE TABLE IF NOT EXISTS "users" (
  "id"         TEXT        PRIMARY KEY,
  "username"   TEXT        NOT NULL UNIQUE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "users_username_idx" ON "users" ("username");

CREATE TABLE IF NOT EXISTS "rooms" (
  "id"         TEXT        PRIMARY KEY,
  "name"       TEXT        NOT NULL UNIQUE,
  "created_by" TEXT        NOT NULL REFERENCES "users"("username"),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "rooms_name_idx"       ON "rooms" ("name");
CREATE INDEX IF NOT EXISTS "rooms_created_by_idx" ON "rooms" ("created_by");

CREATE TABLE IF NOT EXISTS "messages" (
  "id"         TEXT        PRIMARY KEY,
  "room_id"    TEXT        NOT NULL REFERENCES "rooms"("id") ON DELETE CASCADE,
  "username"   TEXT        NOT NULL,
  "content"    TEXT        NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS "messages_room_id_idx"    ON "messages" ("room_id");
CREATE INDEX IF NOT EXISTS "messages_created_at_idx" ON "messages" ("created_at");
CREATE INDEX IF NOT EXISTS "messages_room_cursor_idx" ON "messages" ("room_id", "created_at", "id");
