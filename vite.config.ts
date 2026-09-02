import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import type { ViteDevServer } from 'vite';
import { Server as IOServer } from 'socket.io';
import { VitePWA } from 'vite-plugin-pwa';

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
					const gateway = mod as {
						injectSocketIO: (io: unknown) => void;
						startBackgroundJobs?: () => void;
					};
					const io = new IOServer(httpServer, {
						connectionStateRecovery: { maxDisconnectionDuration: 60_000 }
					});
					(gateway as { injectSocketIO: (io: unknown) => void }).injectSocketIO(io);
					gateway.startBackgroundJobs?.();
				});
			});
		}
	};
}

export default defineConfig({
	plugins: [
		openboardSocket(),
		sveltekit(),
		VitePWA({
			strategies: 'injectManifest',
			srcDir: 'src/service-worker',
			filename: 'sw.ts',
			registerType: 'prompt',
			injectRegister: null,
			// OpenBoard branding for the install prompt and OS surfaces. Amber
			// (#e8a33d from the clubroom tokens) is the accent used on buttons and
			// focus rings; baize (#0f1b14) is the app's base surface colour.
			manifest: {
				name: 'OpenBoard',
				short_name: 'OpenBoard',
				description:
					'A self-hostable online chess platform. Live games, long-running correspondence games, rated play with leaderboards, chat, and full support for chess variants.',
				lang: 'en',
				start_url: '/',
				scope: '/',
				display: 'standalone',
				background_color: '#0f1b14',
				theme_color: '#e8a33d',
				categories: ['games'],
				// Carried over from the removed static/manifest.webmanifest so
				// this generated manifest stays the single source of truth.
				shortcuts: [
					{ name: 'Lobby', url: '/lobby' },
					{ name: 'Play a bot', url: '/play-bot' }
				],
				icons: [
					{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
					{ src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
					{
						src: '/icons/icon-maskable-192.png',
						sizes: '192x192',
						type: 'image/png',
						purpose: 'maskable'
					},
					{
						src: '/icons/icon-maskable-512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'maskable'
					}
				]
			}
		})
	],
	test: {
		passWithNoTests: true,
		// Nested agent worktrees (.worktrees/*) carry their own src trees;
		// their specs must never run as part of this suite.
		exclude: ['**/node_modules/**', '**/.worktrees/**']
	}
});
