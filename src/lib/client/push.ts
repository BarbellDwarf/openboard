/** Client push-subscription flow. Permission is only requested on explicit call. */

const SW_URL = '/sw.js';

export type PushFailureReason =
	'unsupported' | 'denied' | 'sw-unavailable' | 'no-vapid-keys' | 'server-rejected' | 'failed';

export type PushEnableResult = { ok: true } | { ok: false; reason: PushFailureReason };

/** Human-readable status for each outcome, including honest failure states. */
export function pushStatusMessage(result: PushEnableResult): string {
	if (result.ok) return 'Push notifications enabled.';
	switch (result.reason) {
		case 'unsupported':
			return "This browser doesn't support web push.";
		case 'denied':
			return 'Notifications are blocked for this site. Allow them in your browser settings, then try again.';
		case 'sw-unavailable':
			return 'The notification service could not start. Reload the page and try again.';
		case 'no-vapid-keys':
			return 'Push is not configured on this server yet.';
		case 'server-rejected':
			return 'The server rejected your subscription. Try again later.';
		case 'failed':
			return 'Something went wrong while enabling push. Try again.';
	}
}

function pushSupported(): boolean {
	return typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
}

/** Current Notification.permission without ever triggering a prompt. */
export function notificationPermission(): NotificationPermission | 'unsupported' {
	if (typeof window === 'undefined' || typeof Notification === 'undefined') return 'unsupported';
	return Notification.permission;
}

/** The active push subscription, or null when there is none (or push is unavailable). */
export async function currentPushSubscription(): Promise<PushSubscriptionJSON | null> {
	if (!pushSupported()) return null;
	try {
		const reg = await navigator.serviceWorker.getRegistration();
		const sub = reg ? await reg.pushManager.getSubscription() : null;
		return sub ? sub.toJSON() : null;
	} catch {
		return null;
	}
}

export async function enablePush(): Promise<PushEnableResult> {
	if (!pushSupported()) return { ok: false, reason: 'unsupported' };

	// Check server keys before prompting so we never ask for permission
	// when the subscription could not be stored anyway.
	let publicKey: string | undefined;
	try {
		const keyRes = await fetch('/api/push/subscribe', { method: 'OPTIONS' });
		({ publicKey } = (await keyRes.json()) as { publicKey?: string });
	} catch {
		return { ok: false, reason: 'no-vapid-keys' };
	}
	if (!publicKey) return { ok: false, reason: 'no-vapid-keys' };

	const permission = await Notification.requestPermission();
	if (permission !== 'granted') return { ok: false, reason: 'denied' };

	try {
		await navigator.serviceWorker.register(SW_URL);
	} catch {
		return { ok: false, reason: 'sw-unavailable' };
	}

	try {
		const reg = await navigator.serviceWorker.ready;
		const existing = await reg.pushManager.getSubscription();
		const sub =
			existing ??
			(await reg.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource
			}));

		const res = await fetch('/api/push/subscribe', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(sub.toJSON())
		});
		return res.ok ? { ok: true } : { ok: false, reason: 'server-rejected' };
	} catch {
		return { ok: false, reason: 'failed' };
	}
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
	const padding = '='.repeat((4 - (base64.length % 4)) % 4);
	const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
	return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}
