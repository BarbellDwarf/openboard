<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<svelte:head><title>Customize - OpenBoard</title></svelte:head>

<main class="learn">
	<h1>Customize</h1>
	<p class="intro">
		The <a href={resolve('/settings/appearance')}>appearance settings</a> page holds every visual and
		sound option. Changes save to your account automatically as you make them. Every preference applies
		to every board you play on, and persists across devices when you log in.
	</p>

	<section>
		<h2>Board themes</h2>
		<p>
			Five board palettes change the square colours across the entire board. Each theme pairs a
			light square colour with a dark square colour.
		</p>
		<p>
			<strong>Vinyl.</strong> The default. Warm walnut brown for dark squares, parchment cream for light
			squares. A classic look that works well in both day and night modes.
		</p>
		<p>
			<strong>Slate.</strong> Cool blue-grey for dark squares, light grey for light squares. A muted,
			modern palette that reduces eye strain during long sessions.
		</p>
		<p>
			<strong>Cherry.</strong> Deep reddish-brown for dark squares, warm peach for light squares. A rich,
			warm palette with strong contrast between squares.
		</p>
		<p>
			<strong>Marble.</strong> Medium grey for dark squares, near-white for light squares. Clean and neutral,
			with high contrast between squares.
		</p>
		<p>
			<strong>High contrast.</strong> Near-black for dark squares, pure white for light squares. Maximum
			piece visibility. Designed for players who need the strongest possible distinction between squares.
		</p>
	</section>

	<section>
		<h2>Piece sets</h2>
		<p>
			Three hand-drawn families of artwork control how every piece looks on the board. The preview
			board in the settings page shows your current pairing.
		</p>
		<p>
			<strong>Classic (cburnett).</strong> The default set. Clean, traditional chess pieces with clear
			silhouettes. Familiar to anyone who has played online chess.
		</p>
		<p>
			<strong>Arcane.</strong> Wizard-flavoured pieces with pointed hats, staffs, and magical motifs.
			The same piece types, rendered in a fantasy style. Easy to read once you adjust.
		</p>
		<p>
			<strong>Draconic.</strong> Dragon-themed pieces with scales, horns, and wings. A stylistic departure
			from the traditional look, with the same functional clarity.
		</p>
	</section>

	<section>
		<h2>Sounds and volume</h2>
		<p>
			Toggle move sounds on or off. When enabled, each move plays a sound effect. The volume slider
			controls how loud the sounds play, from 0 to 100. A test button lets you preview the sound at
			the current volume before you return to a game.
		</p>
		<p>
			The current sound pack is OpenBoard, the default set of move and game event sounds. The pack
			covers piece moves, captures, checks, game start, and game end.
		</p>
	</section>

	<section>
		<h2>Motion preferences</h2>
		<p>
			<strong>Animations.</strong> Toggle piece movement animations on or off. When enabled, pieces glide
			from origin to destination. When disabled, pieces teleport instantly. Disabling animations can improve
			performance on slower devices.
		</p>
		<p>
			<strong>Coordinates.</strong> Toggle the rank and file labels around the board. When enabled, a1
			through h8 appear on the board edges. Disabling coordinates gives a cleaner board but makes it harder
			to call squares by name.
		</p>
		<p>
			<strong>Show legal moves.</strong> Toggle the dots that mark legal destinations when you select
			a piece. When enabled, the board highlights every square the piece can move to. Disabling the dots
			forces you to calculate destinations yourself.
		</p>
	</section>

	<section>
		<h2>Day and night schemes</h2>
		<p>
			OpenBoard runs a night session by default: dark backgrounds with warm tones. Flip to day mode
			from the sun-and-moon button in the header or the checkbox in appearance settings.
		</p>
		<p>
			Night mode uses dark backgrounds with parchment-toned text. Day mode uses light backgrounds
			with dark text. Both schemes maintain accessible contrast ratios for body text, so everything
			stays readable regardless of your choice.
		</p>
		<p>
			The choice is stored on this device and applied before the first paint, so the page never
			flashes between themes. Your day or night preference is independent of the board theme and
			piece set; all combinations work.
		</p>
	</section>

	<section>
		<h2>Where preferences apply</h2>
		<p>
			Your board theme, piece set, sound, motion, and colour scheme preferences apply to every board
			you play on. Challenge games, quick pair games, bot games, and correspondence games all use
			the same settings.
		</p>
		<p>
			Preferences persist to your account. Change them once and they follow you to any device where
			you log in. The server stores board theme and piece set; sounds, motion, and colour scheme are
			stored on the device and applied immediately.
		</p>
	</section>

	<p class="next">
		Happy with the look? Head back to <a href={resolve('/learn')}>Learn</a> for the rulesets.
	</p>
</main>

<style>
	.learn {
		max-width: 720px;
		margin: 2rem auto 0;
		padding: 0 1rem 2.5rem;
	}
	h1 {
		font-family: 'Marcellus', serif;
		color: var(--parchment);
		font-size: 28px;
		margin-bottom: 0.5rem;
	}
	.intro {
		color: color-mix(in srgb, var(--parchment) 75%, transparent);
		margin: 0 0 1.5rem;
	}
	section {
		background: var(--baize-raised);
		border: 1px solid color-mix(in srgb, var(--walnut) 50%, transparent);
		border-radius: 10px;
		padding: 1rem 1.1rem;
		margin-bottom: 1rem;
	}
	h2 {
		color: var(--parchment);
		font-size: 16px;
		margin: 0 0 0.4rem;
	}
	p {
		color: var(--parchment);
		font-size: 14px;
		line-height: 1.55;
		margin: 0.3rem 0;
	}
	strong {
		color: var(--parchment);
	}
	a {
		color: var(--amber);
		text-decoration: none;
	}
	a:hover {
		text-decoration: underline;
	}
	.next {
		color: color-mix(in srgb, var(--parchment) 75%, transparent);
	}
	a:focus-visible {
		outline: 2px solid var(--amber);
		outline-offset: 2px;
	}
</style>
