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

	interface Props {
		xfen: string;
		dests?: DestMap;
		orientation?: 'white' | 'black';
		lastMove?: [string, string] | null;
		checkSquare?: string | null;
		interactive?: boolean;
		coordinates?: boolean;
		animationMs?: number;
		boardTheme?: string;
		pieceSet?: string;
		onMove?: (uci: string) => void;
	}

	let {
		xfen,
		dests = {},
		orientation = 'white',
		lastMove = null,
		checkSquare = null,
		interactive = false,
		coordinates = true,
		animationMs = 180,
		boardTheme = 'vinyl',
		pieceSet = 'cburnett',
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
			if (from.startsWith('drop:')) continue;
			map.set(from as Key, tos as Key[]);
		}
		return map;
	}

	function baseConfig(): Partial<Config> {
		return {
			fen: xfen,
			orientation,
			coordinates,
			animation: { enabled: !reducedMotion, duration: animationMs },
			movable: {
				free: false,
				color: interactive ? orientation : undefined,
				dests: interactive ? toDests(dests) : new Map(),
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
				color: interactive ? orientation : undefined,
				dests: interactive ? toDests(dests) : new Map()
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

	function cursorStyle(cursorKey: Key): string {
		const file = cursorKey.charCodeAt(0) - 97;
		const rank = Number(cursorKey[1]) - 1;
		const x = orientation === 'white' ? file : 7 - file;
		const y = orientation === 'white' ? 7 - rank : rank;
		return `left:${x * 12.5}%;top:${y * 12.5}%`;
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
			const isDest = Object.entries(dests).some(([from, tos]) => from === cur || tos.includes(cur));
			if (cursor !== selected && dests[cursor as string]) {
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
	</div>

	{#if pendingPromotion}
		<div class="promotion" role="dialog" aria-label="Choose a promotion piece">
			{#each ['q', 'r', 'b', 'n'] as letter (letter)}
				<button type="button" class="prom" onclick={() => choosePromotion(letter)}>
					<span class="pc pc-{promotionColor} pc-{letter}"></span>
					<span class="sr-only">{{ q: 'Queen', r: 'Rook', b: 'Bishop', n: 'Knight' }[letter]}</span>
				</button>
			{/each}
			<button type="button" class="prom-cancel" onclick={cancelPromotion}>Cancel</button>
		</div>
	{/if}
</div>

<style>
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
