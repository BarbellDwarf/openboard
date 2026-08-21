<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	let { data, children } = $props();

	onMount(() => {
		if ('serviceWorker' in navigator) {
			void navigator.serviceWorker.register('/sw.js').catch(() => undefined);
		}
	});

	async function signOut() {
		await fetch('/logout', { method: 'POST' });
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		goto('/login');
	}
</script>

<header>
	<a class="brand" href={resolve('/')}>OpenBoard</a>
	<nav>
		{#if data.user}
			<span class="who">{data.user.name}</span>
			<button type="button" onclick={signOut}>Sign out</button>
		{:else}
			<a href={resolve('/login')}>Sign in</a>
			<a href={resolve('/register')}>Register</a>
		{/if}
	</nav>
</header>

<main>
	{@render children()}
</main>

<style>
	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem 1.25rem;
		border-bottom: 1px solid var(--walnut);
	}
	.brand {
		font-family: 'Marcellus', serif;
		font-size: 20px;
		color: var(--parchment);
		text-decoration: none;
	}
	nav {
		display: flex;
		gap: 1rem;
		align-items: center;
	}
	nav a {
		color: var(--parchment);
		text-decoration: none;
		font-size: 14px;
	}
	nav a:hover {
		color: var(--amber);
	}
	.who {
		color: var(--lichen);
		font-size: 14px;
	}
	button {
		background: transparent;
		border: 1px solid var(--walnut);
		border-radius: 6px;
		color: var(--parchment);
		padding: 0.35rem 0.7rem;
		cursor: pointer;
		font-size: 13px;
	}
	button:hover {
		border-color: var(--amber);
	}
	main {
		padding: 1rem;
	}
	a:focus-visible,
	button:focus-visible {
		outline: 2px solid var(--amber);
		outline-offset: 2px;
	}
</style>
