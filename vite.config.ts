import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import type { ViteDevServer } from 'vite';
import { Server as IOServer } from 'socket.io';

// Dev-mode Socket.IO wiring. Production uses build/realtime.mjs from the
// custom server; both paths share one gateway module so behavior matches.
function openboardSocket(): {
	name: string;
	configureServer: (server: ViteDevServer) => void;
} {
	return {
		name: 'openboard-socket',
		configureServer(server) {
			const httpServer = server.httpServer;
			if (!httpServer || (globalThis as Record<string, unknown>).__obSocketWired) return;
			(globalThis as Record<string, unknown>).__obSocketWired = true;
			httpServer.once('listening', () => {
				void server.ssrLoadModule('/src/lib/server/realtime/index.ts').then((mod) => {
					const gateway = mod as { injectSocketIO: (io: unknown) => void };
					const io = new IOServer(httpServer, {
						connectionStateRecovery: { maxDisconnectionDuration: 60_000 }
					});
					gateway.injectSocketIO(io);
				});
			});
		}
	};
}

export default defineConfig({
	plugins: [openboardSocket(), sveltekit()],
	test: {
		passWithNoTests: true
	}
});
