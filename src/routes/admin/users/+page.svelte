<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	function fmtDate(ms: number): string {
		return new Date(ms).toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}
</script>

<svelte:head><title>Members - OpenBoard</title></svelte:head>

<main class="members">
	<h1>Members</h1>
	<p class="count mono">{data.users.length} account{data.users.length === 1 ? '' : 's'}</p>

	{#if data.users.length === 0}
		<p class="empty">No accounts yet.</p>
	{:else}
		<table>
			<thead>
				<tr
					><th scope="col">Name</th><th scope="col">Email</th><th scope="col">Role</th><th
						scope="col">Joined</th
					></tr
				>
			</thead>
			<tbody>
				{#each data.users as u (u.id)}
					<tr>
						<td>{u.name}</td>
						<td>{u.email}</td>
						<td class="role">{u.admin ? 'Admin' : 'User'}</td>
						<td class="mono">{fmtDate(u.createdAtMs)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
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
</style>
