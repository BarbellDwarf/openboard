/** Client push-subscription flow. Permission is only requested on explicit call. */

export async function enablePush(): Promise<{ ok: boolean; reason?: string }> {
	if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
		return { ok: false, reason: 'unsupported' };
	}
	const permission = await Notification.requestPermission();
	if (permission !== 'granted') return { ok: false, reason: 'denied' };

	const keyRes = await fetch('/api/push/subscribe', { method: 'OPTIONS' });
	const { publicKey } = (await keyRes.json()) as { publicKey?: string };
	if (!publicKey) return { ok: false, reason: 'no-vapid-keys' };

	const reg = await navigator.serviceWorker.ready;
	const existing = await reg.pushManager.getSubscription();
	const sub =
		existing ??
		(await reg.pushManager.subscribe({
			userVisibleOnly: true,
			applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource
		}));

	const subJson = sub.toJSON();
	const res = await fetch('/api/push/subscribe', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(subJson)
	});
	return res.ok ? { ok: true } : { ok: false, reason: 'server-rejected' };
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
	const padding = '='.repeat((4 - (base64.length % 4)) % 4);
	const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
	return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}
