<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const page = $derived(data.page);
</script>

<svelte:head><title>{page.name} - OpenBoard</title></svelte:head>

<main class="learn">
	<nav class="crumbs" aria-label="Breadcrumb">
		<a href={resolve('/learn')}>Learn</a>
		<span aria-hidden="true">/</span>
		<span>{page.name}</span>
	</nav>

	<h1>{page.name}</h1>
	<p class="intro">{page.blurb}</p>

	<section>
		<h2>Winning and losing</h2>
		<ul>
			{#each page.win as line (line)}
				<li>{line}</li>
			{/each}
		</ul>
	</section>

	<section>
		<h2>How it plays here</h2>
		<ul>
			{#each page.rules as line (line)}
				<li>{line}</li>
			{/each}
		</ul>
	</section>

	<section>
		<h2>Tips</h2>
		<ul>
			{#each page.tips as line (line)}
				<li>{line}</li>
			{/each}
		</ul>
	</section>

	<p class="cta">
		<a class="play" href={`/play-bot?variant=${page.id}`}>Play {page.name} against a bot</a>
	</p>
</main>

<style>
	.learn {
		max-width: 720px;
		margin: 2rem auto 0;
		padding: 0 1rem 2.5rem;
	}
	.crumbs {
		display: flex;
		gap: 0.4rem;
		font-size: 13px;
		margin-bottom: 0.75rem;
		color: color-mix(in srgb, var(--parchment) 65%, transparent);
	}
	.crumbs a {
		color: var(--amber);
		text-decoration: none;
	}
	h1 {
		font-family: 'Marcellus', serif;
		color: var(--parchment);
		font-size: 28px;
		margin-bottom: 0.5rem;
	}
	.intro {
		color: color-mix(in srgb, var(--parchment) 75%, transparent);
		margin: 0 0 1.5rem;
	}
	section {
		background: var(--baize-raised);
		border: 1px solid color-mix(in srgb, var(--walnut) 50%, transparent);
		border-radius: 10px;
		padding: 1rem 1.1rem;
		margin-bottom: 1rem;
	}
	h2 {
		color: var(--parchment);
		font-size: 16px;
		margin: 0 0 0.5rem;
	}
	ul {
		margin: 0;
		padding-left: 1.2rem;
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
	}
	li {
		color: var(--parchment);
		font-size: 14px;
		line-height: 1.55;
	}
	.cta {
		margin-top: 1.25rem;
	}
	.play {
		display: inline-block;
		background: var(--amber);
		color: var(--on-primary);
		text-decoration: none;
		font-weight: 600;
		font-size: 15px;
		padding: 0.6rem 1.3rem;
		border-radius: 8px;
	}
	@media (max-width: 640px) {
		.play {
			display: inline-flex;
			align-items: center;
			justify-content: center;
			min-height: 44px;
			padding: 0.7rem 1.3rem;
		}
	}
	a:focus-visible {
		outline: 2px solid var(--amber);
		outline-offset: 2px;
	}
</style>
