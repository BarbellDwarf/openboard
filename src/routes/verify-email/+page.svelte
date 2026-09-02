<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>Verify email - OpenBoard</title></svelte:head>

<main class="auth-page">
	<h1>Verify email</h1>

	{#if data.state === 'verified'}
		<p class="confirmation" role="status">Your email address is confirmed. Thank you.</p>
	{:else if data.state === 'missing'}
		<p class="confirmation" role="status">This page needs the link from your verification email.</p>
	{:else}
		<p class="confirmation" role="status">
			This verification link does not work. It may have expired; sign in and request a fresh one.
		</p>
	{/if}

	<p class="switch"><a href="/">Back to OpenBoard</a></p>
</main>

<style>
	.auth-page {
		max-width: 380px;
		margin: 8vh auto 0;
		padding: 2rem;
		background: var(--baize-raised);
		border: 1px solid var(--walnut);
		border-radius: 10px;
	}
	h1 {
		font-family: 'Marcellus', serif;
		color: var(--parchment);
		font-size: 28px;
		margin-bottom: 1.5rem;
	}
	.confirmation {
		color: var(--parchment);
		font-size: 15px;
		background: var(--baize);
		border: 1px solid var(--walnut);
		border-radius: 6px;
		padding: 0.9rem 1rem;
	}
	.switch {
		margin-top: 1.25rem;
		color: var(--parchment);
		font-size: 14px;
	}
	a {
		color: var(--amber);
	}
	a:focus-visible {
		outline: 2px solid var(--amber);
		outline-offset: 2px;
	}
	@media (max-width: 480px) {
		.auth-page {
			margin-top: 4vh;
			padding: 1.5rem 1.25rem;
		}
	}
</style>
