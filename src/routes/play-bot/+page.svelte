<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';

	const VARIANTS = [
		'standard',
		'chess960',
		'crazyhouse',
		'kingofthehill',
		'threecheck',
		'atomic',
		'horde',
		'racingkings'
	] as const;
	const SPEEDS = [
		{ id: 'bullet', label: 'Bullet 1+0' },
		{ id: 'blitz', label: 'Blitz 5+2' },
		{ id: 'rapid', label: 'Rapid 10+10' },
		{ id: 'classical', label: 'Classical 30+30' }
	] as const;
	const LEVELS = [
		{ id: 0, label: 'Level 1 · Beginner' },
		{ id: 1, label: 'Level 2 · Casual' },
		{ id: 2, label: 'Level 3 · Club' },
		{ id: 3, label: 'Level 4 · Strong' },
		{ id: 4, label: 'Level 5 · Ruthless' }
	] as const;

	let { data } = $props();

	// Deep links like /play-bot?variant=crazyhouse (the Learn pages hand
	// these out) preselect the ruleset instead of silently resetting to
	// standard; unknown values fall back.
	const requestedVariant = page.url.searchParams.get('variant');
	const initialVariant: (typeof VARIANTS)[number] = (VARIANTS as readonly string[]).includes(
		requestedVariant ?? ''
	)
		? (requestedVariant as (typeof VARIANTS)[number])
		: 'standard';

	let variant = $state<(typeof VARIANTS)[number]>(initialVariant);
	let speed = $state<(typeof SPEEDS)[number]['id']>('blitz');
	let colorChoice = $state<'white' | 'black' | 'random'>('random');
	let level = $state<number>(2);
	let busy = $state(false);
	let error = $state<string | null>(null);

	async function start(): Promise<void> {
		busy = true;
		error = null;
		try {
			const res = await fetch('/api/challenges', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'create-solo',
					variant,
					speedClass: speed,
					colorChoice,
					level
				})
			});
			const body = (await res.json()) as { ok?: boolean; gameId?: string };
			if (!res.ok || !body.ok || !body.gameId) {
				error = 'Could not start the game. Try again.';
				return;
			}
			await goto(`/play-bot/${body.gameId}?level=${level}`, { invalidateAll: true });
		} catch {
			error = 'Could not reach the server.';
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head><title>Play a bot - OpenBoard</title></svelte:head>

<main>
	<section class="panel">
		<h1>Play a bot</h1>
		<p class="muted">Casual solo game against a built-in opponent. Untitled, unrated.</p>

		{#if !data.user}
			<p class="muted">
				<a href="/login?returnTo=/play-bot">Sign in</a> to play a bot.
			</p>
		{:else}
			<div class="fields">
				<label>
					<span>Variant</span>
					<select bind:value={variant}>
						{#each VARIANTS as v (v)}
							<option value={v}>{v}</option>
						{/each}
					</select>
				</label>
				<label>
					<span>Time control</span>
					<select bind:value={speed}>
						{#each SPEEDS as s (s.id)}
							<option value={s.id}>{s.label}</option>
						{/each}
					</select>
				</label>
				<label>
					<span>Bot strength</span>
					<select bind:value={level}>
						{#each LEVELS as l (l.id)}
							<option value={l.id}>{l.label}</option>
						{/each}
					</select>
				</label>
				<label>
					<span>Your color</span>
					<select bind:value={colorChoice}>
						<option value="white">White</option>
						<option value="black">Black</option>
						<option value="random">Random</option>
					</select>
				</label>
			</div>
			<div class="row">
				<button type="button" class="primary" disabled={busy} onclick={() => void start()}>
					{busy ? 'Starting...' : 'Start game'}
				</button>
			</div>
			{#if error}<p class="error" role="alert">{error}</p>{/if}
		{/if}
	</section>
</main>

<style>
	.panel {
		max-width: 26rem;
		margin: 3rem auto;
		padding: 1.5rem;
		border: 1px solid var(--walnut);
		border-radius: 12px;
		background: var(--baize-raised);
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	h1 {
		font-size: 1.25rem;
		color: var(--parchment);
		margin: 0;
	}
	.muted {
		color: var(--lichen);
		margin: 0;
		font-size: 0.9rem;
	}
	.fields {
		display: grid;
		gap: 0.75rem;
	}
	label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		color: var(--parchment);
		font-size: 0.85rem;
	}
	select {
		padding: 0.45rem 0.5rem;
		border-radius: 8px;
		border: 1px solid var(--walnut);
		background: var(--baize);
		color: var(--parchment);
	}
	.row {
		display: flex;
		gap: 0.5rem;
	}
	button.primary {
		padding: 0.55rem 1.1rem;
		border-radius: 8px;
		border: none;
		cursor: pointer;
		background: var(--amber);
		color: var(--ink);
		font-weight: 600;
	}
	button.primary:disabled {
		opacity: 0.6;
		cursor: default;
	}
	.error {
		color: var(--flag-red);
		margin: 0;
		font-size: 0.85rem;
	}
	@media (max-width: 640px) {
		.panel {
			margin: 1.25rem 1rem;
			padding: 1.25rem;
		}
		select {
			min-height: 44px;
			font-size: 16px; /* keeps iOS from zooming on focus */
		}
		button.primary {
			width: 100%;
			min-height: 44px;
			font-size: 16px;
		}
	}
</style>
