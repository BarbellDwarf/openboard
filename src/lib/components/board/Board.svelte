<script lang="ts">
	/* eslint-disable svelte/prefer-svelte-reactivity -- maps here feed chessground config, not templates */
	import '@lichess-org/chessground/assets/chessground.base.css';
	import '@lichess-org/chessground/assets/chessground.cburnett.css';
	import { onMount } from 'svelte';
	import { Chessground } from '@lichess-org/chessground';
	import type { Api } from '@lichess-org/chessground/api';
	import type { Config } from '@lichess-org/chessground/config';
	import type { Key, Role } from '@lichess-org/chessground/types';

	import type { DestMap } from '$lib/server/chess/types';

	import Pocket from './Pocket.svelte';
	import { dropUci, pocketCountsFor, roleName, splitDropDests, type PocketLetter } from './pockets';

	interface Props {
		xfen: string;
		dests?: DestMap;
		orientation?: 'white' | 'black';
		lastMove?: [string, string] | null;
		checkSquare?: string | null;
		interactive?: boolean;
		anyColor?: boolean;
		coordinates?: boolean;
		animationMs?: number;
		boardTheme?: string;
		pieceSet?: string;
		variant?: string;
		/** Pocket holdings keyed 'wp'/'bq'-style; crazyhouse only. */
		pockets?: Record<string, number> | null;
		onMove?: (uci: string) => void;
	}

	let {
		xfen,
		dests = {},
		orientation = 'white',
		lastMove = null,
		checkSquare = null,
		interactive = false,
		anyColor = false,
		coordinates = true,
		animationMs = 180,
		boardTheme = 'vinyl',
		pieceSet = 'cburnett',
		variant,
		pockets = null,
		onMove
	}: Props = $props();

	let el: HTMLDivElement;
	let api = $state<Api | null>(null);

	const reducedMotion =
		typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	const ROLE_LETTERS: Record<Role, string> = {
		pawn: 'p',
		knight: 'n',
		bishop: 'b',
		rook: 'r',
		queen: 'q',
		king: 'k'
	};

	function toDests(d: DestMap): Map<Key, Key[]> {
		const map = new Map<Key, Key[]>();
		for (const [from, tos] of Object.entries(d)) {
			map.set(from as Key, tos as Key[]);
		}
		return map;
	}

	/**
	 * Dests arrive with drop entries under synthetic origins ('drop:p', ...).
	 * They never feed chessground's movable map (it is keyed by board squares);
	 * splitDropDests routes them into the pocket placement UI below.
	 */
	const split = $derived(splitDropDests(dests));
	const dropDests = $derived(split.dropDests);

	const isPocketVariant = $derived(variant === 'crazyhouse');
	const turnColor = $derived(xfen.split(' ')[1]?.startsWith('b') ? 'black' : 'white');

	const whitePocketCounts = $derived(pocketCountsFor(pockets, xfen, 'white'));
	const blackPocketCounts = $derived(pocketCountsFor(pockets, xfen, 'black'));

	let armedDrop: { color: 'white' | 'black'; letter: PocketLetter } | null = $state(null);

	function armDrop(color: 'white' | 'black', letter: PocketLetter): void {
		if (!interactive || turnColor !== color) return;
		if (!dropDests[letter]?.length) return;
		armedDrop =
			armedDrop && armedDrop.color === color && armedDrop.letter === letter
				? null
				: { color, letter };
	}

	function chooseDropTarget(square: string): void {
		if (!armedDrop) return;
		const { letter } = armedDrop;
		armedDrop = null;
		onMove?.(dropUci(letter, square));
	}

	// A fresh dests payload means the server state moved on; any armed placement
	// is stale by definition.
	$effect(() => {
		void split.dropDests;
		armedDrop = null;
	});

	function baseConfig(): Partial<Config> {
		return {
			fen: xfen,
			orientation,
			coordinates,
			animation: { enabled: !reducedMotion, duration: animationMs },
			movable: {
				free: false,
				color: interactive ? (anyColor ? 'both' : orientation) : undefined,
				dests: interactive ? toDests(split.boardDests) : new Map(),
				showDests: true,
				events: {
					after(orig: Key, dest: Key) {
						handleNormalMove(orig, dest);
					},
					afterNewPiece(role: Role, key: Key) {
						onMove?.(`${ROLE_LETTERS[role]}@${key}`);
					}
				}
			},
			premovable: { enabled: false },
			highlight: { lastMove: true, check: true },
			lastMove: (lastMove ?? undefined) as [Key, Key] | undefined,
			check: checkSquare ? true : undefined
		};
	}

	let pendingPromotion: { from: string; to: string } | null = $state(null);
	let promotionColor: 'white' | 'black' = $state('white');

	function handleNormalMove(orig: Key, dest: Key): void {
		const piece = api?.state.pieces.get(dest) ?? api?.state.pieces.get(orig);
		if (
			piece?.role === 'pawn' &&
			((piece.color === 'white' && dest[1] === '8') || (piece.color === 'black' && dest[1] === '1'))
		) {
			pendingPromotion = { from: orig, to: dest };
			promotionColor = piece.color;
			api?.set({ movable: { color: undefined } });
			return;
		}
		onMove?.(`${orig}${dest}`);
	}

	function choosePromotion(letter: string): void {
		if (!pendingPromotion) return;
		const { from, to } = pendingPromotion;
		pendingPromotion = null;
		onMove?.(`${from}${to}${letter}`);
	}

	function cancelPromotion(): void {
		pendingPromotion = null;
		if (api) api.set(baseConfig());
	}

	$effect(() => {
		void xfen;
		void dests;
		void orientation;
		void coordinates;
		void interactive;
		void lastMove;
		void checkSquare;
		api?.set({
			fen: xfen,
			orientation,
			coordinates,
			movable: {
				color: interactive ? (anyColor ? 'both' : orientation) : undefined,
				dests: interactive ? toDests(split.boardDests) : new Map()
			},
			lastMove: (lastMove ?? undefined) as [Key, Key] | undefined,
			check: checkSquare ? true : undefined
		});
	});

	// Keyboard navigation: arrows move a visual cursor, Enter selects or moves.
	let cursor = $state<Key | null>(null);

	function cursorShift(dx: number, dy: number): void {
		if (!cursor) {
			cursor = (orientation === 'white' ? 'e2' : 'e7') as Key;
			return;
		}
		const file = cursor.charCodeAt(0) - 97;
		const rank = Number(cursor[1]) - 1;
		const nf = Math.min(7, Math.max(0, file + dx));
		const nr = Math.min(7, Math.max(0, rank + dy));
		cursor = (String.fromCharCode(97 + nf) + String(nr + 1)) as Key;
	}

	function squarePosStyle(square: string): string {
		const file = square.charCodeAt(0) - 97;
		const rank = Number(square[1]) - 1;
		const x = orientation === 'white' ? file : 7 - file;
		const y = orientation === 'white' ? 7 - rank : rank;
		return `left:${x * 12.5}%;top:${y * 12.5}%`;
	}

	function cursorStyle(cursorKey: Key): string {
		return squarePosStyle(cursorKey);
	}

	function onKeydown(event: KeyboardEvent): void {
		if (!interactive) return;
		const arrows: Record<string, [number, number]> = {
			ArrowLeft: [-1, 0],
			ArrowRight: [1, 0],
			ArrowUp: [0, 1],
			ArrowDown: [0, -1]
		};
		if (arrows[event.key]) {
			event.preventDefault();
			const [dx, dy] = arrows[event.key];
			cursorShift(orientation === 'white' ? dx : -dx, dy);
			return;
		}
		if (event.key === 'Enter' && cursor) {
			event.preventDefault();
			const cur: Key = cursor;
			const isDest = Object.entries(split.boardDests).some(
				([from, tos]) => from === cur || tos.includes(cur)
			);
			if (cursor !== selected && split.boardDests[cursor as string]) {
				selected = cursor;
				api?.selectSquare(cursor ?? null, true);
			} else if (selected && isDest) {
				handleNormalMove(selected as Key, cursor as Key);
				selected = null;
				cursor = null;
			}
		}
		if (event.key === 'Escape') {
			selected = null;
			cursor = null;
			armedDrop = null;
			api?.cancelMove();
			cancelPromotion();
		}
	}

	let selected = $state<Key | null>(null);

	onMount(() => {
		api = Chessground(el, baseConfig());
		return () => {
			api?.destroy();
			api = null;
		};
	});
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape') armedDrop = null;
	}}
