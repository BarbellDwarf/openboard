<script lang="ts">
	import { onMount } from 'svelte';

	import Board from '$lib/components/board/Board.svelte';
	import { BOARD_THEMES, PIECE_SETS } from '$lib/config/appearance';
	import type { DestMap } from '$lib/server/chess/types';

	const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
	const START_DESTS: DestMap = {
		a2: ['a3', 'a4'],
		b2: ['b3', 'b4'],
		c2: ['c3', 'c4'],
		d2: ['d3', 'd4'],
		e2: ['e3', 'e4'],
		f2: ['f3', 'f4'],
		g2: ['g3', 'g4'],
		h2: ['h3', 'h4'],
		b1: ['a3', 'c3'],
		g1: ['f3', 'h3']
	};

	let boardTheme = $state('vinyl');
	let pieceSet = $state('cburnett');
	let soundsEnabled = $state(true);
	let soundVolume = $state(70);
	let animations = $state(true);
	let coordinates = $state(true);
	let showDests = $state(true);
	let loaded = $state(false);
	let saved = $state(false);
	let saveFailed = $state(false);

	// Day/night lives outside the server preferences payload: app.html applies
	// it pre-paint from localStorage, and the header toggle shares this key.
	const SCHEME_KEY = 'ob.color-scheme';
	type ColorScheme = 'day' | 'night';
	let daySession = $state(false);

	function setDaySession(day: boolean): void {
		if (day) document.documentElement.dataset.scheme = 'day';
		else delete document.documentElement.dataset.scheme;
		try {
			localStorage.setItem(SCHEME_KEY, day ? 'day' : 'night');
		} catch {
			/* storage unavailable: theme lasts for this visit only */
		}
		window.dispatchEvent(
			new CustomEvent<ColorScheme>('ob:scheme', { detail: day ? 'day' : 'night' })
		);
	}

	$effect(() => {
		daySession = document.documentElement.dataset.scheme === 'day';
		function onScheme(event: Event): void {
			daySession = (event as CustomEvent<ColorScheme>).detail === 'day';
		}
		window.addEventListener('ob:scheme', onScheme);
		return () => window.removeEventListener('ob:scheme', onScheme);
	});

	async function loadPrefs(): Promise<void> {
		const res = await fetch('/api/preferences');
		if (!res.ok) return;
		const json = (await res.json()) as { preferences: Record<string, unknown> | null };
		if (!json.preferences) return;
		const p = json.preferences;
		boardTheme = (p.boardTheme as string) ?? boardTheme;
		pieceSet = (p.pieceSet as string) ?? pieceSet;
		soundsEnabled = (p.soundsEnabled as boolean) ?? true;
		soundVolume = (p.soundVolume as number) ?? 70;
		animations = (p.animations as boolean) ?? true;
		coordinates = (p.coordinates as boolean) ?? true;
		showDests = (p.showDests as boolean) ?? true;
	}

	onMount(() => {
		void loadPrefs().then(() => (loaded = true));
	});

	let saveTimer: ReturnType<typeof setTimeout> | null = null;
	function persist(): void {
		if (!loaded) return;
		saved = false;
		if (saveTimer) clearTimeout(saveTimer);
		saveTimer = setTimeout(() => {
			void fetch('/api/preferences', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					boardTheme,
					pieceSet,
					soundsEnabled,
					soundVolume,
					animations,
					coordinates,
					showDests
				})
			})
				.then((res) => {
					saveFailed = !res.ok;
					if (res.ok) {
						saved = true;
						setTimeout(() => (saved = false), 2000);
					}
				})
				.catch(() => {
					saved = false;
					saveFailed = true;
				});
		}, 400);
	}
	$effect(() => {
		void boardTheme;
		void pieceSet;
		void soundsEnabled;
		void soundVolume;
		void animations;
		void coordinates;
		void showDests;
		persist();
	});
</script>

<svelte:head><title>Appearance - OpenBoard</title></svelte:head>

