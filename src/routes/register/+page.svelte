<script lang="ts">
	import { authClient } from '$lib/client/auth';

	let name = $state('');
	let email = $state('');
	let password = $state('');
	let error = $state<string | null>(null);
	let busy = $state(false);

	async function register(event: SubmitEvent) {
		event.preventDefault();
		error = null;
		if (password.length < 10) {
			error = 'Password needs at least 10 characters.';
			return;
		}
		busy = true;
		const result = await authClient.signUp.email({ name, email, password, callbackURL: '/' });
		busy = false;
		if (result.error) {
			error = result.error.message ?? 'Registration failed. Try a different email.';
			return;
		}
		window.location.href = '/';
		return;
	}
</script>

<svelte:head><title>Create an account - OpenBoard</title></svelte:head>

<main class="auth-page">
	<h1>Create an account</h1>

	<form onsubmit={register}>
		<label for="name">Username</label>
		<input id="name" bind:value={name} required minlength="3" maxlength="24" />

		<label for="email">Email</label>
		<input id="email" type="email" bind:value={email} required autocomplete="email" />

		<label for="password">Password</label>
		<input
			id="password"
			type="password"
			bind:value={password}
			required
			minlength="10"
			autocomplete="new-password"
		/>
		<p class="hint">At least 10 characters.</p>

		{#if error}
			<p class="error" role="alert">{error}</p>
		{/if}

		<button type="submit" disabled={busy} class="primary">
			{busy ? 'Creating account' : 'Create account'}
		</button>
	</form>

	<p class="switch">
		Already registered? <a href="/login">Sign in</a>
	</p>
</main>

<style>
	.auth-page {
		max-width: 380px;
		margin: 8vh auto 0;
		padding: var(--space-6, 2rem);
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
	.hint {
		color: var(--walnut);
		font-size: 12px;
		margin-top: 0.25rem;
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
		background: var(--amber);
		color: var(--on-primary);
		font-weight: 600;
	}
	button:hover {
		background: var(--amber-deep);
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
