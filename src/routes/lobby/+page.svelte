<script lang="ts">
	import { resolve } from '$app/paths';
	import { invalidateAll } from '$app/navigation';

	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let variant = $state('standard');
	let speed = $state<'blitz' | 'bullet' | 'rapid' | 'classical' | 'correspondence'>('blitz');
	let rated = $state(true);
	let colorChoice = $state<'random' | 'white' | 'black'>('random');
	let days = $state(3);
	let pairing = $state(false);
	let busy = $state(false);

	async function post(body: Record<string, unknown>): Promise<Record<string, unknown>> {
		const res = await fetch('/api/challenges', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ variant, speedClass: speed, rated, ...body })
		});
		return res.json();
	}

	async function createChallenge(): Promise<void> {
		busy = true;
		await post({ action: 'create', colorChoice, days });
		busy = false;
		await invalidateAll();
	}

	async function accept(id: string): Promise<void> {
		busy = true;
		const r = await post({ action: 'accept', challengeId: id });
		busy = false;
		if (r.gameId) window.location.href = resolve(`/game/${r.gameId}`);
	}

	async function quickPair(): Promise<void> {
		pairing = true;
		const r = await post({ action: 'quickpair' });
		pairing = false;
		if (r.gameId) window.location.href = resolve(`/game/${r.gameId}`);
	}
</script>

<svelte:head><title>Lobby - OpenBoard</title></svelte:head>

<main class="lobby">
	<h1>Lobby</h1>

	<section class="panel">
		<h2>Create a challenge</h2>
		<div class="row">
			<label>
				Variant
				<select bind:value={variant}>
					{#each ['standard', 'chess960', 'crazyhouse', 'kingofthehill', 'threecheck', 'atomic', 'horde', 'racingkings'] as v (v)}
						<option value={v}>{v}</option>
					{/each}
				</select>
			</label>
			<label>
				Time control
				<select bind:value={speed}>
					<option value="bullet">Bullet 1+0</option>
					<option value="blitz">Blitz 5+2</option>
					<option value="rapid">Rapid 10+10</option>
					<option value="classical">Classical 30+30</option>
					<option value="correspondence">Correspondence</option>
				</select>
			</label>
			<button type="button" onclick={() => (speed = 'correspondence')}>Correspondence...</button>
			{#if speed === 'correspondence'}
				<label>
					Days per move
					<select bind:value={days}>
						{#each [1, 2, 3, 7, 14] as d (d)}<option value={d}>{d}</option>{/each}
					</select>
				</label>
			{/if}
			<label class="check">
				<input type="checkbox" bind:checked={rated} /> Rated
			</label>
			<label>
				Color
				<select bind:value={colorChoice}>
					<option value="random">Random</option>
					<option value="white">White</option>
					<option value="black">Black</option>
				</select>
			</label>
		</div>
		<div class="row">
			<button type="button" class="primary" disabled={busy} onclick={() => void createChallenge()}>
				Create challenge
			</button>
			<button type="button" disabled={pairing} onclick={() => void quickPair()}>
				{pairing ? 'Searching for a partner...' : 'Quick pair'}
			</button>
		</div>
	</section>

	<section class="panel">
		<h2>Open challenges</h2>
		{#if data.challenges.length === 0}
			<p class="muted">None open right now. Create one above.</p>
		{:else}
			<ul class="list">
				{#each data.challenges as c (c.id)}
					<li>
						<span class="mono">{c.variant}</span>
						<span>{c.speedClass}{c.daysPerMove ? ` (${c.daysPerMove}d/move)` : ''}</span>
						<span>{c.rated ? 'Rated' : 'Casual'}</span>
						<button type="button" onclick={() => void accept(c.id)}>Accept</button>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
</main>

<style>
	.lobby {
		max-width: 720px;
		margin: 2rem auto 0;
		padding: 0 1rem;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
	}
	h1 {
		font-family: 'Marcellus', serif;
		color: var(--parchment);
		font-size: 28px;
		margin: 0;
	}
	h2 {
		color: var(--parchment);
		font-size: 16px;
		margin: 0 0 0.75rem;
	}
	.panel {
		background: var(--baize-raised);
		border: 1px solid var(--walnut);
		border-radius: 8px;
		padding: 1rem;
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		align-items: end;
		margin-bottom: 0.75rem;
	}
	label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		color: var(--parchment);
		font-size: 12px;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	select,
	input[type='checkbox'] {
		background: var(--baize);
		border: 1px solid var(--walnut);
		border-radius: 6px;
		color: var(--parchment);
		padding: 0.4rem;
		font-family: inherit;
	}
	button {
		padding: 0.45rem 0.9rem;
		border-radius: 6px;
		border: 1px solid var(--walnut);
		background: transparent;
		color: var(--parchment);
		cursor: pointer;
		font-size: 13px;
	}
	button.primary {
		background: var(--amber);
		border-color: var(--amber);
		color: #211b10;
		font-weight: 600;
	}
	button:hover {
		border-color: var(--amber);
	}
	.check {
		flex-direction: row !important;
		align-items: center;
		gap: 0.4rem !important;
	}
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.list li {
		display: flex;
		gap: 0.75rem;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem 0.6rem;
		border: 1px solid color-mix(in srgb, var(--walnut) 50%, transparent);
		border-radius: 6px;
		color: var(--parchment);
		font-size: 14px;
	}
	.mono {
		font-family: 'IBM Plex Mono', monospace;
	}
	.muted {
		color: color-mix(in srgb, var(--parchment) 65%, transparent);
	}
	a:focus-visible,
	button:focus-visible,
	select:focus-visible {
		outline: 2px solid var(--amber);
		outline-offset: 2px;
	}
</style>
