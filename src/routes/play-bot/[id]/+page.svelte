<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	import Board from '$lib/components/board/Board.svelte';
	import ChatPanel from '$lib/components/chat/ChatPanel.svelte';
	import ClockBar from '$lib/components/game/ClockBar.svelte';
	import { isDropUci } from '$lib/components/board/pockets';
	import type { ClockView, Side } from '$lib/components/game/clockDisplay';
	import { gameChannel, getSocket } from '$lib/client/socket';
	import { terminationPhrase } from '$lib/client/terminations';
	import type { DestMap } from '$lib/server/chess/types';

	type JoinResponse = {
		ok: boolean;
		game?: {
			variant?: string;
			status?: string;
			result?: string | null;
			termination?: string | null;
			whiteId?: string | null;
			blackId?: string | null;
			yourColor?: 'white' | 'black' | null;
			timeControl?: {
				initialMs: number | null;
				incrementMs: number | null;
				daysPerMove: number | null;
			};
		} | null;
		state?: { xfen?: unknown; dests?: DestMap } | null;
		sanMoves?: string[];
		clock?: unknown;
	};

	const gameId = $derived(page.params.id as string);
	const urlLevel = Number(page.url.searchParams.get('level') ?? 2);

	let info = $state<{
		variant?: string;
		status?: string;
		result?: string | null;
		termination?: string | null;
		whiteId?: string | null;
		blackId?: string | null;
		yourColor?: 'white' | 'black' | null;
		timeControl?: {
			initialMs: number | null;
			incrementMs: number | null;
			daysPerMove: number | null;
		};
	} | null>(null);
	let xfen = $state('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
	let dests = $state<DestMap>({});
	/** Pocket holdings for crazyhouse games; null otherwise. */
	let pockets = $state<Record<string, number> | null>(null);
	let sanMoves = $state<string[]>([]);
	let lastMove = $state<[string, string] | null>(null);
	let checkSquare = $state<string | null>(null);
	let botThinking = $state(false);
	let over = $state<{ result: string; termination: string } | null>(null);
	let orientation = $state<'white' | 'black'>('white');
	/** Latest server clock snapshot; null while untimed or after release on finish. */
	let clock = $state<ClockView | null>(null);
	/** When `clock` was received; the ticking side drains from this moment. */
	let clockAt = $state(Date.now());
	/** Transient, non-blocking notice when a move fails or times out. */
	let moveError = $state<string | null>(null);
	let unsub: Array<() => void> = [];
	let moveErrorTimer: ReturnType<typeof setTimeout> | null = null;

	const timed = $derived(info?.timeControl?.initialMs != null);
	const sideToMove = $derived.by(() => {
		const turn = xfen.split(' ')[1];
		return turn?.startsWith('w') ? 'white' : turn?.startsWith('b') ? 'black' : null;
	});

	/**
	 * Nameplate labels. The empty seat is the house bot's seat on this page,
	 * but the solo override lets the seated human drive it too; either way the
	 * bar keys everything by seat color and shows that seat's clock.
	 */
	function seatName(side: Side): string {
		const botSeat: Side | null =
			info?.whiteId === null ? 'white' : info?.blackId === null ? 'black' : null;
		if (side === botSeat) return `Level ${urlLevel + 1} bot`;
		if (info?.yourColor === side) return 'You';
		return side === 'white' ? 'White' : 'Black';
	}

	const overText = $derived.by(() => {
		if (!over) return '';
		if (over.termination === 'timeout' && over.result !== 'draw') {
			// The broadcast names the winner; the flagged seat is the other one.
			const flagged = over.result === 'white' ? 'black' : 'white';
			if (info?.yourColor) {
				return info.yourColor === flagged ? 'You lost on time.' : 'You won on time.';
			}
			return `${flagged === 'white' ? 'White' : 'Black'} ran out of time.`;
		}
		const how = terminationPhrase(over.termination);
		return over.result === 'draw'
			? `Drawn by ${how}.`
			: `${over.result === 'white' ? 'White' : 'Black'} won by ${how}.`;
	});

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
		state?: { xfen: string; dests: DestMap; inCheck: boolean; pockets?: Record<string, number> };
	}): void {
		if (payload.uci && payload.san) {
			lastMove = isDropUci(payload.uci)
				? [payload.uci.slice(2, 4), payload.uci.slice(2, 4)]
				: [payload.uci.slice(0, 2), payload.uci.slice(2, 4)];
			sanMoves = [...sanMoves, payload.san];
		}
		if (payload.state) {
			xfen = payload.state.xfen;
			dests = payload.state.dests;
			pockets = payload.state.pockets ?? null;
			checkSquare = payload.state.inCheck ? findKing(xfen) : null;
		}
	}

	function showMoveError(message: string): void {
		moveError = message;
		if (moveErrorTimer) clearTimeout(moveErrorTimer);
		moveErrorTimer = setTimeout(() => (moveError = null), 4000);
	}

	async function onMove(uci: string): Promise<void> {
		moveError = null;
		try {
			const res = await gameChannel.move(gameId, uci);
			if (!res.ok) {
				showMoveError(
					res.reason === 'not-your-turn' ? 'It is not your turn.' : 'The server rejected that move.'
				);
			}
		} catch {
			showMoveError('That move did not reach the server. You can try again.');
		}
	}

	/**
	 * The bot lives on the server, so the page only mirrors its state: the
	 * indicator shows while the empty seat is to move in a running game.
	 * Leaving the page changes nothing; the server plays regardless.
	 */
	function syncThinking(): void {
		const turn = xfen.split(' ')[1];
		const emptySeat = info?.whiteId === null ? 'w' : info?.blackId === null ? 'b' : null;
		botThinking = !over && info?.status === 'started' && emptySeat !== null && turn === emptySeat;
	}

	async function playAgain(): Promise<void> {
		const variant = info?.variant ?? 'standard';
		const res = await fetch('/api/challenges', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				action: 'create-solo',
				variant,
				speedClass: 'blitz',
				colorChoice: 'random',
				level: urlLevel
			})
		});
		const body = await res.json();
		if (body.gameId) window.location.href = `/play-bot/${body.gameId}?level=${urlLevel}`;
	}

	onMount(() => {
		void (async () => {
			const socket = await getSocket();
			const onMoved = (p: unknown) => {
				const payload = p as Parameters<typeof applyState>[0] & {
					gameId?: string;
					clock?: unknown;
				};
				applyState(payload);
				if (payload.clock) {
					clock = payload.clock as ClockView;
					clockAt = Date.now();
				}
				syncThinking();
			};
			const onOver = (p: unknown) => {
				const payload = p as { result?: string; termination?: string };
				over = {
					result: String(payload.result ?? 'draw'),
					termination: String(payload.termination ?? '')
				};
				clock = null;
				botThinking = false;
			};

			socket.on('game:moved', onMoved);
			socket.on('game:over', onOver);
			unsub.push(() => socket.off('game:moved', onMoved));
			unsub.push(() => socket.off('game:over', onOver));

			// Room membership dies with the server-side socket, so every connect
			// event (first one included) re-joins and refreshes from the
			// authoritative payload. The in-flight guard collapses the cold-load
			// overlap between the kick-off below and the first 'connect'.
			let syncing = false;
			const syncFromServer = async (): Promise<void> => {
				if (syncing) return;
				syncing = true;
				try {
					const join: JoinResponse = await gameChannel.join(gameId);
					if (!join.ok || !join.state) return;
					info = join.game ?? null;
					orientation = info?.yourColor === 'black' ? 'black' : 'white';
					// Re-sync on every reconnect: the join ack is the authoritative
					// clock snapshot, so draining restarts from it without drift.
					clock = (join.clock as ClockView | null) ?? null;
					clockAt = Date.now();
					if (info?.status === 'finished') {
						over = {
							result: String(info.result ?? 'draw'),
							termination: String(info.termination ?? '')
						};
					}
					applyState({
						state: join.state as {
							xfen: string;
							dests: DestMap;
							inCheck: boolean;
							pockets?: Record<string, number>;
						}
					});
					sanMoves = join.sanMoves ?? [];
					syncThinking();
				} catch {
					// Join failed or timed out; the next connect event retries it.
				} finally {
					syncing = false;
				}
			};
			const onConnect = (): void => {
				void syncFromServer();
			};
			socket.on('connect', onConnect);
			unsub.push(() => socket.off('connect', onConnect));

			void syncFromServer();
		})();
	});

	onDestroy(() => {
		for (const off of unsub) off();
		if (moveErrorTimer) clearTimeout(moveErrorTimer);
	});
