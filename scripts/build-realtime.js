import { build } from 'esbuild';
import path from 'node:path';

// Bundles the realtime gateway so the custom production server can import it
// from build/. SvelteKit's adapter-node does not include this entry.
await build({
	entryPoints: ['src/lib/server/realtime/index.ts'],
	outfile: 'build/realtime.mjs',
	bundle: true,
	platform: 'node',
	format: 'esm',
	target: 'node22',
	external: ['pg', 'socket.io'],
	alias: {
		$lib: path.resolve(process.cwd(), 'src/lib')
	},
	sourcemap: false,
	logLevel: 'warning'
});

console.log('realtime gateway bundled to build/realtime.mjs');
