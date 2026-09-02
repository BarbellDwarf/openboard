<script lang="ts">
	import { POCKET_ROLES, roleName, type PocketLetter } from './pockets';

	interface Props {
		/** Whose captured pieces this tray shows. */
		color: 'white' | 'black';
		/** Counts keyed by role letter ('q', 'r', ...). */
		counts: Record<string, number>;
		pieceSet?: string;
		/** Placement is currently allowed for this color's pocket. */
		active?: boolean;
		/** Role letter whose placement is armed, if any. */
		armedLetter?: string | null;
		label?: string;
		onPick?: (letter: PocketLetter) => void;
	}

	let {
		color,
		counts,
		pieceSet = 'cburnett',
		active = false,
		armedLetter = null,
		label,
		onPick
	}: Props = $props();

	const slots = $derived(POCKET_ROLES.map((letter) => ({ letter, count: counts[letter] ?? 0 })));

	function pick(letter: PocketLetter): void {
		if (active) onPick?.(letter);
	}
</script>

<div class="tray pieces-{pieceSet}" role="group" aria-label={label ?? `${color} pocket`}>
	{#each slots as s (s.letter)}
		<button
			type="button"
			class="slot"
			class:filled={s.count > 0}
			class:armed={armedLetter === s.letter}
			disabled={!active || s.count === 0}
			aria-pressed={armedLetter === s.letter}
			aria-label="Place {roleName(s.letter)} from pocket ({s.count} available)"
			onclick={() => pick(s.letter)}
		>
			<span
				class="pc pc-p{color === 'white' ? 'w' : 'b'} pc-{s.letter}"
				class:hidden={s.count === 0}
				aria-hidden="true"
			></span>
			{#if s.count > 1}<span class="count mono">{s.count}</span>{/if}
		</button>
	{/each}
</div>

<style>
	.tray {
		display: flex;
		align-items: center;
		gap: 2px;
		width: var(--board-size, min(92vw, 560px));
		box-sizing: border-box;
		padding: 0.3rem 0.5rem;
		margin-bottom: 0.3rem;
		background: var(--baize-raised);
		border: 1px solid var(--walnut);
		border-radius: 8px;
		min-height: 46px;
	}
	.tray:last-child {
		margin-bottom: 0;
		margin-top: 0.3rem;
	}
	.slot {
		position: relative;
		width: 38px;
		height: 38px;
		display: grid;
		place-items: center;
		padding: 0;
		background: transparent;
		border: 1px solid transparent;
		border-radius: 6px;
		cursor: pointer;
	}
	.slot.filled:hover:not(:disabled),
	.slot.filled:focus-visible {
		border-color: var(--amber);
		outline: none;
	}
	.slot.armed {
		border-color: var(--amber);
		background: color-mix(in srgb, var(--amber) 22%, transparent);
	}
	.slot:disabled {
		cursor: default;
	}
	.pc {
		width: 32px;
		height: 32px;
		display: inline-block;
		background-repeat: no-repeat;
		background-size: contain;
	}
	.pc.hidden {
		opacity: 0.18;
		filter: grayscale(1);
	}
	.count {
		position: absolute;
		right: -1px;
		bottom: -1px;
		font-size: 10px;
		line-height: 1;
		padding: 1px 4px;
		border-radius: 7px;
		background: var(--walnut);
		color: var(--parchment);
	}
	.mono {
		font-family: var(--font-mono), monospace;
	}
	@media (max-width: 480px) {
		.slot {
			width: 32px;
			height: 32px;
		}
		.pc {
			width: 27px;
			height: 27px;
		}
	}
</style>
