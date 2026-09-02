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
		/** Whether the game carries a time control at all; hides both dials otherwise. */
		timed?: boolean;
		/** Side to move right now; its nameplate glows amber. */
		turn: Side | null;
		whiteName: string;
		blackName: string;
		/** Seat whose flag has fallen, if known; forces its flag-red state. */
		flagged?: Side | null;
		/**
		 * Render the low-time live region. The bar mounts twice per board
		 * (above and below), so exactly one instance per page should opt in.
		 */
		announceLow?: boolean;
		/**
		 * Fires once when either clock first drops under the low-time sound
		 * threshold (30 s).  The argument identifies which side crossed.
		 * Mount exactly one instance per page that wants the callback.
		 */
		onLowTime?: (side: Side) => void;
	}

	let {
		clock,
		clockAt,
		timed = true,
		turn,
		whiteName,
		blackName,
		flagged = null,
		announceLow = false,
		onLowTime
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

	// Low-time announcement: fires once per side per view when the drained
	// figure crosses under the ten-second threshold. The first pass only
	// primes, so joining a position that already sits under ten seconds
	// stays silent instead of replaying an old event.
	let lowNotice = $state('');
	const lowAnnounced = { white: false, black: false };
	let lowPrimed = false;

	const whiteRemainder = $derived(
		showDials && clock ? drainedMs(clock, 'white', clockAt, nowMs) : Number.POSITIVE_INFINITY
	);
	const blackRemainder = $derived(
		showDials && clock ? drainedMs(clock, 'black', clockAt, nowMs) : Number.POSITIVE_INFINITY
	);

	$effect(() => {
		const white = whiteRemainder;
		const black = blackRemainder;
		if (!Number.isFinite(white) && !Number.isFinite(black)) return;
		if (!lowPrimed) {
			lowPrimed = true;
			lowAnnounced.white = white < LOW_TIME_MS;
			lowAnnounced.black = black < LOW_TIME_MS;
			return;
		}
		const crossed: string[] = [];
		if (!lowAnnounced.white && white < LOW_TIME_MS) {
			lowAnnounced.white = true;
			crossed.push('White clock under ten seconds.');
		}
		if (!lowAnnounced.black && black < LOW_TIME_MS) {
			lowAnnounced.black = true;
			crossed.push('Black clock under ten seconds.');
		}
		if (crossed.length > 0) lowNotice = crossed.join(' ');
	});

	// Low-time sound: fires once per side when the drained remainder first
	// drops under 30 seconds.  Independent of the 10 s visual threshold above.
	const LOW_TIME_SOUND_MS = 30_000;
	const lowSoundFired = { white: false, black: false };
	let lowSoundPrimed = false;

	$effect(() => {
		if (!onLowTime) return;
		const white = whiteRemainder;
		const black = blackRemainder;
		if (!Number.isFinite(white) && !Number.isFinite(black)) return;
		// Prime on the first read so pre-existing sub-30 s positions stay silent.
		if (!lowSoundPrimed) {
			lowSoundPrimed = true;
			lowSoundFired.white = white < LOW_TIME_SOUND_MS;
			lowSoundFired.black = black < LOW_TIME_SOUND_MS;
			return;
		}
		if (!lowSoundFired.white && white < LOW_TIME_SOUND_MS) {
			lowSoundFired.white = true;
			onLowTime('white');
		}
		if (!lowSoundFired.black && black < LOW_TIME_SOUND_MS) {
			lowSoundFired.black = true;
			onLowTime('black');
		}
	});
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
