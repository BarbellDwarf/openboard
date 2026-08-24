<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';

	import Board from '$lib/components/board/Board.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let setupBannerDismissed = $state(false);
	const showSetupBanner = $derived(!!data.needsSetup && !data.user && !setupBannerDismissed);

	const START_XFEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

	const demo = $state({
		xfen: '',
		dests: {} as Record<string, string[]>,
		last: null as [string, string] | null
	});

	async function reset(): Promise<void> {
		// The board must never jam on a failed reset: fall back to the local
		// start position so the next cycle can step from it regardless.
		try {
			const res = await fetch('/api/demo/move', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ xfen: START_XFEN })
			});
			if (!res.ok) throw new Error(`reset failed: ${res.status}`);
			const d = await res.json();
			demo.xfen = d.xfen;
			demo.dests = d.dests;
			demo.last = null;
		} catch {
			demo.xfen = START_XFEN;
			demo.dests = {};
			demo.last = null;
		}
	}

	async function step(uci: string): Promise<void> {
		const res = await fetch('/api/demo/move', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ xfen: demo.xfen, uci })
		});
		if (!res.ok) return;
		const d = await res.json();
		demo.xfen = d.xfen;
		demo.dests = d.dests;
		demo.last = [uci.slice(0, 2), uci.slice(2, 4)];
	}

	const scriptMoves = ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1b5'];
	let scriptIndex = 0;
	onMount(() => {
		void reset();
		const id = setInterval(() => {
			if (scriptIndex >= scriptMoves.length) {
				scriptIndex = 0;
				void reset();
				return;
			}
			void step(scriptMoves[scriptIndex]);
			scriptIndex++;
		}, 1600);
		return () => clearInterval(id);
	});
</script>

<svelte:head><title>OpenBoard - play chess your way</title></svelte:head>

{#if showSetupBanner}
	<div class="setup-banner" role="note">
		<p>
			This server has no administrator yet. <a href={resolve('/setup')}>Finish setup</a> to create one.
		</p>
		<button
			type="button"
			aria-label="Dismiss setup reminder"
			onclick={() => (setupBannerDismissed = true)}
		>
			Dismiss
		</button>
	</div>
{/if}

<section class="hero">
	<div class="hero-board" style="--board-size: 100%;">
		{#if demo.xfen}
			<Board xfen={demo.xfen} dests={demo.dests} lastMove={demo.last} />
		{/if}
	</div>
	<div class="copy">
		<h1>Chess, hosted by you.</h1>
		<p>
			Live games and slow correspondence. Eight rulesets from standard to Crazyhouse. Ratings,
			leaderboards, chat, and bots. One Docker command and it is yours.
		</p>
		<div class="cta">
			<a class="primary" href={resolve('/lobby')}>Find a game</a>
			<a class="secondary" href={resolve('/play-bot')}>Play a bot</a>
		</div>
	</div>
</section>

<section class="features">
	<article>
		<h3>Eight rulesets</h3>
		<p>
			Standard, Chess960, Crazyhouse, King of the Hill, Three-check, Atomic, Horde, Racing Kings.
		</p>
	</article>
	<article>
		<h3>Play at any pace</h3>
		<p>Bullet to classical clocks, or correspondence moves measured in days.</p>
	</article>
	<article>
		<h3>Glicko-2 ratings</h3>
		<p>Per-variant leaderboards that reward the games you actually play.</p>
	</article>
	<article>
		<h3>Yours, completely</h3>
		<p>Self-hosted in two containers. Your data stays on your machine.</p>
	</article>
</section>

<style>
	.setup-banner {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		max-width: 1000px;
		margin: 1rem auto 0;
		padding: 0.55rem 1rem;
		background: var(--baize-raised);
		border: 1px solid var(--walnut);
		border-radius: 8px;
	}
	.setup-banner p {
		margin: 0;
		color: var(--parchment);
		font-size: 14px;
	}
	.setup-banner a {
		color: var(--amber);
		font-weight: 600;
	}
	.setup-banner button {
		background: transparent;
		border: 1px solid var(--walnut);
		border-radius: 6px;
		color: var(--parchment);
		padding: 0.25rem 0.6rem;
		cursor: pointer;
		font-size: 12px;
	}
	.setup-banner button:hover {
		border-color: var(--amber);
		color: var(--amber);
	}
	.hero {
		display: grid;
		grid-template-columns: minmax(280px, 480px) 1fr;
		gap: 2.5rem;
		align-items: center;
		max-width: 1000px;
		margin: 3rem auto 0;
		padding: 0 1rem;
	}
	/* The board inside is width:100%, so the stack must not size to max-content
	   (circular with a percentage --board-size) or the hero board collapses to 0. */
	.hero-board :global(.board-stack) {
		width: 100%;
	}
	.copy h1 {
		font-family: 'Marcellus', serif;
		color: var(--parchment);
		font-size: clamp(30px, 5vw, 44px);
		margin: 0 0 1rem;
	}
	.copy p {
		color: var(--parchment);
		font-size: 16px;
		line-height: 1.55;
	}
	.cta {
		display: flex;
		gap: 0.75rem;
		margin-top: 1.5rem;
	}
	.cta a {
		text-decoration: none;
		padding: 0.6rem 1.3rem;
		border-radius: 8px;
		font-weight: 600;
		font-size: 15px;
	}
	.primary {
		background: var(--amber);
		color: var(--on-primary);
	}
	.secondary {
		border: 1px solid var(--walnut);
		color: var(--parchment);
	}
	/* Two-by-two so no card ever dangles alone under an odd column count. */
	.features {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 1rem;
		max-width: 1000px;
		margin: 3rem auto 0;
		padding: 0 1rem 2.5rem;
	}
	.features article {
		background: var(--baize-raised);
		border: 1px solid color-mix(in srgb, var(--walnut) 50%, transparent);
		border-radius: 10px;
		padding: 1rem;
	}
	.features h3 {
		color: var(--parchment);
		font-size: 15px;
		margin: 0 0 0.4rem;
	}
	.features p {
		color: color-mix(in srgb, var(--parchment) 75%, transparent);
		font-size: 13px;
		line-height: 1.5;
		margin: 0;
	}
	a:focus-visible {
		outline: 2px solid var(--amber);
		outline-offset: 2px;
	}
	@media (max-width: 800px) {
		.hero {
			grid-template-columns: 1fr;
			text-align: center;
		}
		.cta {
			justify-content: center;
		}
	}
	@media (max-width: 640px) {
		.features {
			grid-template-columns: 1fr;
		}
	}
</style>
