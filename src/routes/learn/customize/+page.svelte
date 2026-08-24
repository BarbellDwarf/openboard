<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<svelte:head><title>Customize - OpenBoard</title></svelte:head>

<main class="learn">
	<h1>Customize</h1>
	<p class="intro">
		The <a href={resolve('/settings/appearance')}>appearance settings</a> page holds every visual and
		sound option. Changes save to your account automatically as you make them.
	</p>

	<section>
		<h2>Session colours</h2>
		<p>
			OpenBoard runs a night session by default. Flip day or night from the sun-and-moon button in
			the header or the checkbox in appearance settings. The choice is stored on this device and
			applied before the first paint, so the page never flashes.
		</p>
	</section>

	<section>
		<h2>Board themes</h2>
		<p>
			Five board palettes: Vinyl, the walnut-and-parchment default, plus Slate, Cherry, Marble and a
			High contrast set for maximum piece visibility.
		</p>
	</section>

	<section>
		<h2>Piece sets</h2>
		<p>
			Three hand-drawn families of artwork: Classic, Arcane with wizard-flavoured pieces, and
			Draconic with dragons. The preview board in the settings page shows your current pairing.
		</p>
	</section>

	<section>
		<h2>Sounds and motion</h2>
		<p>
			Toggle move sounds and pick their volume. Animations, board coordinates and the dots marking
			legal destinations each have their own switch if you want a quieter board.
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
		margin: 0;
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
