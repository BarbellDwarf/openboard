<script lang="ts">
	import { authClient } from '$lib/client/auth';

	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let email = $state('');
	let password = $state('');
	let error = $state<string | null>(null);
	let busy = $state(false);

	async function signIn(event: SubmitEvent) {
		event.preventDefault();
		error = null;
		busy = true;
		const result = await authClient.signIn.email({
			email,
			password,
			callbackURL: data.returnTo
		});
		busy = false;
		if (result.error) {
			error = result.error.message ?? 'Sign-in failed. Check your email and password.';
			return;
		}
		window.location.href = data.returnTo;
		return;
	}

	async function signInWithOidc() {
		error = null;
		await authClient.signIn.social({
			provider: data.oidcName,
			callbackURL: data.returnTo
		});
	}
</script>

<svelte:head><title>Sign in - OpenBoard</title></svelte:head>

<main class="auth-page">
	<h1>Sign in</h1>

	<form onsubmit={signIn}>
		<label for="email">Email</label>
		<input id="email" type="email" bind:value={email} required autocomplete="email" />

		<label for="password">Password</label>
		<input
			id="password"
			type="password"
			bind:value={password}
			required
			autocomplete="current-password"
		/>

		{#if error}
			<p class="error" role="alert">{error}</p>
		{/if}

		<button type="submit" disabled={busy} class="primary">
			{busy ? 'Signing in' : 'Sign in'}
		</button>
	</form>

	{#if data.oidcEnabled}
		<div class="divider"><span>or</span></div>
		<button type="button" class="secondary" onclick={signInWithOidc}>
			Sign in with {data.oidcName.toUpperCase()}
		</button>
	{/if}

	<p class="switch">
		New here? <a href="/register">Create an account</a>
	</p>
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
	label {
		display: block;
		color: var(--parchment);
		font-size: 14px;
		margin: 0.75rem 0 0.25rem;
	}
	input {
		width: 100%;
		box-sizing: border-box;
		padding: 0.6rem 0.7rem;
		border-radius: 6px;
		border: 1px solid var(--walnut);
		background: var(--baize);
		color: var(--parchment);
		font-family: inherit;
		font-size: 15px;
	}
	input:focus-visible {
		outline: 2px solid var(--amber);
		outline-offset: 1px;
	}
	button {
		width: 100%;
		padding: 0.65rem;
		border-radius: 6px;
		border: none;
		cursor: pointer;
		font-family: inherit;
		font-size: 15px;
		margin-top: 1rem;
	}
	button.primary {
		background: var(--amber);
		color: #211b10;
		font-weight: 600;
	}
	button.primary:hover {
		background: var(--amber-deep);
	}
	button.secondary {
		background: transparent;
		color: var(--parchment);
		border: 1px solid var(--walnut);
	}
	button.secondary:hover {
		border-color: var(--amber);
	}
	button:disabled {
		opacity: 0.55;
		cursor: wait;
	}
	.error {
		color: var(--flag-red);
		font-size: 14px;
		margin-top: 0.75rem;
	}
	.divider {
		text-align: center;
		color: var(--walnut);
		margin: 1rem 0;
	}
	.switch {
		margin-top: 1.25rem;
		color: var(--parchment);
		font-size: 14px;
	}
	a {
		color: var(--amber);
	}
	a:focus-visible,
	button:focus-visible {
		outline: 2px solid var(--amber);
		outline-offset: 2px;
	}
</style>
