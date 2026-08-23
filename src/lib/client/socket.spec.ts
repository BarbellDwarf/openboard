import { describe, expect, it, vi } from 'vitest';
import type { Socket } from 'socket.io-client';

import { ACK_TIMEOUT_MS, AckTimeoutError, emitAck } from './socket';

function fakeSocket(behavior: (event: string, ack?: (response: unknown) => void) => void): Socket {
	return {
		emit: vi.fn((event: string, _payload: unknown, ack?: (response: unknown) => void) => {
			behavior(event, ack);
		})
	} as unknown as Socket;
}

describe('emitAck', () => {
	it('resolves with the server acknowledgement', async () => {
		const socket = fakeSocket((_event, ack) => ack?.({ ok: true }));
		await expect(emitAck<{ ok: boolean }>(socket, 'game:join', {})).resolves.toEqual({ ok: true });
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

	it('ignores a late ack that arrives after the timeout fired', async () => {
		vi.useFakeTimers();
		try {
			let pending: ((response: unknown) => void) | undefined;
			const socket = fakeSocket((_event, ack) => {
				pending = ack;
			});
			const outcome = emitAck(socket, 'game:move', {}).catch((error) => error);
			await vi.advanceTimersByTimeAsync(ACK_TIMEOUT_MS + 1);
			expect(await outcome).toBeInstanceOf(AckTimeoutError);
			expect(() => pending?.({ ok: true })).not.toThrow();
		} finally {
			vi.useRealTimers();
		}
	});
});
