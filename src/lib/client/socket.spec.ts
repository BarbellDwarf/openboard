import { describe, expect, it, vi } from 'vitest';
import type { Socket } from 'socket.io-client';

import { ACK_TIMEOUT_MS, AckTimeoutError, emitAck } from './socket';

/**
 * emitAck leans on socket.timeout(), so the fake reproduces socket.io's
 * contract: arming a timeout registers a reaper that fires the ack callback
 * with an Error after the window lapses, and every callback receives
 * (error, response).
 */

type Ack = (error: unknown, response?: unknown) => void;

interface FakeSocket extends Socket {
	timeoutCalls: number[];
	pendingAck: Ack | undefined;
}

function fakeSocket(behavior: (event: string, ack?: Ack) => void): FakeSocket {
	const socket = {
		timeoutCalls: [] as number[],
		pendingAck: undefined as Ack | undefined
	} as unknown as FakeSocket;

	socket.timeout = vi.fn((ms: number) => {
		socket.timeoutCalls.push(ms);
		setTimeout(() => socket.pendingAck?.(new Error('operation has timed out')), ms);
		return socket;
	});
	socket.emit = vi.fn(((event: string, _payload: unknown, ack?: Ack) => {
		socket.pendingAck = ack;
		behavior(event, ack);
	}) as unknown as FakeSocket['emit']);

	return socket;
}

describe('emitAck', () => {
	it("arms socket.io's reaper with exactly ACK_TIMEOUT_MS", () => {
		const socket = fakeSocket(() => {
			/* never acknowledges */
		});
		void emitAck(socket, 'game:join', {});
		expect(socket.timeoutCalls).toEqual([ACK_TIMEOUT_MS]);
	});

	it('resolves with the server acknowledgement', async () => {
		const socket = fakeSocket((_event, ack) => ack?.(null, { ok: true }));
		await expect(emitAck<{ ok: boolean }>(socket, 'game:join', {})).resolves.toEqual({
			ok: true
		});
	});

	it(`stays pending until ${ACK_TIMEOUT_MS}ms, then rejects with AckTimeoutError`, async () => {
		vi.useFakeTimers();
		try {
			const socket = fakeSocket(() => {
				/* never acknowledges */
			});
			let settled = false;
			const outcome = emitAck(socket, 'game:move', {}).then(
				() => {
					settled = true;
					return null;
				},
				(error) => {
					settled = true;
					return error;
				}
			);
			await vi.advanceTimersByTimeAsync(ACK_TIMEOUT_MS - 1);
			expect(settled).toBe(false);
			await vi.advanceTimersByTimeAsync(1);
			expect(await outcome).toBeInstanceOf(AckTimeoutError);
		} finally {
			vi.useRealTimers();
		}
	});

	it('maps the raw socket.io timeout error onto AckTimeoutError', async () => {
		vi.useFakeTimers();
		try {
			const socket = fakeSocket(() => {
				/* never acknowledges */
			});
			const outcome = emitAck(socket, 'game:move', {}).catch((error) => error);
			await vi.advanceTimersByTimeAsync(ACK_TIMEOUT_MS);
			const error = await outcome;
			expect(error).toBeInstanceOf(AckTimeoutError);
			expect((error as Error).message).toContain('game:move');
		} finally {
			vi.useRealTimers();
		}
	});

	it('ignores a late ack that arrives after the timeout fired', async () => {
		vi.useFakeTimers();
		try {
			const socket = fakeSocket(() => {
				/* never acknowledges */
			});
			const outcome = emitAck(socket, 'game:move', {}).catch((error) => error);
			await vi.advanceTimersByTimeAsync(ACK_TIMEOUT_MS + 1);
			expect(await outcome).toBeInstanceOf(AckTimeoutError);
			// The reaper has released the callback; a straggler response is inert.
			expect(() => socket.pendingAck?.(null, { ok: true })).not.toThrow();
		} finally {
			vi.useRealTimers();
		}
	});
});
