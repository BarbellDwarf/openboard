// Production entry point. Serves the adapter-node build and attaches Socket.IO.
import http from 'node:http';
import { Server } from 'socket.io';
import { injectSocketIO } from './src/lib/server/realtime/index.js';
import { pool } from './src/lib/server/config/db.js';

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
	try {
		({ handler } = await import('./build/handler.js'));
	} catch {
		console.error('No production build found in ./build. Run `npm run build` first.');
		process.exit(1);
	}

	const httpServer = http.createServer(handler);
	const io = new Server(httpServer);
	injectSocketIO(io);

	httpServer.listen(port, host, () => {
		console.log(`OpenBoard listening on port ${port}`);
	});

	process.on('SIGTERM', () => {
		io.close();
		httpServer.close(async () => {
			try {
				await pool.end();
			} finally {
				process.exit(0);
			}
		});
	});
}

start();
