<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<svelte:head><title>Getting started - OpenBoard</title></svelte:head>

<main class="learn">
	<h1>Getting started</h1>
	<p class="intro">Everything a new account needs: finding games, clocks, ratings, and chat.</p>

	<section>
		<h2>An account</h2>
		<p>
			Register with a name, an email address and a password, then confirm the link the server mails
			you. Signed-in players can challenge, chat and hold ratings.
		</p>
	</section>

	<section>
		<h2>Finding a game</h2>
		<p>
			The lobby offers three roads onto the board. Create a challenge: pick variant, time control,
			rated or casual, and colour, then share the invite link it hands you. Links stay valid for 24
			hours, and your challenge also appears in the open-challenges list for anyone to accept.
			Accept someone else's challenge from that list instead if it looks tempting.
		</p>
		<p>
			Quick pair drops you into a pool matched by speed, variant and rated flag. The rating window
			starts at 100 points and widens by 100 every five seconds up to 800, so waiting patiently
			finds you a fairer opponent.
		</p>
		<p>
			Prefer practice? <a href={resolve('/play-bot')}>Play a bot</a> puts a computer opponent across the
			board at five strength levels, on any ruleset.
		</p>
	</section>

	<section>
		<h2>Clocks</h2>
		<p>
			Live presets are Bullet 1+0, Blitz 5+2, Rapid 10+10 and Classical 30+30. The second number is
			the increment, credited to your clock after each completed move. Only the mover's clock runs,
			and the server owns the time: refreshing the page changes nothing. A clock that reaches zero
			is a flag fall, and the flagged side loses.
		</p>
	</section>

	<section>
		<h2>Correspondence</h2>
		<p>
			Correspondence games replace clocks with days per move: 1, 2, 3, 7 or 14. The board shows the
			exact moment your move is due, and missing the deadline loses the game. They sit in My games
			between live sessions, so you can keep several running at once.
		</p>
	</section>

	<section>
		<h2>Ratings</h2>
		<p>
			Rated games feed a Glicko-2 rating for each variant and speed class separately, so bullet
			Crazyhouse never mixes with classical Standard. New ratings start at 1500 with a wide error
			bar and settle as you play; the leaderboards mark unsettled ratings with a question mark.
			Casual games change nothing.
		</p>
	</section>

	<section>
		<h2>While you play</h2>
		<p>
			The game page keeps a move list beside the board, with buttons to resign and to offer a draw;
			your opponent accepts or declines. A chat panel sits under the moves. Finished games offer a
			rematch, and anyone with the link can watch a game in progress as a spectator.
		</p>
	</section>

	<section>
		<h2>How games end</h2>
		<p>
			Checkmate, stalemate, resignation, flag fall, agreed draws, threefold repetition, the
			fifty-move rule and insufficient material all appear as they do in standard chess. Each
			variant adds its own finish, described on its page in this Learn section.
		</p>
	</section>

	<p class="next">
		Read up on a ruleset next, or jump straight into the <a href={resolve('/lobby')}>lobby</a>.
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
