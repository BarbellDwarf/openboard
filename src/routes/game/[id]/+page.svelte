<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import Board from '$lib/components/board/Board.svelte';
	import ChatPanel from '$lib/components/chat/ChatPanel.svelte';
	import { gameChannel, getSocket, type JoinResponse } from '$lib/client/socket';
	import type { DestMap } from '$lib/server/chess/types';

	const gameId = $derived(page.params.id as string);

	interface GameInfo {
		id: string;
		variant: string;
		rated: boolean;
		status: 'created' | 'started' | 'finished' | 'aborted';
		result: string | null;
		termination: string | null;
		timeControl: {
			initialMs: number | null;
			incrementMs: number | null;
			daysPerMove: number | null;
		};
		whiteId: string | null;
		blackId: string | null;
		yourColor: 'white' | 'black' | null;
	}

	let info = $state<GameInfo | null>(null);
	let xfen = $state('');
	let dests = $state<DestMap>({});
	let sanMoves = $state<string[]>([]);
	let lastMove = $state<[string, string] | null>(null);
	let checkSquare = $state<string | null>(null);
	let clock = $state<{ whiteMs: number; blackMs: number; ticking: string | null } | null>(null);
	/** When `clock` was received; the ticking side drains from this moment. */
	let clockAt = $state<number>(Date.now());
	/** Ticking value for dial text, recomputed on every ticker tick. */
	let nowMs = $state<number>(Date.now());
	let deadline = $state<number | null>(null);
	let incomingDrawForYou = $state(false);
	let over = $state<{ result: string; termination: string } | null>(null);
	let rematchReadyTo = $state<string | null>(null);
	let loadError = $state(false);

	let socketUnsub: Array<() => void> = [];
	let ticker: ReturnType<typeof setInterval> | null = null;

	const yourColor = $derived(info?.yourColor ?? null);
	const isSpectator = $derived(!yourColor);
	const yourTurn = $derived(
		info?.status === 'started' &&
			yourColor !== null &&
			xfen.split(' ')[1]?.[0] === (yourColor === 'white' ? 'w' : 'b')
	);
	const orientation = $derived(yourColor ?? 'white');

	// Live countdown between server broadcasts.
	function startTicker(): void {
		if (ticker) return;
		ticker = setInterval(() => {
			nowMs = Date.now();
		}, 500);
	}

	/** Remaining time for one side, draining locally between server updates. */
	function liveMs(side: 'white' | 'black'): number {
		if (!clock) return 0;
		const base = side === 'white' ? clock.whiteMs : clock.blackMs;
		if (clock.ticking !== side) return base;
		return Math.max(0, base - (nowMs - clockAt));
	}

	function fmtClock(ms: number): string {
		const total = Math.ceil(ms / 1000);
		const m = Math.floor(total / 60);
		const s = total % 60;
		return `${m}:${String(s).padStart(2, '0')}`;
	}

	function terminationText(t: string): string {
		return (
			{
				checkmate: 'Checkmate',
				stalemate: 'Stalemate',
				resignation: 'Resignation',
				timeout: 'Flag fell',
				agreement: 'Draw agreed',
				repetition: 'Threefold repetition',
				'fifty-moves': 'Fifty-move rule',
				insufficient: 'Insufficient material',
				kingofthehill: 'King reached the hill',
				threecheck: 'Third check given',
				'atomic-king-death': 'King exploded',
				'horde-wiped': 'Horde destroyed',
				'racingkings-finish': 'Race finished'
			}[t] ?? t
		);
	}

	async function applyServerMove(payload: Record<string, unknown>): Promise<void> {
		sanMoves = [...sanMoves, String(payload.san)];
		lastMove = [String(payload.uci).slice(0, 2), String(payload.uci).slice(2, 4)];
		const st = payload.state as Record<string, unknown>;
		xfen = String(st.xfen);
		dests = st.dests as DestMap;
		checkSquare = st.inCheck ? findKing(st.xfen as string) : null;
		if (payload.clock) {
			clock = payload.clock as typeof clock;
			clockAt = Date.now();
		}
		if (payload.deadline) deadline = Number(payload.deadline);
	}

	function findKing(fen: string): string | null {
		const turn = fen.split(' ')[1];
		const target = turn === 'w' ? 'K' : 'k';
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

	onMount(() => {
		void (async () => {
			const join = await Promise.race([
				gameChannel.join(gameId),
				new Promise<JoinResponse>((r) => setTimeout(() => r({ ok: false }), 5000))
			]);
			if (!join.ok || !join.game || !join.state) {
				loadError = true;
				return;
			}
			info = join.game as unknown as GameInfo;
			if (info.status === 'finished' && info.result) {
				over = { result: String(info.result), termination: String(info.termination ?? '') };
			}
			xfen = String(join.state.xfen);
			dests = (join.state.dests as DestMap) ?? {};
			sanMoves = join.sanMoves ?? [];
			clock = join.clock ?? null;
			clockAt = Date.now();
			deadline = join.deadline ?? null;
			startTicker();

			const socket = await getSocket();
			const onMoved = (p: unknown) => void applyServerMove(p as Record<string, unknown>);
			socket.on('game:moved', onMoved);
			socket.on('game:over', (p: { result: string; termination: string }) => {
				over = p;
				if (info) {
					info.status = 'finished';
					info.result = p.result;
					info.termination = p.termination;
				}
			});
			socket.on('game:draw-offered', (p: { by: 'white' | 'black' }) => {
				incomingDrawForYou = !!yourColor && p.by !== yourColor;
			});
			socket.on('game:draw-declined', () => {
				incomingDrawForYou = false;
			});
			socket.on('game:rematch-offered', () => {});
			socket.on('game:rematch-ready', (p: { gameId: string }) => {
				rematchReadyTo = p.gameId;
			});
			socketUnsub = [
				() => socket.off('game:moved', onMoved),
				() => socket.off('game:over'),
				() => socket.off('game:draw-offered'),
				() => socket.off('game:draw-declined'),
				() => socket.off('game:rematch-ready')
			];
		})();
	});

	onDestroy(() => {
		for (const off of socketUnsub) off();
		if (ticker) clearInterval(ticker);
	});

	async function onMove(uci: string): Promise<void> {
		await gameChannel.move(gameId, uci);
	}

	const announcement = $derived.by(() => {
		if (sanMoves.length === 0) return '';
		const n = sanMoves.length;
		const num = Math.ceil(n / 2);
		return `${num}. ${sanMoves[n - 1]}`;
	});
</script>

<svelte:head><title>Game - OpenBoard</title></svelte:head>

{#if loadError}
	<main class="center"><p class="muted">This game does not exist or you cannot see it.</p></main>
{:else if !info}
	<main class="center"><p class="muted">Loading game...</p></main>
{:else}
	<main class="game-page">
		<div class="board-column">
			<div class="nameplate" class:active={xfen.split(' ')[1]?.startsWith('b')}>
				<span class="player">{info.blackId ? 'Black' : 'Open seat'}</span>
				<span
					class="dial mono"
					class:low={(clock?.blackMs ?? 99999999) < 10000}
					class:ticking={clock?.ticking === 'black'}
					style={clock && info.timeControl.initialMs != null ? '' : 'display:none'}
					aria-label="Black clock"
				>
					{clock ? fmtClock(liveMs('black')) : '-'}
				</span>
			</div>

			<Board
				{xfen}
				{dests}
				{lastMove}
				{checkSquare}
				{orientation}
				interactive={!!yourTurn}
				onMove={(uci) => void onMove(uci)}
			/>

			<div class="nameplate" class:active={xfen.split(' ')[1]?.startsWith('w')}>
				<span class="player">White</span>
				<span
					class="dial mono"
					class:low={(clock?.whiteMs ?? 99999999) < 10000}
					class:ticking={clock?.ticking === 'white'}
					style={clock && info.timeControl.initialMs != null ? '' : 'display:none'}
					aria-label="White clock"
				>
					{clock ? fmtClock(liveMs('white')) : '-'}
				</span>
			</div>

			{#if deadline && info.status === 'started'}
				<p class="mono muted">
					Move due by {new Date(deadline).toLocaleString()}
				</p>
			{/if}
		</div>

		<aside class="rail" aria-label="Moves and controls">
			<h2>Moves</h2>
			<ol class="scoresheet mono" aria-label="Move list">
				{#each sanMoves as san, i (i)}
					<li><span class="plyno">{Math.floor(i / 2) + 1}{i % 2 === 0 ? '.' : ''}</span> {san}</li>
				{/each}
			</ol>

			<div class="controls">
				{#if info.status === 'started' && !isSpectator}
					<button type="button" onclick={() => gameChannel.resign(gameId)}>Resign</button>
					{#if incomingDrawForYou}
						<button type="button" class="primary" onclick={() => gameChannel.acceptDraw(gameId)}
							>Accept draw</button
						>
						<button type="button" onclick={() => gameChannel.declineDraw(gameId)}>Decline</button>
					{:else}
						<button type="button" onclick={() => gameChannel.offerDraw(gameId)}>Offer draw</button>
					{/if}
				{/if}
				{#if over}
					<div class="result" role="status">
						<p class="verdict">
							{over.result === 'draw'
								? 'Draw'
								: `${over.result === 'white' ? 'White' : 'Black'} wins`}
						</p>
						<p class="term">{terminationText(String(over.termination))}</p>
						{#if rematchReadyTo}
							<a href={resolve(`/game/${rematchReadyTo}`)} class="primary button-link"
								>Go to rematch</a
							>
						{:else if !isSpectator && yourColor}
							<button
								type="button"
								class="primary"
								onclick={() => gameChannel.offerRematch(gameId, yourColor)}
							>
								Offer rematch
							</button>
							<button type="button" onclick={() => gameChannel.acceptRematch(gameId, yourColor)}>
								Accept rematch
							</button>
						{/if}
					</div>
				{/if}
			</div>

			<h2>Chat</h2>
			<ChatPanel {gameId} />
			<p class="sr-only" role="status" aria-live="polite">{announcement}</p>
			{#if isSpectator && info.status === 'started'}
				<p class="muted spectator-note">You are watching this game.</p>
			{/if}
		</aside>
	</main>
{/if}

<style>
	.game-page {
		display: grid;
		grid-template-columns: minmax(300px, 560px) minmax(260px, 340px);
		gap: 1.25rem;
		justify-content: center;
		padding: 1.25rem;
	}
	.center {
		display: grid;
		place-items: center;
		min-height: 40vh;
	}
	.muted {
		color: color-mix(in srgb, var(--parchment) 65%, transparent);
	}
	.board-column {
		align-self: start;
	}
	.nameplate {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.45rem 0.7rem;
		margin: 0.3rem 0;
		background: var(--baize-raised);
		border: 1px solid var(--walnut);
		border-radius: 8px;
		color: var(--parchment);
		font-size: 14px;
	}
	.nameplate.active {
		border-color: var(--amber);
		box-shadow: inset 0 0 0 1px var(--amber);
	}
	.dial {
		font-size: 16px;
		background: rgb(0 0 0 / 30%);
		padding: 0.15rem 0.55rem;
		border-radius: 6px;
	}
	.dial.ticking {
		color: var(--amber);
	}
	.dial.low {
		color: var(--flag-red);
		animation: pulse 1s infinite;
	}
	@keyframes pulse {
		50% {
			opacity: 0.6;
		}
	}
	.rail {
		background: var(--baize-raised);
		border: 1px solid var(--walnut);
		border-radius: 8px;
		padding: 0.9rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		max-height: calc(100vh - 140px);
	}
	h2 {
		font-family: 'Marcellus', serif;
		color: var(--parchment);
		font-size: 18px;
		margin: 0;
	}
	.scoresheet {
		list-style: none;
		margin: 0;
		padding: 0;
		overflow-y: auto;
		flex: 1;
		font-size: 13px;
		color: var(--parchment);
		columns: 2 auto;
		column-gap: 1rem;
	}
	.scoresheet li {
		break-inside: avoid;
		padding: 0.1rem 0;
	}
	.plyno {
		color: var(--walnut);
	}
	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	button,
	.button-link {
		flex: 1 1 45%;
		padding: 0.45rem;
		border-radius: 6px;
		border: 1px solid var(--walnut);
		background: transparent;
		color: var(--parchment);
		cursor: pointer;
		font-size: 13px;
		text-decoration: none;
		text-align: center;
	}
	button.primary,
	.button-link.primary {
		background: var(--amber);
		border-color: var(--amber);
		color: #211b10;
		font-weight: 600;
	}
	button:hover,
	.button-link:hover {
		border-color: var(--amber);
	}
	.result {
		width: 100%;
		border-top: 1px solid var(--walnut);
		padding-top: 0.75rem;
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.verdict {
		width: 100%;
		margin: 0;
		font-family: 'Marcellus', serif;
		color: var(--amber);
		font-size: 20px;
	}
	.term {
		width: 100%;
		margin: 0 0 0.25rem;
		color: var(--parchment);
		font-size: 13px;
	}
	.spectator-note {
		font-size: 12px;
	}
	@media (max-width: 800px) {
		.game-page {
			grid-template-columns: 1fr;
		}
		.rail {
			max-height: none;
		}
	}
	button:focus-visible,
	.button-link:focus-visible,
	a:focus-visible {
		outline: 2px solid var(--amber);
		outline-offset: 2px;
	}
</style>
