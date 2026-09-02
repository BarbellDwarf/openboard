// Production entry point. Serves the adapter-node build and attaches Socket.IO.
import http from 'node:http';
import { Server } from 'socket.io';

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';

function validateProductionEnv() {
	if (process.env.NODE_ENV !== 'production') return;
	const required = ['DATABASE_URL', 'ORIGIN', 'BETTER_AUTH_SECRET'];
	const missing = required.filter((key) => !process.env[key]);
	if (missing.length > 0) {
		console.error(`Missing required environment variables: ${missing.join(', ')}`);
		process.exit(1);
	}
}

async function start() {
	validateProductionEnv();
	let handler;
	let injectSocketIO;
	let startBackgroundJobs;
	let closePool;
	try {
		({ handler } = await import('./build/handler.js'));
		// The realtime bundle re-exports closePool from $lib/server/db, so
		// SIGTERM drains the same pool the gateway queried.
		({ injectSocketIO, startBackgroundJobs, closePool } = await import('./build/realtime.mjs'));
	} catch {
		console.error('No production build found in ./build. Run `npm run build` first.');
		process.exit(1);
	}

	const httpServer = http.createServer(handler);
	const io = new Server(httpServer, {
		connectionStateRecovery: { maxDisconnectionDuration: 60_000 },
		// 64KB: chat lines and move UCIs are tiny; the engine.io default (1MB)
		// lets a single frame hammer the move handler with megabyte strings.
		maxHttpBufferSize: 65536
	});
	injectSocketIO(io);

	startBackgroundJobs();

	httpServer.listen(port, host, () => {
		console.log(`OpenBoard listening on port ${port}`);
	});

	process.on('SIGTERM', () => {
		io.close();
		httpServer.close(async () => {
			try {
				await closePool();
			} finally {
				process.exit(0);
			}
		});
	});
}

start();
