import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The hand-written migration files are applied by scripts/migrate.mjs, which
 * splits on the drizzle statement-breakpoint marker. These checks keep every
 * file splittable into well-formed statements without needing a database.
 */

const MIGRATIONS_DIR = path.dirname(fileURLToPath(import.meta.url));
const BREAKPOINT = '--> statement-breakpoint';

describe('migration sql', () => {
	it('splits every file into well-formed statements', async () => {
		const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();
		expect(files.length).toBeGreaterThan(0);

		for (const file of files) {
			const sql = await readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
			const statements = sql
				.split(BREAKPOINT)
				.map((s) => s.trim())
				.filter(Boolean);

			expect(statements.length, `${file} has statements`).toBeGreaterThan(0);
			for (const statement of statements) {
				expect(
					statement.endsWith(';'),
					`${file}: statement must end with a semicolon: ${statement}`
				).toBe(true);
				const quotes = (statement.match(/'/g) ?? []).length;
				expect(quotes % 2, `${file}: unbalanced quotes in: ${statement}`).toBe(0);
			}
		}
	});

	it('adds users.role idempotently with the user default', async () => {
		const sql = await readFile(path.join(MIGRATIONS_DIR, '0001_users_role.sql'), 'utf8');
		expect(sql).toContain('ALTER TABLE "users"');
		expect(sql).toContain('ADD COLUMN IF NOT EXISTS "role"');
		expect(sql).toContain("DEFAULT 'user'");
		expect(sql).toContain('NOT NULL');
	});

	it('adds the partial unique index that caps administrators at one', async () => {
		const sql = await readFile(path.join(MIGRATIONS_DIR, '0002_users_admin_key.sql'), 'utf8');
		expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "users_role_admin_key"');
		expect(sql).toContain('ON "users"');
		expect(sql).toContain(`WHERE "role" = 'admin'`);
	});

	it('adds games.bot_level idempotently for solo bot games', async () => {
		const sql = await readFile(path.join(MIGRATIONS_DIR, '0003_bot_level.sql'), 'utf8');
		expect(sql).toContain('ALTER TABLE "games"');
		expect(sql).toContain('ADD COLUMN IF NOT EXISTS "bot_level"');
		expect(sql).toContain('integer');
	});
});
