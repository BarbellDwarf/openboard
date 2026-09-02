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
	const url = (event.notification.data as { url?: string })?.url ?? '/';
	event.waitUntil(
		self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
			for (const client of clients) {
				if (client.url.includes(url)) return client.focus();
			}
			return self.clients.openWindow(url);
		})
	);
});
