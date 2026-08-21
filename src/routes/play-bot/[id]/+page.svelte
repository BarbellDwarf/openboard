<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { page } from '$app/state';

	import Board from '$lib/components/board/Board.svelte';
	import ChatPanel from '$lib/components/chat/ChatPanel.svelte';
	import { gameChannel, getSocket } from '$lib/client/socket';
	import { chooseBotMove } from '$lib/client/bot/search';
	import type { DestMap } from '$lib/server/chess/types';

	type JoinResponse = {
		ok: boolean;
		game?: { variant?: string } | null;
		state?: { xfen?: unknown; dests?: DestMap } | null;
		sanMoves?: string[];
		clock?: unknown;
	};

	const gameId = $derived(page.params.id as string);
	const urlLevel = Number(page.url.searchParams.get('level') ?? 2);

	let info = $state<{
		variant?: string;
		status?: string;
		whiteId?: string | null;
		blackId?: string | null;
		yourColor?: 'white' | 'black' | null;
	} | null>(null);
	let xfen = $state('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
	let dests = $state<DestMap>({});
	let sanMoves = $state<string[]>([]);
	let lastMove = $state<[string, string] | null>(null);
	let checkSquare = $state<string | null>(null);
	let botThinking = $state(false);
	let unsub: Array<() => void> = [];

	function findKing(fen: string): string | null {
		const target = fen.split(' ')[1] === 'w' ? 'K' : 'k';
		const rows = fen.split(' ')[0].split('/');
		for (let i = 0; i < rows.length; i++) {
			let file = 0;
			for (const ch of rows[i]) {
				if (/\d/.test(ch)) {
					file += Number(ch);
					continue;
				}
				if (ch === target) return String.fromCharCode(97 + file) + String(8 - i);
				file += 1;
			}
		}
		return null;
	}

	function applyState(payload: {
		uci?: string;
		san?: string;
		state?: { xfen: string; dests: DestMap; inCheck: boolean };
	}): void {
		if (payload.uci && payload.san) {
			lastMove = [payload.uci.slice(0, 2), payload.uci.slice(2, 4)];
			sanMoves = [...sanMoves, payload.san];
		}
		if (payload.state) {
			xfen = payload.state.xfen;
			dests = payload.state.dests;
			checkSquare = payload.state.inCheck ? findKing(xfen) : null;
		}
	}

	async function onMove(uci: string): Promise<void> {
		await gameChannel.move(gameId, uci);
	}

	async function maybeBotReply(): Promise<void> {
		const turn = xfen.split(' ')[1];
		const seatEmpty = info?.whiteId === null || info?.blackId === null;
		if (!seatEmpty || !info) return;
		botThinking = true;
		const [uci] = await Promise.all([
			new Promise<string | null>((resolvePromise) => {
				setTimeout(
					() => resolvePromise(chooseBotMove(info?.variant ?? 'standard', xfen, urlLevel)),
					50
				);
			}),
			new Promise((r) => setTimeout(r, 400 + Math.random() * 800))
		]);
		botThinking = false;
		const stillTheirTurn =
			(turn === 'w' && info.whiteId === null) || (turn === 'b' && info.blackId === null);
		if (uci && stillTheirTurn) await gameChannel.move(gameId, uci);
	}

	onMount(() => {
		void (async () => {
			const join: JoinResponse = await gameChannel.join(gameId);
			if (!join.ok || !join.state) return;
			info = join.game ?? null;
			applyState({ state: join.state as { xfen: string; dests: DestMap; inCheck: boolean } });
			sanMoves = join.sanMoves ?? [];

			const socket = await getSocket();
			const onMoved = (p: unknown) => {
				const payload = p as Parameters<typeof applyState>[0] & {
					gameId?: string;
					clock?: unknown;
				};
				applyState(payload);
				void maybeBotReply();
			};
			socket.on('game:moved', onMoved);
			unsub.push(() => socket.off('game:moved', onMoved));
			void maybeBotReply();
		})();
	});

	onDestroy(() => {
		for (const off of unsub) off();
	});
</script>

<svelte:head><title>Play a bot - OpenBoard</title></svelte:head>

<main class="bot-page">
	<div class="board-column">
		<p class="muted">
			Level {urlLevel} bot. You move both sides' pieces through the server; the bot answers empty seats.
		</p>
		<Board
			{xfen}
			{dests}
			{lastMove}
			{checkSquare}
			interactive
			anyColor
			orientation="white"
			onMove={(uci) => void onMove(uci)}
		/>
	</div>
	<aside class="rail">
		<h2>Moves</h2>
		<ol class="mono">
			{#each sanMoves as san, i (i)}
				<li><span class="plyno">{Math.floor(i / 2) + 1}{i % 2 === 0 ? '.' : ''}</span> {san}</li>
			{/each}
		</ol>
		{#if botThinking}<p class="thinking">Bot is thinking...</p>{/if}
		<h2>Chat</h2>
		<ChatPanel {gameId} />
	</aside>
</main>

<style>
	.bot-page {
		display: grid;
		grid-template-columns: minmax(300px, 560px) minmax(260px, 340px);
		gap: 1.25rem;
		justify-content: center;
		padding: 1.25rem;
	}
	.muted {
		color: color-mix(in srgb, var(--parchment) 65%, transparent);
		font-size: 13px;
	}
	h2 {
		color: var(--parchment);
		font-size: 16px;
		margin: 0 0 0.5rem;
	}
	.rail {
		background: var(--baize-raised);
		border: 1px solid var(--walnut);
		border-radius: 8px;
		padding: 0.9rem;
		max-height: calc(100vh - 140px);
		overflow-y: auto;
	}
	.scoresheet,
	ol {
		list-style: none;
		margin: 0 0 0.75rem;
		padding: 0;
		columns: 2 auto;
		color: var(--parchment);
		font-size: 13px;
	}
	.plyno {
		color: var(--walnut);
	}
	.thinking {
		color: var(--amber);
		font-size: 13px;
	}
	@media (max-width: 800px) {
		.bot-page {
			grid-template-columns: 1fr;
		}
	}
</style>
