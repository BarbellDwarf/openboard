<script lang="ts">
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	function fmtDate(ms: number): string {
		return new Date(ms).toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	let busyFor: string | null = $state(null);
	let copied = $state(false);

	async function copyToken() {
		if (!form?.issued) return;
		try {
			await navigator.clipboard.writeText(form.issued.token);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			// Clipboard access denied; the token stays selectable in the box.
		}
	}
</script>

<svelte:head><title>Members - OpenBoard</title></svelte:head>

<main class="members">
	<h1>Members</h1>
	<p class="count mono">{data.users.length} account{data.users.length === 1 ? '' : 's'}</p>

	{#if form?.error}
		<p class="error" role="alert">{form.error}</p>
	{/if}

	{#if form?.issued}
		<aside class="token-box">
			<h2>Reset link for {form.issued.name}</h2>
			<p>
				Give this one-time code to the player. They finish the reset at
				<code>/reset-password</code>. It expires in 24 hours and is shown only this once.
			</p>
			<div class="token mono">{form.issued.token}</div>
			<button type="button" class="secondary" onclick={copyToken}>
				{copied ? 'Copied' : 'Copy'}
			</button>
		</aside>
	{/if}

	{#if data.users.length === 0}
		<p class="empty">No accounts yet.</p>
	{:else}
		<div class="table-scroll">
			<table>
				<thead>
					<tr
						><th scope="col">Name</th><th scope="col">Email</th><th scope="col">Role</th><th
							scope="col">Joined</th
						><th scope="col"><span class="visually-hidden">Actions</span></th></tr
					>
				</thead>
				<tbody>
					{#each data.users as u (u.id)}
						<tr>
							<td>{u.name}</td>
							<td>
								{u.email}
								<span class="verified">({u.emailVerified ? 'verified' : 'unverified'})</span>
							</td>
							<td class="role">{u.admin ? 'Admin' : 'User'}</td>
							<td class="mono">{fmtDate(u.createdAtMs)}</td>
							<td>
								<form method="POST" action="?/resetPassword" onsubmit={() => (busyFor = u.id)}>
									<input type="hidden" name="userId" value={u.id} />
									<button type="submit" class="secondary small" disabled={busyFor !== null}>
										{busyFor === u.id ? 'Generating' : 'Reset password'}
									</button>
								</form>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</main>

<style>
	.members {
		max-width: 720px;
		margin: 2rem auto 0;
		padding: 0 1rem;
	}
	h1 {
		font-family: 'Marcellus', serif;
		color: var(--parchment);
		font-size: 28px;
		margin-bottom: 0.25rem;
	}
	.count {
		color: var(--lichen);
		font-size: 13px;
		margin: 0 0 1rem;
	}
	.table-scroll {
		position: relative;
		overflow-x: auto;
	}
	table {
		width: 100%;
		border-collapse: collapse;
		background: var(--baize-raised);
		border: 1px solid var(--walnut);
		border-radius: 8px;
		overflow: hidden;
	}
	th,
	td {
		padding: 0.55rem 0.9rem;
		text-align: left;
		border-bottom: 1px solid color-mix(in srgb, var(--walnut) 40%, transparent);
	}
	th {
		color: var(--parchment);
		font-size: 12px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	td {
		color: var(--parchment);
		font-size: 14px;
		overflow-wrap: anywhere;
	}
	tbody tr:hover {
		background: rgb(232 163 61 / 8%);
	}
	.role {
		color: var(--amber);
		font-size: 13px;
	}
	.mono {
		font-family: 'IBM Plex Mono', monospace;
	}
	.empty {
		color: var(--parchment);
	}
	.verified {
		color: var(--lichen);
		font-size: 12px;
	}
	form {
		margin: 0;
	}
	button.secondary {
		background: transparent;
		color: var(--parchment);
		border: 1px solid var(--walnut);
		border-radius: 6px;
		padding: 0.35rem 0.7rem;
		cursor: pointer;
		font-family: inherit;
		font-size: 13px;
	}
	button.secondary:hover {
		border-color: var(--amber);
	}
	button:disabled {
		opacity: 0.55;
		cursor: wait;
	}
	button:focus-visible {
		outline: 2px solid var(--amber);
		outline-offset: 2px;
	}
	.token-box {
		background: var(--baize-raised);
		border: 1px solid var(--amber);
		border-radius: 8px;
		padding: 1rem 1.25rem;
		margin-bottom: 1.5rem;
	}
	.token-box h2 {
		font-family: 'Marcellus', serif;
		color: var(--parchment);
		font-size: 18px;
		margin: 0 0 0.5rem;
	}
	.token-box p {
		color: var(--parchment);
		font-size: 14px;
		margin: 0 0 0.75rem;
	}
	.token {
		background: var(--baize);
		border: 1px solid var(--walnut);
		border-radius: 6px;
		padding: 0.6rem 0.75rem;
		color: var(--amber);
		font-size: 14px;
		overflow-wrap: anywhere;
		user-select: all;
		margin-bottom: 0.75rem;
	}
	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}
	/* Narrow screens scroll the table inside its own panel; the page itself
	   never grows a horizontal scrollbar. */
	.table-scroll {
		overflow-x: auto;
		-webkit-overflow-scrolling: touch;
	}
	@media (max-width: 640px) {
		.members {
			margin-top: 1rem;
		}
		table {
			min-width: 560px;
		}
		th,
		td {
			padding: 0.5rem 0.6rem;
		}
		button.secondary {
			min-height: 44px;
		}
	}
</style>
