<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { enablePush } from '$lib/client/push';

	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let pushState = $state<string | null>(null);

	async function enable(): Promise<void> {
		pushState = await enablePush().then((r) =>
			r.ok ? 'Push enabled.' : `Not enabled: ${r.reason}`
		);
	}

	async function markRead(id: number): Promise<void> {
		await fetch('/api/notifications/read', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id })
		});
		await invalidateAll();
	}
</script>

<svelte:head><title>Notifications - OpenBoard</title></svelte:head>

<main class="notif">
	<h1>Notifications</h1>
	{#if data.publicKey}
		<button type="button" onclick={() => void enable()}>Enable push notifications</button>
	{:else}
		<p class="muted">
			Push is not configured on this server (missing VAPID keys). In-app alerts still work.
		</p>
	{/if}
	{#if pushState}<p class="mono">{pushState}</p>{/if}

	{#if data.rows.length === 0}
		<p class="muted">Nothing new.</p>
	{:else}
		<ul>
			{#each data.rows as n (n.id)}
				<li>
					<span class="type">{n.type}</span>
					<span class="body">{JSON.stringify(n.payload.body ?? n.payload)}</span>
					<button type="button" onclick={() => void markRead(n.id)}>Mark read</button>
				</li>
			{/each}
		</ul>
	{/if}
</main>

<style>
	.notif {
		max-width: 640px;
		margin: 2rem auto 0;
		padding: 0 1rem;
	}
	h1 {
		font-family: 'Marcellus', serif;
		color: var(--parchment);
		font-size: 28px;
		margin-bottom: 1rem;
	}
	button {
		border-radius: 6px;
		border: 1px solid var(--walnut);
		background: transparent;
		color: var(--parchment);
		padding: 0.4rem 0.8rem;
		cursor: pointer;
		font-size: 13px;
	}
	button:hover {
		border-color: var(--amber);
	}
	ul {
		list-style: none;
		margin: 1rem 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	li {
		display: flex;
		gap: 0.75rem;
		align-items: center;
		justify-content: space-between;
		background: var(--baize-raised);
		border: 1px solid var(--walnut);
		border-radius: 6px;
		padding: 0.5rem 0.7rem;
		color: var(--parchment);
		font-size: 14px;
	}
	.type {
		color: var(--amber);
		text-transform: capitalize;
	}
	.body {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.muted {
		color: color-mix(in srgb, var(--parchment) 65%, transparent);
	}
	.mono {
		font-family: 'IBM Plex Mono', monospace;
		color: var(--parchment);
		font-size: 13px;
	}
	button:focus-visible {
		outline: 2px solid var(--amber);
		outline-offset: 2px;
	}
	@media (max-width: 640px) {
		.notif {
			margin-top: 1rem;
		}
		/* Type and action share the first row; the message wraps below at
		   full width instead of truncating into a sliver. */
		li {
			flex-wrap: wrap;
		}
		.body {
			order: 3;
			flex-basis: 100%;
			white-space: normal;
			overflow: visible;
			text-overflow: unset;
		}
		button {
			min-height: 44px;
		}
	}
</style>
