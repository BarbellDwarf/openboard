import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	dialect: 'postgresql',
	schema: './src/lib/server/db/schema.ts',
	out: './src/lib/server/db/migrations',
	dbCredentials: {
		url: process.env.DATABASE_URL ?? 'postgres://openboard:openboard@localhost:5432/openboard'
	},
	strict: true,
	verbose: true
});
