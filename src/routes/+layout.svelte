<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';

	let { data, children } = $props();

	const user = $derived(data.user);
	const navLinks = [
		{ href: '/lobby', label: 'Lobby' },
		{ href: '/leaderboard', label: 'Leaderboards' },
		{ href: '/games', label: 'My games' },
		{ href: '/play-bot', label: 'Play a bot' }
	];

	let menuOpen = $state(false);

	async function signOut(): Promise<void> {
		await fetch('/logout', { method: 'POST' });
		window.location.href = resolve('/');
	}

	function active(href: string): boolean {
		return page.url.pathname.startsWith(href);
	}
</script>

<header>
	<a class="brand" href={resolve('/')}>OpenBoard</a>
	<nav class="main-nav" aria-label="Main">
		{#each navLinks as link (link.href)}
			<a href={link.href} aria-current={active(link.href) ? 'page' : undefined}
				>{link.label}</a
			>
		{/each}
	</nav>
	<div class="right">
		{#if user}
			<span class="who">{user.name}</span>
			<button type="button" onclick={() => void signOut()}>Sign out</button>
		{:else}
			<a class="signin" href={resolve('/login')}>Sign in</a>
			<a class="register" href={resolve('/register')}>Register</a>
		{/if}
	</div>
</header>

<main>
	{@render children()}
</main>

<footer>
	<p>
		OpenBoard · GPL-3.0-or-later · <a href="https://github.com/BarbellDwarf/openboard">source</a>
	</p>
</footer>

<style>
	header {
		display: flex;
		align-items: center;
		gap: 1.5rem;
		padding: 0.7rem 1.4rem;
		border-bottom: 1px solid var(--walnut);
		background: rgb(15 27 20 / 92%);
		position: sticky;
		top: 0;
		z-index: 50;
		backdrop-filter: blur(6px);
	}
	.brand {
		font-family: 'Marcellus', serif;
		font-size: 21px;
		color: var(--parchment);
		text-decoration: none;
	}
	.main-nav {
		display: flex;
		gap: 0.25rem;
		flex: 1;
	}
	.main-nav a {
		color: var(--parchment);
		text-decoration: none;
		font-size: 14px;
		padding: 0.35rem 0.65rem;
		border-radius: 6px;
	}
	.main-nav a:hover,
	.main-nav a[aria-current='page'] {
		color: var(--amber);
		background: rgb(232 163 61 / 10%);
	}
	.right {
		display: flex;
		gap: 0.75rem;
		align-items: center;
	}
	.who {
		color: var(--lichen);
		font-size: 13px;
	}
	.right a {
		color: var(--parchment);
		text-decoration: none;
		font-size: 14px;
	}
	.register {
		border: 1px solid var(--amber);
		color: var(--amber) !important;
		border-radius: 6px;
		padding: 0.3rem 0.7rem;
	}
	button.signout,
	.right button {
		background: transparent;
		border: 1px solid var(--walnut);
		border-radius: 6px;
		color: var(--parchment);
		padding: 0.32rem 0.7rem;
		cursor: pointer;
		font-size: 13px;
	}
	main {
		min-height: calc(100vh - 110px);
	}
	footer {
		text-align: center;
		padding: 1.2rem;
		color: color-mix(in srgb, var(--parchment) 55%, transparent);
		font-size: 12px;
		border-top: 1px solid color-mix(in srgb, var(--walnut) 40%, transparent);
	}
	footer a {
		color: var(--walnut);
	}
	a:focus-visible,
	button:focus-visible {
		outline: 2px solid var(--amber);
		outline-offset: 2px;
	}
	@media (max-width: 700px) {
		header {
			flex-wrap: wrap;
			gap: 0.5rem;
		}
		.main-nav {
			order: 3;
			width: 100%;
			overflow-x: auto;
		}
	}
</style>
