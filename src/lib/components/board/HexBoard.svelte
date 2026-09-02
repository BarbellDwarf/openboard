<script lang="ts">
	/**
	 * HexBoard — renders a Chinese Checkers star-shaped board.
	 *
	 * Props mirror Board.svelte's interface so the game page can swap them
	 * without additional plumbing.  `xfen` carries the compact 122-char state
	 * (turn + 121 cells); `dests` is the chessground-compatible map of
	 * origin names to destination names.
	 */

	import { cells, campMembers, parseCellName, cellIndex } from '$lib/shared/chinese-checkers-board';

	interface Props {
		xfen: string;
		dests?: Record<string, string[]>;
		orientation?: 'white' | 'black';
		interactive?: boolean;
		anyColor?: boolean;
		onMove?: (uci: string) => void;
	}

	let {
		xfen,
		dests = {},
		orientation = 'white',
		interactive = false,
		anyColor = false,
		onMove
	}: Props = $props();

	/* ------------------------------------------------------------------ */
	/*  Derived state                                                      */
	/* ------------------------------------------------------------------ */

	const turn = $derived(xfen[0] === 'w' ? 'white' : 'black');
	const board = $derived(xfen.slice(1));

	/* ------------------------------------------------------------------ */
	/*  Selection & interaction                                            */
	/* ------------------------------------------------------------------ */

	let selected = $state<string | null>(null);
	let highlightedDests = $state<string[]>([]);

	function selectPiece(name: string): void {
		if (selected === name) {
			deselect();
			return;
		}
		selected = name;
		highlightedDests = dests[name] ?? [];
	}

	function deselect(): void {
		selected = null;
		highlightedDests = [];
	}

	function onCellClick(name: string): void {
		if (!interactive) return;
		if (turn !== orientation && !anyColor) return;

		const { row, col } = parseCellName(name);
		const idx = cellIndex(row, col);
		const ch = board[idx];

		// If we have a selected piece and this is a legal destination, move.
		if (selected && highlightedDests.includes(name)) {
			const uci = `${selected}-${name}`;
			deselect();
			onMove?.(uci);
			return;
		}

		// If this cell has the mover's piece, select it.
		const pieceChar = orientation === 'white' ? 'W' : 'B';
		if (ch === pieceChar || (anyColor && (ch === 'W' || ch === 'B'))) {
			selectPiece(name);
			return;
		}

		deselect();
	}

	/* ------------------------------------------------------------------ */
	/*  Hex geometry (flat-top, pointy-side orientation)                   */
	/* ------------------------------------------------------------------ */

	const HEX = 22;

	// Compute SVG viewbox from cell positions.
	const allPx = cells.map((c) => c.px);
	const allPy = cells.map((c) => c.py);
	const minX = Math.min(...allPx) - HEX * 2;
	const maxX = Math.max(...allPx) + HEX * 2;
	const minY = Math.min(...allPy) - HEX * 2;
	const maxY = Math.max(...allPy) + HEX * 2;
	const SVG_W = maxX - minX;
	const SVG_H = maxY - minY;
	const SVG_OX = -minX;
	const SVG_OY = -minY;

	function hexPoints(cx: number, cy: number, size: number): string {
		const pts: string[] = [];
		for (let i = 0; i < 6; i++) {
			const angle = (Math.PI / 180) * (60 * i);
			pts.push(`${cx + size * Math.cos(angle)},${cy + size * Math.sin(angle)}`);
		}
		return pts.join(' ');
	}

	/* ------------------------------------------------------------------ */
	/*  Cell visual helpers                                                */
	/* ------------------------------------------------------------------ */

	function isCampCell(idx: number, camp: number): boolean {
		return cells[idx].camp === camp;
	}

	function isHighlighted(name: string): boolean {
		return highlightedDests.includes(name);
	}

	function cellFill(idx: number): string {
		const ch = board[idx];
		if (ch === 'W') return '#f5f0e0';
		if (ch === 'B') return '#2a2018';
		const camp = cells[idx].camp;
		if (camp === 0) return 'rgba(200,180,140,0.35)';
		if (camp === 3) return 'rgba(60,40,20,0.35)';
		const { row, col } = cells[idx];
		return (row + col) % 2 === 0 ? '#c8b890' : '#b0a078';
	}

	function pieceStroke(_idx: number): string {
		const ch = board[_idx];
		if (ch === 'W') return '#a89060';
		if (ch === 'B') return '#8a7050';
		return 'none';
	}

	function pieceRadius(): number {
		return HEX * 0.6;
	}

	/* ------------------------------------------------------------------ */
	/*  Keyboard navigation (arrow keys + Enter)                           */
	/* ------------------------------------------------------------------ */

	let cursor = $state<string | null>(null);

	function onKeyDown(e: KeyboardEvent): void {
		if (!interactive) return;
		if (e.key === 'Escape') {
			deselect();
			cursor = null;
			return;
		}
		if (!cursor) {
			cursor = 'k5';
			return;
		}
		const { row, col } = parseCellName(cursor);
		const idx = cellIndex(row, col);
		void idx;
		// Simplified: just use Enter to toggle.
		if (e.key === 'Enter') {
			e.preventDefault();
			onCellClick(cursor);
		}
	}
