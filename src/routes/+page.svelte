<main>
	<h1>OpenBoard</h1>
	<p>A self-hostable online chess platform.</p>
	<button class="primary" type="button">Create a game</button>
</main>

<style>
	main {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1.5rem;
		text-align: center;
		padding: 2rem;
	}

	h1 {
		font-family: var(--font-display);
		font-weight: 400;
		font-size: 3.5rem;
		line-height: 1.1;
		margin: 0;
		color: var(--parchment);
	}

	p {
		margin: 0;
		color: var(--lichen);
	}

	.primary {
		font-family: var(--font-body);
		font-weight: 600;
		font-size: 1rem;
		background-color: var(--amber);
		color: var(--ink);
		border: none;
		border-radius: 0.375rem;
		padding: 0.75rem 1.75rem;
		cursor: pointer;
	}

	.primary:hover {
		background-color: var(--amber-deep);
	}
</style>
