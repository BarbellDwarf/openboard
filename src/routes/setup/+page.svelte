<script lang="ts">
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	const error = $derived(form?.error ?? null);
	const setupComplete = $derived(data.setupComplete || !!form?.setupComplete);
</script>

<svelte:head><title>Set up OpenBoard</title></svelte:head>

<main class="auth-page">
	{#if setupComplete}
		<h1>Setup is complete</h1>
		<p class="note">This server already has an administrator. The setup wizard is closed.</p>
		<p class="switch"><a href="/">Back to the clubroom</a></p>
	{:else}
		<h1>Set up OpenBoard</h1>
		<p class="lede">
			Create the administrator account for this server. The wizard closes as soon as an admin
			exists.
		</p>

		<form method="POST">
			<label for="name">Username</label>
			<input id="name" name="name" required minlength="3" maxlength="24" />

			<label for="email">Email</label>
			<input id="email" name="email" type="email" required autocomplete="email" />

			<label for="password">Password</label>
			<input
				id="password"
				name="password"
				type="password"
				required
				minlength="10"
				autocomplete="new-password"
			/>
			<p class="hint">At least 10 characters.</p>

			{#if error}
				<p class="error" role="alert">{error}</p>
			{/if}

			<button type="submit" class="primary">Create administrator</button>
		</form>
	{/if}
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
	.lede {
		color: color-mix(in srgb, var(--parchment) 75%, transparent);
		font-size: 14px;
		line-height: 1.5;
		margin: -0.75rem 0 1rem;
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
	.error {
		color: var(--flag-red);
		font-size: 14px;
		margin-top: 0.75rem;
	}
	.note {
		color: var(--parchment);
		font-size: 14px;
		line-height: 1.5;
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
