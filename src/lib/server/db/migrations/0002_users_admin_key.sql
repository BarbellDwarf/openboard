-- At most one administrator may exist. The application-level NOT EXISTS
-- guard in promoteToAdmin cannot see concurrent transactions under READ
-- COMMITTED, so the race is settled here: a second simultaneous promotion
-- violates this index and fails with SQLSTATE 23505.
CREATE UNIQUE INDEX IF NOT EXISTS "users_role_admin_key" ON "users" ("role") WHERE "role" = 'admin';--> statement-breakpoint