</script>

<svelte:head><title>Play a bot - OpenBoard</title></svelte:head>

<main class="bot-page">
	<div class="board-column">
		<p class="muted">
			Level {urlLevel + 1} bot, played by the server. It keeps moving even if you close this page.
		</p>
		{#if over}
			<p class="over" role="status">{overText}</p>
		{/if}
		{#if moveError}
			<p class="move-error" role="alert">{moveError}</p>
		{/if}
		{#if timed}
			<!-- Opponent bar above, your bar below — standard game layout. -->
			<ClockBar
				{clock}
				{clockAt}
				timed
				turn={sideToMove}
				side={orientation === 'white' ? 'black' : 'white'}
				name={seatName(orientation === 'white' ? 'black' : 'white')}
				announceLow
			/>
		{/if}
		<Board
			{xfen}
			{dests}
			{lastMove}
			{checkSquare}
			interactive
			anyColor
			{orientation}
			variant={info?.variant}
			{pockets}
			onMove={(uci) => void onMove(uci)}
		/>
		{#if timed}
			<ClockBar
				{clock}
				{clockAt}
				timed
				turn={sideToMove}
				side={orientation}
				name={seatName(orientation)}
			/>
		{/if}
	</div>
	<aside class="rail">
		<h2>Moves</h2>
		<ol class="mono">
			{#each sanMoves as san, i (i)}
				<li><span class="plyno">{Math.floor(i / 2) + 1}{i % 2 === 0 ? '.' : ''}</span> {san}</li>
			{/each}
		</ol>
		{#if botThinking}<p class="thinking">Bot is thinking...</p>{/if}
		{#if !over}
			<button type="button" class="danger" onclick={() => void gameChannel.resign(gameId)}>
				Resign
			</button>
		{:else}
			<button type="button" class="primary" onclick={() => void playAgain()}> Play again </button>
			<a class="again" href="/play-bot">New settings</a>
		{/if}
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
	.over {
		color: var(--amber);
		font-weight: 600;
		margin: 0 0 0.5rem;
	}
	.move-error {
		color: var(--flag-red);
		font-size: 13px;
		margin: 0.25rem 0 0.5rem;
	}
	button.danger {
		padding: 0.45rem 0.9rem;
		border-radius: 8px;
		border: 1px solid var(--flag-red);
		background: transparent;
		color: var(--flag-red);
		cursor: pointer;
		font-size: 13px;
	}
	a.again {
		display: inline-block;
		padding: 0.45rem 0.9rem;
		border-radius: 8px;
		background: var(--amber);
		color: var(--on-primary);
		text-decoration: none;
		font-size: 13px;
		font-weight: 600;
	}
	@media (max-width: 800px) {
		.bot-page {
			grid-template-columns: 1fr;
		}
		/* Full-bleed square: the piece area tracks the padded column, so the
		   coordinate labels never clip at the viewport edge. */
		.board-column {
			--board-size: min(calc(100vw - 2.5rem), 560px);
		}
		button.danger,
		a.again {
			display: inline-flex;
			align-items: center;
			min-height: 44px;
			font-size: 14px;
		}
	}
</style>
