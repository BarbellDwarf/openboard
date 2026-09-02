<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';

	import Board from '$lib/components/board/Board.svelte';

	const demo = $state({
		xfen: '',
		dests: {} as Record<string, string[]>,
		last: null as [string, string] | null
	});

	onMount(() => {
		void (async () => {
			const res = await fetch('/api/demo/move', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ xfen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1' })
			});
			if (res.ok) {
				const d = await res.json();
				demo.xfen = d.xfen;
				demo.dests = d.dests;
			}
		})();
	});

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
		const id = setInterval(() => {
			if (scriptIndex >= scriptMoves.length) {
				scriptIndex = 0;
				void step('e1e2').then(() => step('e8e7'));
				return;
			}
			void step(scriptMoves[scriptIndex]);
			scriptIndex++;
		}, 1600);
		return () => clearInterval(id);
	});
</script>

<svelte:head><title>OpenBoard - play chess your way</title></svelte:head>

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
	.hero {
		display: grid;
		grid-template-columns: minmax(280px, 480px) 1fr;
		gap: 2.5rem;
		align-items: center;
		max-width: 1000px;
		margin: 3rem auto 0;
		padding: 0 1rem;
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
		color: #211b10;
	}
	.secondary {
		border: 1px solid var(--walnut);
		color: var(--parchment);
	}
	.features {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1rem;
		max-width: 1000px;
		margin: 3.5rem auto;
		padding: 0 1rem;
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
</style>
