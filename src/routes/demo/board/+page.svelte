<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import Board from '$lib/components/board/Board.svelte';
	import type { VariantId } from '$lib/server/chess/types';

	const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

	const urlVariant = (page.url.searchParams.get('variant') ?? 'standard') as VariantId;
	let xfen = $state(page.url.searchParams.get('fen') ?? START);
	let dests = $state<Record<string, string[]>>({});
	let lastMove = $state<[string, string] | null>(null);
	let checkSquare = $state<string | null>(null);
	// eslint-disable-next-line @typescript-eslint/no-unused-vars -- drives checkSquare updates

	async function post(uci?: string): Promise<void> {
		const res = await fetch('/api/demo/move', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ xfen, uci, variant: urlVariant })
		});
		if (!res.ok) return;
		const data = (await res.json()) as {
			xfen: string;
			dests: Record<string, string[]>;
			inCheck: boolean;
		};
		if (uci) lastMove = [uci.slice(0, 2), uci.slice(2, 4)];
		xfen = data.xfen;
		dests = data.dests;
		checkSquare = data.inCheck
			? xfen.split(' ')[1] === 'w'
				? findKing('w')
				: findKing('b')
			: null;
	}

	function findKing(color: string): string | null {
		const rows = xfen.split(' ')[0].split('/');
		for (let i = 0; i < rows.length; i++) {
			let file = 0;
			for (const ch of rows[i]) {
				if (/\d/.test(ch)) {
					file += Number(ch);
					continue;
				}
				const isWhite = ch === ch.toUpperCase();
				if (ch.toLowerCase() === 'k' && (color === 'w') === isWhite) {
					return String.fromCharCode(97 + file) + String(8 - i);
				}
				file += 1;
			}
		}
		return null;
	}

	onMount(() => {
		void post();
	});
</script>

<svelte:head><title>Board demo - OpenBoard</title></svelte:head>

<main class="demo">
	<h1>Board demo</h1>
	<Board {xfen} {dests} {lastMove} {checkSquare} interactive onMove={(uci) => void post(uci)} />
</main>

<style>
	.demo {
		display: grid;
		place-items: center;
		gap: 1rem;
		padding: 2rem 1rem;
	}
	h1 {
		font-family: 'Marcellus', serif;
		color: var(--parchment);
	}
	/* On phones the board tracks the viewport minus the demo padding, so
	   squares and coordinates never spill past the edge. */
	@media (max-width: 640px) {
		.demo {
			--board-size: calc(100vw - 2rem);
			padding: 1.5rem 1rem;
		}
	}
</style>
