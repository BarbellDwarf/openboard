<script lang="ts">
	import { onMount } from 'svelte';

	import { getSocket } from '$lib/client/socket';

	let { gameId }: { gameId: string; yourColor?: 'white' | 'black' | null } = $props();

	interface ChatLine {
		id: number;
		userId: string;
		name: string;
		body: string;
		mine?: boolean;
	}

	let messages = $state<ChatLine[]>([]);
	let draft = $state('');
	let listEl: HTMLElement | null = null;
	let rateLimited = $state(false);

	function scrollDown(): void {
		if (listEl) listEl.scrollTop = listEl.scrollHeight;
	}

	onMount(() => {
		let offChat: (() => void) | null = null;
		void (async () => {
			const socket = await getSocket();
			const onChat = (m: ChatLine) => {
				messages = [...messages, m];
				setTimeout(scrollDown, 20);
			};
			socket.on('game:chat', onChat);
			offChat = () => socket.off('game:chat', onChat);
			socket.emit('game:chat-history', { gameId }, (r: { messages: ChatLine[] }) => {
				messages = r.messages ?? [];
				setTimeout(scrollDown, 20);
			});
		})();
		return () => offChat?.();
	});

	async function send(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (!draft.trim()) return;
		const socket = await getSocket();
		socket
			.timeout(4000)
			.emit('game:chat-send', { gameId, body: draft }, (err: unknown, ack?: { ok?: boolean }) => {
				// A server-side rejection also arrives as a normal ack with ok:false.
				rateLimited = !!err || ack?.ok === false;
				if (rateLimited) setTimeout(() => (rateLimited = false), 3000);
			});
		draft = '';
	}
</script>

<form class="chat" onsubmit={send}>
	<div class="lines" bind:this={listEl} aria-live="polite">
		{#each messages as m (m.id)}
			<p><span class="who">{m.name}:</span> {m.body}</p>
		{:else}
			<p class="none muted">Say hello.</p>
		{/each}
	</div>
	<input bind:value={draft} maxlength="500" placeholder="Message" aria-label="Chat message" />
	<button type="submit" disabled={!draft.trim()}>Send</button>
</form>

<style>
	.chat {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.lines {
		max-height: 180px;
		min-height: 90px;
		overflow-y: auto;
		display: flex;
		/* Normal order only: messages render first-to-last, newest at the
		   bottom, matching scrollDown()'s scrollTop = scrollHeight. The old
		   column-reverse put the newest line at the visual top while that
		   assignment scrolled to the content start (the oldest message). */
		flex-direction: column;
		font-size: 13px;
		color: var(--parchment);
	}
	p {
		margin: 0.1rem 0;
		overflow-wrap: anywhere;
	}
	.who {
		color: var(--amber);
	}
	input {
		background: var(--baize);
		border: 1px solid var(--walnut);
		border-radius: 6px;
		color: var(--parchment);
		padding: 0.4rem 0.55rem;
		font-family: inherit;
		font-size: 13px;
		width: 100%;
		box-sizing: border-box;
	}
	button {
		border-radius: 6px;
		border: 1px solid var(--walnut);
		background: transparent;
		color: var(--parchment);
		padding: 0.35rem 0.7rem;
		cursor: pointer;
		font-size: 12px;
	}
	button:hover:not(:disabled) {
		border-color: var(--amber);
	}
	.none {
		color: var(--walnut);
	}
</style>