/>

<div class="board-stack">
	{#if isPocketVariant}
		<Pocket
			color={orientation === 'white' ? 'black' : 'white'}
			counts={orientation === 'white' ? blackPocketCounts : whitePocketCounts}
			{pieceSet}
			label="Opponent pocket"
			active={interactive && turnColor !== orientation}
			armedLetter={armedDrop && armedDrop.color !== orientation ? armedDrop.letter : null}
			onPick={(letter) => armDrop(orientation === 'white' ? 'black' : 'white', letter)}
		/>
	{/if}

	<div class="ob-board-wrap theme-{boardTheme} pieces-{pieceSet}">
		<div class="ob-board">
			<div
				class="cg-board-wrap"
				bind:this={el}
				tabindex="0"
				role="application"
				aria-label="Chess board. Use arrow keys to move the cursor and Enter to select squares."
				onkeydown={onKeydown}
			></div>
			{#if cursor}
				<div class="ob-cursor" style={cursorStyle(cursor)} aria-hidden="true"></div>
			{/if}

			{#if armedDrop}
				{#each dropDests[armedDrop.letter] ?? [] as square (square)}
					<button
						type="button"
						class="drop-target"
						style={squarePosStyle(square)}
						aria-label="Place {roleName(armedDrop.letter)} on {square}"
						onclick={() => chooseDropTarget(square)}
					></button>
				{/each}
			{/if}
		</div>

		{#if pendingPromotion}
			<div class="promotion" role="dialog" aria-label="Choose a promotion piece">
				{#each ['q', 'r', 'b', 'n'] as letter (letter)}
					<button type="button" class="prom" onclick={() => choosePromotion(letter)}>
						<span class="pc pc-{promotionColor} pc-{letter}"></span>
						<span class="sr-only"
							>{{ q: 'Queen', r: 'Rook', b: 'Bishop', n: 'Knight' }[letter]}</span
						>
					</button>
				{/each}
				<button type="button" class="prom-cancel" onclick={cancelPromotion}>Cancel</button>
			</div>
		{/if}
	</div>

	{#if isPocketVariant}
		<Pocket
			color={orientation}
			counts={orientation === 'white' ? whitePocketCounts : blackPocketCounts}
			{pieceSet}
			label="Your pocket"
			active={interactive && turnColor === orientation}
			armedLetter={armedDrop && armedDrop.color === orientation ? armedDrop.letter : null}
			onPick={(letter) => armDrop(orientation, letter)}
		/>
	{/if}
</div>

<style>
	.board-stack {
		display: flex;
		flex-direction: column;
		width: max-content;
		max-width: 100%;
	}
	.ob-board-wrap {
		position: relative;
		width: var(--board-size, min(92vw, 560px));
		user-select: none;
	}
	.ob-board {
		position: relative;
		width: 100%;
		padding-top: 100%;
		border-radius: 4px;
		box-shadow: 0 2px 14px rgb(0 0 0 / 45%);
		overflow: hidden;
	}
	.cg-board-wrap {
		position: absolute;
		inset: 0;
	}
	.cg-board-wrap:focus-visible {
		outline: 2px solid var(--amber);
		outline-offset: 3px;
	}
	.ob-cursor {
		position: absolute;
		width: 12.5%;
		height: 12.5%;
		border: 3px solid var(--amber);
		box-sizing: border-box;
		pointer-events: none;
		z-index: 5;
		border-radius: 3px;
	}
	.drop-target {
		position: absolute;
		width: 12.5%;
		height: 12.5%;
		padding: 0;
		box-sizing: border-box;
		border: 3px solid color-mix(in srgb, var(--amber) 75%, transparent);
		border-radius: 50%;
		background: transparent;
		cursor: pointer;
		z-index: 15;
	}
	.drop-target:hover,
	.drop-target:focus-visible {
		background: color-mix(in srgb, var(--amber) 35%, transparent);
		outline: none;
	}

	.promotion {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		z-index: 20;
		background: rgb(15 27 20 / 85%);
	}
	.promotion .prom {
		width: 16%;
		aspect-ratio: 1;
		border: 2px solid var(--walnut);
		border-radius: 8px;
		background: var(--baize-raised);
		cursor: pointer;
		display: grid;
		place-items: center;
	}
	.promotion .prom:hover,
	.promotion .prom:focus-visible {
		border-color: var(--amber);
		outline: none;
	}
	.prom-cancel {
		position: absolute;
		top: 8px;
		right: 8px;
		background: var(--baize-raised);
		color: var(--parchment);
		border: 1px solid var(--walnut);
		border-radius: 6px;
		padding: 0.3rem 0.6rem;
		cursor: pointer;
		font-size: 13px;
	}
	.pc {
		width: 80%;
		height: 80%;
		display: inline-block;
		background-repeat: no-repeat;
		background-size: contain;
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}
</style>
