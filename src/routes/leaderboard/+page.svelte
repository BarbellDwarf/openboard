<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const speedLabels: Record<string, string> = {
		bullet: 'Bullet',
		blitz: 'Blitz',
		rapid: 'Rapid',
		classical: 'Classical'
	};
</script>

<svelte:head><title>Leaderboards - OpenBoard</title></svelte:head>

<main class="leaderboard">
	<h1>Leaderboards</h1>

	<nav class="filters" aria-label="Leaderboard filters">
		{#each data.variants as v (v)}
			<a class:active={v === data.variant} href={`${resolve('/leaderboard')}?variant=${v}&speed=${data.speed}`}>{v}</a>
		{/each}
		<span class="sep"></span>
		{#each data.speeds as s (s)}
			<a class:active={s === data.speed} href={`${resolve('/leaderboard')}?variant=${data.variant}&speed=${s}`}
				>{speedLabels[s]}</a
			>
		{/each}
	</nav>

	{#if data.rows.length === 0}
		<p class="empty">No rated games in this pool yet. Be the first.</p>
	{:else}
		<table>
			<thead>
				<tr
					><th scope="col">#</th><th scope="col">Player</th><th scope="col">Rating</th><th
						scope="col">Games</th
					></tr
				>
			</thead>
			<tbody>
				{#each data.rows as row, i (row.name)}
					<tr>
						<td class="mono">{i + 1}</td>
						<td>{row.name}</td>
						<td class="mono">{Math.round(row.rating)}{row.deviation >= 350 ? '?' : ''}</td>
						<td class="mono">{row.gamesPlayed}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</main>

<style>
	.leaderboard {
		max-width: 720px;
		margin: 2rem auto 0;
		padding: 0 1rem;
	}
	h1 {
		font-family: 'Marcellus', serif;
		color: var(--parchment);
		font-size: 28px;
		margin-bottom: 1rem;
	}
	.filters {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		align-items: center;
		margin-bottom: 1.25rem;
		font-size: 13px;
		text-transform: capitalize;
	}
	.filters a {
		color: var(--parchment);
		text-decoration: none;
		padding: 0.25rem 0.6rem;
		border-radius: 999px;
		border: 1px solid var(--walnut);
	}
	.filters a.active {
		background: var(--amber);
		color: #211b10;
		border-color: var(--amber);
		font-weight: 600;
	}
	.sep {
		width: 1px;
		height: 18px;
		background: var(--walnut);
		margin: 0 0.35rem;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		background: var(--baize-raised);
		border: 1px solid var(--walnut);
		border-radius: 8px;
		overflow: hidden;
	}
	th,
	td {
		padding: 0.55rem 0.9rem;
		text-align: left;
		border-bottom: 1px solid color-mix(in srgb, var(--walnut) 40%, transparent);
	}
	th {
		color: var(--parchment);
		font-size: 12px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	td {
		color: var(--parchment);
		font-size: 14px;
	}
	tbody tr:hover {
		background: rgb(232 163 61 / 8%);
	}
	.mono {
		font-family: 'IBM Plex Mono', monospace;
	}
	.empty {
		color: var(--parchment);
	}
	a:focus-visible,
	button:focus-visible {
		outline: 2px solid var(--amber);
		outline-offset: 2px;
	}
</style>
