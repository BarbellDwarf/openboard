// Production entry point. Serves the adapter-node build and attaches Socket.IO.
import http from 'node:http';
import { Server } from 'socket.io';
import { injectSocketIO } from './build/realtime.mjs';
import { pool } from './src/lib/server/config/db.js';

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';

async function start() {
	let handler;
	try {
		({ handler } = await import('./build/handler.js'));
	} catch {
		console.error('No production build found in ./build. Run `npm run build` first.');
		process.exit(1);
	}

	const httpServer = http.createServer(handler);
	const io = new Server(httpServer, {
		connectionStateRecovery: { maxDisconnectionDuration: 60_000 }
	});
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
