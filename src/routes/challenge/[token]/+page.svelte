<script lang="ts">
	import { invalidateAll } from '$app/navigation';

	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let busy = $state(false);
	let error = $state<string | null>(null);

	const tc = $derived.by(() => {
		const c = data.challenge;
		if (c.speedClass === 'correspondence') return `${c.daysPerMove ?? 3} days per move`;
		const mins = (c.initialMs ?? 0) / 60_000;
		const inc = ((c.incrementMs ?? 0) / 1000).toFixed(0);
		return `${mins}+${inc}`;
	});

	async function accept(): Promise<void> {
		busy = true;
		error = null;
		const res = await fetch('/api/challenges', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'accept', challengeId: data.challenge.id })
		});
		const body = await res.json();
		busy = false;
		if (!res.ok || !body.ok) {
			error = 'This challenge is no longer available.';
			await invalidateAll();
			return;
		}
		window.location.href = `/game/${body.gameId}`;
	}
</script>

<svelte:head><title>Challenge - OpenBoard</title></svelte:head>

<section class="panel">
	{#if data.isChallenger}
		<h1>Your challenge is live</h1>
		<p class="muted">Share this link with an opponent. They accept, the game starts.</p>
	{:else}
		<h1>{data.challenge.challengerName} challenges you</h1>
	{/if}

	<dl class="details">
		<div>
			<dt>Variant</dt>
			<dd>{data.challenge.variant}</dd>
		</div>
		<div>
			<dt>Time control</dt>
			<dd>{tc}</dd>
		</div>
		<div>
			<dt>Rating</dt>
			<dd>{data.challenge.rated ? 'Rated' : 'Casual'}</dd>
		</div>
		<div>
			<dt>Color</dt>
			<dd>
				{data.challenge.colorChoice === 'random'
					? 'Random'
					: `${data.challenge.colorChoice} for the challenger`}
			</dd>
		</div>
		<div>
			<dt>Status</dt>
			<dd>{data.challenge.status}</dd>
		</div>
	</dl>

	{#if !data.signedIn}
		<a class="primary" href={`/login?returnTo=/challenge/${data.token}`}>Sign in to accept</a>
	{:else if data.isChallenger}
		<p class="muted">Waiting for someone to accept.</p>
	{:else if data.challenge.status !== 'open'}
		<p class="muted">This challenge is no longer open.</p>
	{:else}
		<button type="button" class="primary" disabled={busy} onclick={() => void accept()}>
			{busy ? 'Accepting...' : 'Accept challenge'}
		</button>
	{/if}
	{#if error}<p class="error" role="alert">{error}</p>{/if}
</section>

<style>
	.panel {
		max-width: 30rem;
		margin: 3rem auto;
		padding: 1.5rem;
		border: 1px solid var(--walnut);
		border-radius: 12px;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	h1 {
		font-size: 1.25rem;
		margin: 0;
	}
	.details {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.4rem 1rem;
		margin: 0;
	}
	dt {
		color: var(--lichen);
	}
	dd {
		margin: 0;
	}
	.muted {
		color: var(--lichen);
		margin: 0;
	}
	.error {
		color: var(--flag-red);
		margin: 0;
	}
	.primary {
		align-self: flex-start;
	}
	a.primary {
		text-decoration: none;
		padding: 0.5rem 1rem;
		border-radius: 8px;
		background: var(--amber);
		color: var(--ink);
	}
	button.primary {
		padding: 0.5rem 1rem;
		border-radius: 8px;
		background: var(--amber);
		color: var(--ink);
		border: none;
		cursor: pointer;
	}
</style>