<main class="appearance">
	<h1>Appearance</h1>
	{#if saved}<p class="saved" role="status">Saved</p>{/if}
	{#if saveFailed}
		<p class="save-error" role="alert">Could not save preferences. Change a setting to retry.</p>
	{/if}

	<div class="layout">
		<section>
			<h2>Board theme</h2>
			<div class="grid">
				{#each BOARD_THEMES as t (t.id)}
					<button
						type="button"
						class="pick"
						class:selected={boardTheme === t.id}
						onclick={() => (boardTheme = t.id)}
					>
						<span class="swatch theme-{t.id}"></span>{t.name}
					</button>
				{/each}
			</div>

			<h2>Piece set</h2>
			<div class="grid">
				{#each PIECE_SETS as p (p.id)}
					<button
						type="button"
						class="pick"
						class:selected={pieceSet === p.id}
						onclick={() => (pieceSet = p.id)}
					>
						{#if p.id === 'cburnett'}
							<img src="/pieces/{p.id}/wK.svg" alt="" />
						{:else}
							<span class="glyph-chip {p.id}" aria-hidden="true">♚</span>
						{/if}
						{p.name}
					</button>
				{/each}
			</div>

			<h2>Session colours</h2>
			<div class="toggles">
				<label>
					<input
						type="checkbox"
						bind:checked={daySession}
						onchange={(e) => setDaySession(e.currentTarget.checked)}
					/>
					Day session (light colours)
				</label>
			</div>

			<h2>Sounds and motion</h2>
			<div class="toggles">
				<label><input type="checkbox" bind:checked={soundsEnabled} /> Sounds</label>
				<label>Volume <input type="range" min="0" max="100" bind:value={soundVolume} /></label>
				<button
					type="button"
					class="test-sound"
					onclick={() => new Audio(`/sounds/openboard/move.wav`).play().catch(() => {})}
				>
					Test sound
				</button>
				<label><input type="checkbox" bind:checked={animations} /> Animations</label>
				<label><input type="checkbox" bind:checked={coordinates} /> Coordinates</label>
				<label><input type="checkbox" bind:checked={showDests} /> Show legal moves</label>
			</div>
		</section>

		<section>
			<h2>Preview</h2>
			<div class="preview pieces-{pieceSet}">
				<Board
					xfen={START}
					dests={START_DESTS}
					{coordinates}
					{boardTheme}
					{pieceSet}
					animationMs={180}
				/>
			</div>
		</section>
	</div>
</main>

<style>
	.appearance {
		max-width: 880px;
		margin: 2rem auto 0;
		padding: 0 1rem;
	}
	h1 {
		font-family: 'Marcellus', serif;
		color: var(--parchment);
		font-size: 28px;
		margin-bottom: 1rem;
	}
	h2 {
		color: var(--parchment);
		font-size: 15px;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin: 1.25rem 0 0.5rem;
	}
	.layout {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 1.5rem;
		align-items: start;
	}
	.grid {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}
	.pick {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.3rem;
		padding: 0.5rem;
		min-width: 84px;
		border: 1px solid var(--walnut);
		border-radius: 8px;
		background: var(--baize-raised);
		color: var(--parchment);
		font-size: 12px;
		cursor: pointer;
	}
	.pick.selected {
		border-color: var(--amber);
		box-shadow: inset 0 0 0 1px var(--amber);
	}
	.swatch {
		width: 56px;
		height: 40px;
		border-radius: 4px;
		display: block;
		background: conic-gradient(
				var(--sq-light) 0 25%,
				var(--sq-dark) 0 50%,
				var(--sq-light) 0 75%,
				var(--sq-dark) 0
			)
			0 0 / 25% 25%;
	}
	.theme-slate.swatch {
		background: conic-gradient(#cfd8dc 0 25%, #546e7a 0 50%, #cfd8dc 0 75%, #546e7a 0) 0 0 / 25% 25%;
	}
	.theme-cherry.swatch {
		background: conic-gradient(#f3d9c0 0 25%, #a34a32 0 50%, #f3d9c0 0 75%, #a34a32 0) 0 0 / 25% 25%;
	}
	.theme-marble.swatch {
		background: conic-gradient(#f5f5f5 0 25%, #7d8896 0 50%, #f5f5f5 0 75%, #7d8896 0) 0 0 / 25% 25%;
	}
	.theme-contrast.swatch {
		background: conic-gradient(#ffffff 0 25%, #212121 0 50%, #ffffff 0 75%, #212121 0) 0 0 / 25% 25%;
	}
	.theme-forest.swatch {
		background: conic-gradient(#90b890 0 25%, #2d4a2d 0 50%, #90b890 0 75%, #2d4a2d 0) 0 0 / 25% 25%;
	}
	.theme-ocean.swatch {
		background: conic-gradient(#a0c4d8 0 25%, #1a3a5a 0 50%, #a0c4d8 0 75%, #1a3a5a 0) 0 0 / 25% 25%;
	}
	.pick img {
		width: 44px;
		height: 44px;
	}
	/* Miniature of the CSS-art medallion tokens; the static SVG files for
	   these sets no longer exist, so the preview renders the same art. */
	.glyph-chip {
		width: 44px;
		height: 44px;
		border-radius: 9px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 30px;
		line-height: 1;
	}
	.glyph-chip.arcane {
		background: linear-gradient(160deg, #f3eefb, #b9aed8);
		border: 2px solid #6a5aa8;
		color: #2c2350;
		text-shadow:
			1px 1px 0 rgba(243, 238, 251, 0.55),
			-1px -1px 0 rgba(44, 35, 80, 0.3);
	}
	.glyph-chip.draconic {
		background: linear-gradient(160deg, #f5e7cd, #ccb28a);
		border: 2px solid #7d2a1c;
		color: #7d2214;
	}
	.toggles {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
		color: var(--parchment);
		font-size: 14px;
	}
	label.check,
	label {
		color: var(--parchment);
	}
	.saved {
		position: fixed;
		top: 70px;
		right: 20px;
		background: var(--lichen);
		color: #14210f;
		padding: 0.35rem 0.8rem;
		border-radius: 999px;
		font-weight: 600;
	}
	:global([data-scheme='day']) .saved {
		/* Day lichen is darker for text contrast; flip the pill label to light. */
		color: #f6f1e3;
	}
	.save-error {
		color: var(--flag-red);
		font-weight: 600;
		margin-bottom: 1rem;
	}
	button:focus-visible,
	input:focus-visible {
		outline: 2px solid var(--amber);
		outline-offset: 2px;
	}
	@media (max-width: 800px) {
		.layout {
			grid-template-columns: 1fr;
		}
	}
	@media (max-width: 640px) {
		.appearance {
			margin-top: 1rem;
		}
		/* The preview board tracks the padded column width, matching the
		   full-bleed boards on the game pages. */
		.preview {
			--board-size: calc(100vw - 2rem);
		}
		.grid {
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
		}
		.pick {
			min-height: 64px;
		}
		.toggles label,
		.toggles button {
			min-height: 44px;
		}
		.toggles label {
			display: flex;
			align-items: center;
		}
		/* The header grows a second row on phones; keep the toast under it. */
		.saved {
			top: 130px;
		}
	}
	.test-sound {
		min-height: 28px;
	}
	input[type='range'] {
		min-height: 24px;
	}
</style>
