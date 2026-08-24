<script lang="ts">
	import { resolve } from '$app/paths';

	import { LEARN_VARIANT_PAGES } from './content';
</script>

<svelte:head><title>Learn - OpenBoard</title></svelte:head>

<main class="learn">
	<h1>Learn</h1>
	<p class="intro">
		How the site works, and how each of the eight rulesets plays. Everything here describes what
		this app actually does, engine quirks included.
	</p>

	<nav class="grid" aria-label="Learn topics">
		<a href={resolve('/learn/basics')}>
			<h2>Getting started</h2>
			<p>
				Accounts, lobby fields, quick pair, board and clock reading, correspondence, Glicko-2
				ratings, chat, finishing games, PGN export.
			</p>
		</a>

		{#each LEARN_VARIANT_PAGES as page (page.id)}
			<a href={resolve(`/learn/${page.id}`)}>
				<h2>{page.name}</h2>
				<p>{page.blurb}</p>
			</a>
		{/each}

		<a href={resolve('/learn/customize')}>
			<h2>Customize</h2>
			<p>
				Board themes, piece sets, sounds and volume, motion preferences, day and night schemes, and
				where your settings apply.
			</p>
		</a>
	</nav>
</main>

<style>
	.learn {
		max-width: 1000px;
		margin: 2rem auto 0;
		padding: 0 1rem 2.5rem;
	}
	h1 {
		font-family: 'Marcellus', serif;
		color: var(--parchment);
		font-size: 28px;
		margin-bottom: 0.5rem;
	}
	.intro {
		color: color-mix(in srgb, var(--parchment) 75%, transparent);
		max-width: 60ch;
		margin: 0 0 1.5rem;
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
		gap: 1rem;
	}
	.grid a {
		display: block;
		background: var(--baize-raised);
		border: 1px solid color-mix(in srgb, var(--walnut) 50%, transparent);
		border-radius: 10px;
		padding: 1rem;
		text-decoration: none;
	}
	.grid a:hover {
		border-color: var(--amber);
	}
	.grid h2 {
		color: var(--parchment);
		font-size: 15px;
		margin: 0 0 0.4rem;
	}
	.grid p {
		color: color-mix(in srgb, var(--parchment) 75%, transparent);
		font-size: 13px;
		line-height: 1.5;
		margin: 0;
	}
	a:focus-visible {
		outline: 2px solid var(--amber);
		outline-offset: 2px;
	}
</style>
