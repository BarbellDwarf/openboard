<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<svelte:head><title>Getting started - OpenBoard</title></svelte:head>

<main class="learn">
	<h1>Getting started</h1>
	<p class="intro">
		Everything a new account needs: accounts, the lobby, clocks, correspondence, ratings, chat,
		finishing games, and exporting your play.
	</p>

	<section>
		<h2>Creating an account</h2>
		<p>
			Register with a name, an email address, and a password. The server mails you a confirmation
			link. Click it to verify the account. Signed-in players can challenge others, chat in games,
			and hold ratings. Without an account you can observe games as a spectator but cannot play.
		</p>
		<p>
			Your account persists across devices. Log in from any browser and your preferences, ratings,
			and game history follow you. The server stores your appearance preferences and ties them to
			the account, so a board theme chosen on one device applies everywhere you log in.
		</p>
	</section>

	<section>
		<h2>Reading the lobby</h2>
		<p>
			The lobby is the starting point for every live session. It shows three things: the quick-pair
			controls, a list of open challenges, and your My Games section for correspondence games and
			ongoing live games.
		</p>
		<h3>Creating a challenge</h3>
		<p>Open the challenge form and you see these fields, one by one:</p>
		<p>
			<strong>Variant.</strong> Pick from Standard, Chess960, Crazyhouse, King of the Hill, Three-check,
			Atomic, Horde, or Racing Kings. The variant determines the ruleset for the game.
		</p>
		<p>
			<strong>Time control.</strong> Choose a live preset or set custom times. Live presets are Bullet
			1+0, Blitz 5+2, Rapid 10+10, and Classical 30+30. The first number is the initial time in minutes;
			the second is the increment in seconds. Correspondence games replace the clock with days per move:
			1, 2, 3, 7, or 14.
		</p>
		<p>
			<strong>Rated or casual.</strong> Rated games affect your rating. Casual games do not. Choose casual
			when you are learning a new variant or testing an opening.
		</p>
		<p>
			<strong>Colour.</strong> Pick White, Black, or Random. Random assigns colours when the opponent
			accepts.
		</p>
		<p>
			After you create the challenge, the server hands you a shareable link. Anyone with the link
			can accept it. The challenge also appears in the open-challenges list. Links stay valid for 24
			hours.
		</p>
	</section>

	<section>
		<h2>Quick pair</h2>
		<p>
			Quick pair drops you into a pool matched by speed, variant, and rated flag. The rating window
			starts at 100 points and widens by 100 every five seconds up to 800. Waiting longer finds you
			a fairer opponent. Quick pair is the fastest way to start a game when you have no partner in
			mind.
		</p>
	</section>

	<section>
		<h2>Reading the board and clocks</h2>
		<p>
			The board sits in the centre of the game page. Pieces follow the coordinate system: files a
			through h run left to right, ranks 1 through 8 run bottom to top from White's perspective. The
			board flips automatically when you play Black, so your pieces always start at the bottom.
		</p>
		<p>
			Two clocks sit above or beside the board in a twin-dial bar. Each clock shows minutes and
			seconds. Your opponent's clock is on the left, yours on the right (from White's perspective).
			A clock that turns red indicates low time: fewer than 30 seconds remaining. The bar between
			the clocks shows whose turn it is.
		</p>
		<p>
			The server owns the clock. Refreshing the page, losing your internet connection, or closing
			the tab does not stop the clock. The time continues to run. Only a completed move advances the
			turn and stops your clock.
		</p>
	</section>

	<section>
		<h2>Correspondence</h2>
		<p>
			Correspondence games replace clocks with days per move. You choose 1, 2, 3, 7, or 14 days when
			creating the challenge. The board shows the exact moment your move is due. Missing the
			deadline loses the game by timeout.
		</p>
		<p>
			Correspondence games sit in My Games between live sessions. You can keep several running at
			once. The server sends reminders before the deadline so you do not forget. Plan your move,
			take your time, and make it before the clock runs out.
		</p>
	</section>

	<section>
		<h2>Ratings</h2>
		<p>
			Rated games feed a Glicko-2 rating for each variant and speed class separately. Bullet
			Crazyhouse has its own rating; classical Standard has its own. The two never mix.
		</p>
		<p>
			New ratings start at 1500 with a wide error bar. The error bar shrinks as you play; the
			leaderboards mark unsettled ratings with a question mark. Your rating changes after each rated
			game. Winning against a higher-rated opponent gains more; losing to a lower-rated opponent
			loses more. Casual games change nothing.
		</p>
		<p>
			Glicko-2 also tracks rating deviation, which measures how uncertain the system is about your
			.rating. A high deviation means your rating is volatile; a low deviation means the system is
			confident. Playing regularly keeps the deviation low and the ratings stable.
		</p>
	</section>

	<section>
		<h2>Chat and notifications</h2>
		<p>
			A chat panel sits under the move list during each game. Both players can type messages. Chat
			is available in live and correspondence games. Keep it civil; the server records all messages.
		</p>
		<p>
			Notifications appear when you receive a challenge, when a correspondence move is due, and when
			a game ends. The header shows a notification indicator when something requires your attention.
		</p>
	</section>

	<section>
		<h2>Finishing games</h2>
		<p>
			Games end in several ways. Checkmate is decisive: the side with the mated king loses.
			Stalemate is a draw: the side to move has no legal move and is not in check. Resignation end
			the game immediately; the resigning side loses.
		</p>
		<p>
			A draw can be offered by either player. The opponent accepts or declines. The server also
			declares draws automatically for threefold repetition (the same position appears three times),
			the fifty-move rule (100 half-moves without a pawn move or capture), and insufficient material
			(neither side can force checkmate).
		</p>
		<p>
			After a game ends, both players see the result and a rematch button. Rematching starts a new
			game with the same variant and time control. The server keeps a move list for every game; you
			can review it after the result.
		</p>
	</section>

	<section>
		<h2>PGN download</h2>
		<p>
			Every finished game is available in PGN format. The PGN contains the move list in standard
			algebraic notation, the result, and metadata such as the players, variant, and time control.
			Download the PGN to import into analysis tools, keep a personal archive, or share your games
			with others.
		</p>
	</section>

	<p class="next">
		Head to a ruleset page next, or jump straight into the <a href={resolve('/lobby')}>lobby</a>.
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
	h3 {
		color: var(--parchment);
		font-size: 14px;
		font-weight: 600;
		margin: 0.75rem 0 0.3rem;
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
