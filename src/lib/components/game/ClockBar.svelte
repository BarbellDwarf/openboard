<script lang="ts">
	import { onDestroy } from 'svelte';

	import {
		drainedMs,
		formatClock,
		isFlaggedLow,
		LOW_TIME_MS,
		type ClockView,
		type Side
	} from './clockDisplay';

	interface Props {
		/** Latest server snapshot, or null while untimed or after release on finish. */
		clock: ClockView | null;
		/** Wall-clock instant the snapshot was taken; anchors local draining. */
		clockAt: number;
		/** Whether the game carries a time control at all; hides dials otherwise. */
		timed?: boolean;
		/** Side to move right now; its nameplate glows amber. */
		turn: Side | null;
		/** Which seat this bar represents. */
		side: Side;
		name: string;
		/** Seat whose flag has fallen, if known; forces its flag-red state. */
		flagged?: Side | null;
		/**
		 * Render the low-time live region. The bar mounts twice per board
		 * (above and below), so exactly one instance per page should opt in.
		 */
		announceLow?: boolean;
	}

	let {
		clock,
		clockAt,
		timed = true,
		turn,
		side,
		name,
		flagged = null,
		announceLow = false
	}: Props = $props();

	const showDials = $derived(!!clock && timed);
	const low = $derived(
		isFlaggedLow(
			side === 'white' ? (clock?.whiteMs ?? 99999999) : (clock?.blackMs ?? 99999999),
			flagged === side
		)
	);

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

	const remainder = $derived(
		showDials && clock ? drainedMs(clock, side, clockAt, nowMs) : Number.POSITIVE_INFINITY
	);

	// Low-time announcement: fires once when the drained figure crosses under
	// the ten-second threshold.
	let lowNotice = $state('');
	let lowAnnounced = false;
	let lowPrimed = false;

	$effect(() => {
		const rem = remainder;
		if (!Number.isFinite(rem)) return;
		if (!lowPrimed) {
			lowPrimed = true;
			lowAnnounced = rem < LOW_TIME_MS;
			return;
		}
		if (!lowAnnounced && rem < LOW_TIME_MS) {
			lowAnnounced = true;
			lowNotice = `${name} clock under ten seconds.`;
		}
	});

	const isActive = $derived(turn === side);
</script>

<div class="nameplate" class:active={isActive}>
	<span class="player">{name}</span>
	<span
		class="dial mono"
		class:low={showDials && low}
		class:ticking={clock?.ticking === side}
		style={showDials ? '' : 'display:none'}
		aria-label="{name} clock"
	>
		{clock ? formatClock(drainedMs(clock, side, clockAt, nowMs)) : '-'}
	</span>
</div>

{#if announceLow}
	<p class="sr-only" role="status" aria-live="polite">{lowNotice}</p>
{/if}

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
	/* Slim strips on phones: the nameplates hug the board so the squares
	   keep the space. */
	@media (max-width: 640px) {
		.nameplate {
			padding: 0.25rem 0.55rem;
			margin: 0.2rem 0;
			font-size: 12px;
			border-radius: 6px;
		}
		.dial {
			font-size: 14px;
			padding: 0.05rem 0.4rem;
		}
	}
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}
</style>
