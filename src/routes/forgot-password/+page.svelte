<script lang="ts">
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let email = $state('');
	let busy = $state(false);

	// One message for every outcome. The server never says whether the
	// address exists, so this page cannot enumerate accounts.
	const neutralConfirmation =
		'If an account exists for that address, password reset instructions are on their way. They arrive within a few minutes.';
</script>

<svelte:head><title>Forgot password - OpenBoard</title></svelte:head>

<main class="auth-page">
	<h1>Forgot password</h1>

	{#if form?.sent}
		<p class="confirmation" role="status">{neutralConfirmation}</p>
	{:else}
		<form method="POST" action="?/request" onsubmit={() => (busy = true)}>
			<label for="email">Email</label>
			<input
				id="email"
				name="email"
				type="email"
				bind:value={email}
				required
				autocomplete="email"
			/>

			{#if form?.error}
				<p class="error" role="alert">{form.error}</p>
			{/if}

			<button type="submit" disabled={busy} class="primary">
				{busy ? 'Sending' : 'Send reset link'}
			</button>
		</form>
	{/if}

	{#if !data.mailEnabled}
		<p class="note">
			This server has no outgoing email configured. An administrator can hand you a reset code from
			the members page instead.
		</p>
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
		color: var(--on-primary);
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
	.note {
		color: var(--lichen);
		font-size: 13px;
		margin-top: 1rem;
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
	@media (max-width: 480px) {
		.auth-page {
			margin-top: 4vh;
			padding: 1.5rem 1.25rem;
		}
		input {
			font-size: 16px; /* keeps iOS from zooming on focus */
			padding: 0.7rem;
		}
		button {
			font-size: 16px;
			padding: 0.8rem;
		}
	}
</style>