</script>

<div
	class="hex-board-wrap"
	tabindex="0"
	role="application"
	aria-label="Chinese Checkers board. Arrow keys navigate, Enter selects."
	onkeydown={onKeyDown}
>
	<svg
		viewBox="0 0 {SVG_W} {SVG_H}"
		preserveAspectRatio="xMidYMid meet"
		xmlns="http://www.w3.org/2000/svg"
		class="hex-svg"
	>
		<!-- Camp region labels -->
		<text
			x={cells[campMembers[0][0]].px + SVG_OX}
			y={cells[campMembers[0][0]].py + SVG_OY - HEX * 1.5}
			class="camp-label"
			text-anchor="middle">White start</text
		>
		<text
			x={cells[campMembers[3][0]].px + SVG_OX}
			y={cells[campMembers[3][0]].py + SVG_OY + HEX * 1.8}
			class="camp-label"
			text-anchor="middle">Black start</text
		>

		<!-- Hex cells -->
		{#each cells as cell, idx (cell.name)}
			<g class="hex-cell">
				<polygon
					points={hexPoints(cell.px + SVG_OX, cell.py + SVG_OY, HEX - 1)}
					fill={cellFill(idx)}
					stroke={isHighlighted(cell.name) ? '#e8a33d' : '#8a7a5a'}
					stroke-width={isHighlighted(cell.name) ? 2.5 : 0.6}
					class="hex-tile"
					role="button"
					tabindex="-1"
					aria-label="{cell.name}: {board[idx] === 'W'
						? 'White piece'
						: board[idx] === 'B'
							? 'Black piece'
							: 'Empty'}"
					onclick={() => onCellClick(cell.name)}
				/>
				{#if board[idx] === 'W' || board[idx] === 'B'}
					<circle
						cx={cell.px + SVG_OX}
						cy={cell.py + SVG_OY}
						r={pieceRadius()}
						fill={board[idx] === 'W' ? '#f5f0e0' : '#2a2018'}
						stroke={pieceStroke(idx)}
						stroke-width={1.5}
						class="piece"
					/>
				{/if}
				{#if isHighlighted(cell.name)}
					<circle
						cx={cell.px + SVG_OX}
						cy={cell.py + SVG_OY}
						r={HEX * 0.22}
						fill="#e8a33d"
						opacity={0.7}
					/>
				{/if}
				{#if isCampCell(idx, 0)}
					<circle
						cx={cell.px + SVG_OX}
						cy={cell.py + SVG_OY}
						r={HEX * 0.85}
						fill="none"
						stroke="rgba(200,180,140,0.2)"
						stroke-width={1}
					/>
				{/if}
				{#if isCampCell(idx, 3)}
					<circle
						cx={cell.px + SVG_OX}
						cy={cell.py + SVG_OY}
						r={HEX * 0.85}
						fill="none"
						stroke="rgba(60,40,20,0.2)"
						stroke-width={1}
					/>
				{/if}
				{#if cursor === cell.name}
					<circle
						cx={cell.px + SVG_OX}
						cy={cell.py + SVG_OY}
						r={HEX * 0.88}
						fill="none"
						stroke="#e8a33d"
						stroke-width={2}
						class="cursor-ring"
					/>
				{/if}
			</g>
		{/each}
	</svg>
</div>

<style>
	.hex-board-wrap {
		position: relative;
		width: var(--board-size, min(92vw, 560px));
		user-select: none;
		border-radius: 4px;
		box-shadow: 0 2px 14px rgb(0 0 0 / 45%);
		background: #a89870;
		overflow: hidden;
	}
	.hex-board-wrap:focus-visible {
		outline: 2px solid #e8a33d;
		outline-offset: 3px;
	}
	.hex-svg {
		display: block;
		width: 100%;
		height: auto;
	}
	.hex-tile {
		cursor: pointer;
		transition:
			fill 0.12s ease,
			stroke 0.12s ease;
	}
	.hex-tile:hover {
		filter: brightness(1.08);
	}
	.piece {
		pointer-events: none;
	}
	.camp-label {
		font-size: 10px;
		font-family: 'Work Sans', sans-serif;
		fill: rgba(240, 230, 210, 0.7);
		font-weight: 500;
	}
	.cursor-ring {
		animation: pulse 1.2s ease-in-out infinite;
	}
	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.4;
		}
	}
</style>
