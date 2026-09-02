/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';

declare let self: ServiceWorkerGlobalScope;

// Precache is populated by vite-plugin-pwa's injectManifest at build time.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Pages and API fall back to network-first so live data stays fresh.
registerRoute(
	({ request }) => request.mode === 'navigate',
	new NetworkFirst({
		cacheName: 'pages',
		networkTimeoutSeconds: 3
	})
);

self.addEventListener('push', (event) => {
	let payload = { title: 'OpenBoard', body: 'Something happened in your game.', url: '/' };
	try {
		if (event.data) payload = { ...payload, ...event.data.json() };
	} catch {
		// Malformed payloads still get a generic notification.
	}
	event.waitUntil(
		self.registration.showNotification(payload.title, {
			body: payload.body,
			tag: payload.tag ?? 'openboard',
			data: { url: payload.url ?? '/' },
			icon: '/icons/icon-192.png',
			badge: '/icons/icon-192.png'
		})
	);
});

self.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const raw = (event.notification.data as { url?: string })?.url ?? '/';
	// Resolve against our origin, then match windows on origin + pathname:
	// a bare '/' must only focus a window that IS the home page, never any
	// other window, while query strings must not block a match ('/?ref=x'
	// should focus an existing home tab).
	let target: URL;
	try {
		target = new URL(raw, self.location.origin);
	} catch {
		target = new URL('/', self.location.origin);
	}
	event.waitUntil(
		(async () => {
			const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
			for (const client of windows) {
				let parsed: URL;
				try {
					parsed = new URL(client.url);
				} catch {
					continue;
				}
				if (parsed.origin === target.origin && parsed.pathname === target.pathname) {
					await client.focus();
					return;
				}
			}
			await self.clients.openWindow(target.href);
		})()
	);
});
