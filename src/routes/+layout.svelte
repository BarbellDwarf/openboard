<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { invalidate } from '$app/navigation';
	import {
		currentPushSubscription,
		enablePush,
		notificationPermission,
		pushStatusMessage
	} from '$lib/client/push';

	let { data, children } = $props();

	const user = $derived(data.user);
	const unreadCount = $derived(data.unreadCount);
	const navLinks = [
		{ href: '/lobby', label: 'Lobby' },
		{ href: '/leaderboard', label: 'Leaderboards' },
		{ href: '/games', label: 'My games' },
		{ href: '/play-bot', label: 'Play a bot' }
	];

	let menuOpen = $state(false);
	let bellWrap: HTMLElement | null = $state(null);
	let pushBusy = $state(false);
	let pushMessage = $state<string | null>(null);
	/** null = not checked yet; true/false = whether a live subscription exists. */
	let pushEnabled = $state<boolean | null>(null);

	async function toggleMenu(): Promise<void> {
		menuOpen = !menuOpen;
		if (!menuOpen) return;
		pushMessage = null;
		if (notificationPermission() === 'unsupported') {
			pushEnabled = null;
			return;
		}
		const sub = await currentPushSubscription();
		pushEnabled = sub != null;
	}

	async function enable(): Promise<void> {
		pushBusy = true;
		try {
			const result = await enablePush();
			pushMessage = pushStatusMessage(result);
			if (result.ok) pushEnabled = true;
		} finally {
			pushBusy = false;
		}
	}

	function onWindowClick(event: MouseEvent): void {
		const target = event.target;
		if (menuOpen && bellWrap && target instanceof Node && !bellWrap.contains(target)) {
			menuOpen = false;
		}
	}

	function onWindowKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape') menuOpen = false;
	}

	// Light unread-badge polling: refresh only this layout's load every 30s
	// while the tab is visible, plus once when the tab becomes visible again.
	$effect(() => {
		if (!user) return;
		function refreshUnread(): void {
			if (document.visibilityState === 'visible') {
				void invalidate('app:notifications:unread');
			}
		}
		const timer = setInterval(refreshUnread, 30_000);
		document.addEventListener('visibilitychange', refreshUnread);
		return () => {
			clearInterval(timer);
			document.removeEventListener('visibilitychange', refreshUnread);
		};
	});

	async function signOut(): Promise<void> {
		await fetch('/logout', { method: 'POST' });
		window.location.href = resolve('/');
	}

	function active(href: string): boolean {
		return page.url.pathname.startsWith(href);
	}
</script>

<svelte:window onclick={onWindowClick} onkeydown={onWindowKeydown} />

<header>
	<a class="brand" href={resolve('/')}>OpenBoard</a>
	<nav class="main-nav" aria-label="Main">
		{#each navLinks as link (link.href)}
			<a href={link.href} aria-current={active(link.href) ? 'page' : undefined}>{link.label}</a>
		{/each}
	</nav>
	<div class="right">
		{#if user}
			<div class="bell-wrap" bind:this={bellWrap}>
				<button
					type="button"
					class="bell"
					aria-label="Notifications{unreadCount > 0 ? `, ${unreadCount} unread` : ''}"
					aria-haspopup="menu"
					aria-expanded={menuOpen}
					onclick={() => void toggleMenu()}
				>
					<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none">
						<path
							d="M12 3a6 6 0 0 0-6 6v3.2c0 .5-.2 1-.5 1.4L4 16h16l-1.5-2.4a2.6 2.6 0 0 1-.5-1.4V9a6 6 0 0 0-6-6Zm-2 15a2 2 0 0 0 4 0"
							stroke="currentColor"
							stroke-width="1.7"
							stroke-linecap="round"
							stroke-linejoin="round"
						/>
					</svg>
					{#if unreadCount > 0}
						<span class="badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
					{/if}
				</button>
				{#if menuOpen}
					<div class="bell-menu" role="menu" aria-label="Notifications">
						<a role="menuitem" href={resolve('/notifications')} onclick={() => (menuOpen = false)}>
							{unreadCount > 0 ? `Notifications (${unreadCount})` : 'Notifications'}
						</a>
						<div class="push-row">
							{#if !data.pushConfigured}
								<p class="quiet">Push isn't set up on this server.</p>
							{:else if notificationPermission() === 'unsupported'}
								<p class="quiet">This browser can't do web push.</p>
							{:else if pushEnabled === false}
								<button
									type="button"
									role="menuitem"
									disabled={pushBusy}
									onclick={() => void enable()}
								>
									{pushBusy ? 'Enabling…' : 'Enable push'}
								</button>
							{:else if pushEnabled === true && !pushMessage}
								<p class="quiet">Push notifications are on.</p>
							{/if}
							{#if pushMessage}<p class="quiet">{pushMessage}</p>{/if}
						</div>
					</div>
				{/if}
			</div>
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

	/* Notification bell: quiet by design; only the flag-red badge carries colour. */
	.bell-wrap {
		position: relative;
		display: flex;
	}
	.right .bell {
		position: relative;
		display: grid;
		place-items: center;
		width: 34px;
		height: 34px;
		padding: 0;
	}
	.right .bell:hover,
	.right .bell[aria-expanded='true'] {
		color: var(--amber);
		background: rgb(232 163 61 / 10%);
	}
	.badge {
		position: absolute;
		top: -4px;
		right: -6px;
		min-width: 16px;
		height: 16px;
		padding: 0 4px;
		border-radius: 999px;
		background: var(--flag-red);
		color: var(--parchment);
		font-family: var(--font-body);
		font-size: 10px;
		font-weight: 600;
		line-height: 16px;
		text-align: center;
	}
	.bell-menu {
		position: absolute;
		top: calc(100% + 8px);
		right: 0;
		z-index: 60;
		min-width: 240px;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		padding: 0.5rem;
		background: var(--baize-raised);
		border: 1px solid var(--walnut);
		border-radius: 8px;
		box-shadow: 0 8px 24px rgb(0 0 0 / 40%);
	}
	.bell-menu a,
	.push-row button {
		width: 100%;
		text-align: left;
		color: var(--parchment);
		text-decoration: none;
		font-size: 14px;
		padding: 0.4rem 0.55rem;
		border: none;
		border-radius: 6px;
		background: transparent;
		cursor: pointer;
	}
	.bell-menu a:hover,
	.push-row button:hover:not(:disabled) {
		color: var(--amber);
		background: rgb(232 163 61 / 10%);
	}
	.push-row button:disabled {
		opacity: 0.6;
		cursor: default;
	}
	.quiet {
		margin: 0;
		padding: 0 0.55rem;
		color: color-mix(in srgb, var(--parchment) 65%, transparent);
		font-size: 12px;
		line-height: 1.45;
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
