<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const fmtRemaining = (ms: number): string => {
		if (ms <= 0) return 'flagged';
		const days = Math.floor(ms / 86400000);
		const hours = Math.floor((ms % 86400000) / 3600000);
		return days > 0 ? `${days}d ${hours}h` : `${hours}h`;
	};

	function remainingFor(game: (typeof data.games)[number]): number {
		return game.deadline - Date.now();
	}
</script>

<svelte:head><title>My games - OpenBoard</title></svelte:head>

<main class="games">
	<h1>My games</h1>
	{#if data.games.length === 0}
		<p class="muted">No games yet. Find an opponent in the lobby.</p>
	{:else}
		<ul>
			{#each data.games as g (g.id)}
				<li>
					<a href={resolve(`/game/${g.id}`)} class="mono">{g.variant}</a>
					<span>{g.rated ? 'Rated' : 'Casual'}</span>
					{#if g.status === 'started' && g.daysPerMove}
						<span class:urgent={remainingFor(g) < 0.5 * 86400000 * g.daysPerMove * 0.25}>
							{fmtRemaining(remainingFor(g))} left
						</span>
					{/if}
					{#if g.status === 'finished'}
						<span
							>{g.result === 'draw'
								? 'Draw'
								: `${g.result === 'white' ? 'White' : 'Black'} won`}</span
						>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</main>

<style>
	.games {
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
	li {
		display: flex;
		gap: 0.75rem;
		align-items: center;
		padding: 0.5rem;
		border: 1px solid var(--walnut);
		border-radius: 6px;
		margin-bottom: 0.5rem;
		color: var(--parchment);
		background: var(--baize-raised);
	}
	a {
		color: var(--amber);
		text-decoration: none;
	}
	.urgent {
		color: var(--flag-red);
	}
	.mono,
	span {
		font-size: 13px;
	}
	.muted {
		color: color-mix(in srgb, var(--parchment) 65%, transparent);
	}
</style>
