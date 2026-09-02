// Applies SQL migrations from src/lib/server/db/migrations in filename order.
// Applied filenames are recorded in a schema_migrations table, so the script is
// idempotent: re-running it skips everything already applied. Each file runs
// inside one transaction, so a failed file leaves no partial schema behind.
// Runs inside the app container before server start; also usable manually:
//   node scripts/migrate.mjs
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const MIGRATIONS_DIR = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	'..',
	'src/lib/server/db/migrations'
);
const BREAKPOINT = '--> statement-breakpoint';

async function main() {
	const databaseUrl = process.env.DATABASE_URL;
	if (!databaseUrl) {
		console.error('DATABASE_URL is not set. Example: postgres://user:password@host:5432/openboard');
		process.exit(1);
	}

	const files = (await readdir(MIGRATIONS_DIR)).filter((name) => name.endsWith('.sql')).sort();
	const client = new pg.Client({ connectionString: databaseUrl });
	await client.connect();

	try {
		await client.query(
			'CREATE TABLE IF NOT EXISTS schema_migrations (filename text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())'
		);
		const { rows } = await client.query('SELECT filename FROM schema_migrations');
		const applied = new Set(rows.map((row) => row.filename));

		let appliedCount = 0;
		for (const file of files) {
			if (applied.has(file)) {
				console.log(`Skipping ${file} (already applied).`);
				continue;
			}
			const sql = await readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
			const statements = sql
				.split(BREAKPOINT)
				.map((statement) => statement.trim())
				.filter(Boolean);

			await client.query('BEGIN');
			try {
				for (const statement of statements) {
					await client.query(statement);
				}
				await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
				await client.query('COMMIT');
			} catch (error) {
				await client.query('ROLLBACK');
				throw new Error(`${file}: ${error.message}`);
			}
			appliedCount += 1;
			console.log(
				`Applied ${file} (${statements.length} statement${statements.length === 1 ? '' : 's'}).`
			);
		}

		console.log(
			appliedCount > 0 ? `Done, ${appliedCount} migration(s) applied.` : 'Migrations up to date.'
		);
	} finally {
		await client.end();
	}
}

main().catch((error) => {
	console.error(`Migration failed: ${error.message}`);
	process.exit(1);
});
