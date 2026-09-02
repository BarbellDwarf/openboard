<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
</script>

<main class="error-page">
	<p class="code">{page.status}</p>
	<h1>{page.status === 404 ? 'This square is empty.' : 'Something went sideways.'}</h1>
	<a href={resolve('/')}>Back to the board</a>
</main>

<style>
	.error-page {
		display: grid;
		place-items: center;
		min-height: 50vh;
		text-align: center;
		gap: 0.5rem;
	}
	.code {
		font-family: 'IBM Plex Mono', monospace;
		color: var(--walnut);
		font-size: 14px;
		margin: 0;
	}
	h1 {
		font-family: 'Marcellus', serif;
		color: var(--parchment);
		margin: 0;
	}
	a {
		color: var(--amber);
	}
</style>
