<script lang="ts">
	import { onDestroy } from 'svelte';

	import { drainedMs, formatClock, isFlaggedLow, type ClockView, type Side } from './clockDisplay';

	interface Props {
		/** Latest server snapshot, or null while untimed or after release on finish. */
		clock: ClockView | null;
		/** Wall-clock instant the snapshot was taken; anchors local draining. */
		clockAt: number;
		/** Whether the game carries a time control at all; hides both dials otherwise. */
		timed?: boolean;
		/** Side to move right now; its nameplate glows amber. */
		turn: Side | null;
		whiteName: string;
		blackName: string;
		/** Seat whose flag has fallen, if known; forces its flag-red state. */
		flagged?: Side | null;
	}

	let {
		clock,
		clockAt,
		timed = true,
		turn,
		whiteName,
		blackName,
		flagged = null
	}: Props = $props();

	const showDials = $derived(!!clock && timed);
	const blackLow = $derived(isFlaggedLow(clock?.blackMs ?? 99999999, flagged === 'black'));
	const whiteLow = $derived(isFlaggedLow(clock?.whiteMs ?? 99999999, flagged === 'white'));

	// Local countdown between server broadcasts: a 500ms ticker recomputes the
	// dial text from the last snapshot. The pages only store snapshots; this
	// component owns the drain.
	let nowMs = $state(Date.now());
	let ticker: ReturnType<typeof setInterval> | null = null;

	function startTicker(): void {
		if (ticker) return;
		ticker = setInterval(() => (nowMs = Date.now()), 500);
	}

	function stopTicker(): void {
		if (ticker) {
			clearInterval(ticker);
			ticker = null;
		}
	}

	$effect(() => {
		if (clock) startTicker();
		else stopTicker();
	});

	onDestroy(stopTicker);
</script>

<!-- Black sits above the board, white below; the order matches every game view. -->
<div class="nameplate" class:active={turn === 'black'}>
	<span class="player">{blackName}</span>
	<span
		class="dial mono"
		class:low={showDials && blackLow}
		class:ticking={clock?.ticking === 'black'}
		style={showDials ? '' : 'display:none'}
		aria-label="Black clock"
	>
		{clock ? formatClock(drainedMs(clock, 'black', clockAt, nowMs)) : '-'}
	</span>
</div>

<div class="nameplate" class:active={turn === 'white'}>
	<span class="player">{whiteName}</span>
	<span
		class="dial mono"
		class:low={showDials && whiteLow}
		class:ticking={clock?.ticking === 'white'}
		style={showDials ? '' : 'display:none'}
		aria-label="White clock"
	>
		{clock ? formatClock(drainedMs(clock, 'white', clockAt, nowMs)) : '-'}
	</span>
</div>

<style>
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
	.mono {
		font-family: var(--font-mono), monospace;
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
	@media (prefers-reduced-motion: reduce) {
		.dial.low {
			animation: none;
		}
	}
</style>
