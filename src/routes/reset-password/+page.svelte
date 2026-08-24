<script lang="ts">
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let password = $state('');
	let busy = $state(false);

	const token = $derived(data.token);
</script>

<svelte:head><title>Reset password - OpenBoard</title></svelte:head>

<main class="auth-page">
	<h1>Reset password</h1>

	{#if form?.success}
		<p class="confirmation" role="status">
			Your password is changed. Sign in with the new one from now on.
		</p>
		<p class="switch"><a href="/login">Go to sign in</a></p>
	{:else if !data.hasToken}
		<p class="confirmation" role="status">
			This page needs a reset code. Ask an administrator for one, or use the forgot-password form
			when the server sends email.
		</p>
		<p class="switch"><a href="/forgot-password">Forgot password</a></p>
	{:else}
		<form method="POST" action="?/setPassword" onsubmit={() => (busy = true)}>
			<input type="hidden" name="token" value={token} />

			<label for="password">New password</label>
			<input
				id="password"
				name="password"
				type="password"
				bind:value={password}
				required
				minlength={10}
				autocomplete="new-password"
			/>

			{#if form?.error}
				<p class="error" role="alert">{form.error}</p>
			{/if}

			<button type="submit" disabled={busy} class="primary">
				{busy ? 'Saving' : 'Set new password'}
			</button>
		</form>
	{/if}

	<p class="switch"><a href="/login">Back to sign in</a></p>
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
	button:disabled {
		opacity: 0.55;
		cursor: wait;
	}
	.error {
		color: var(--flag-red);
		font-size: 14px;
		margin-top: 0.75rem;
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
	a:focus-visible,
	button:focus-visible {
		outline: 2px solid var(--amber);
		outline-offset: 2px;
	}
</style>
