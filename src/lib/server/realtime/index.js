/**
 * Realtime gateway injection point.
 * The realtime gateway ticket replaces this file with the full Socket.IO
 * implementation for game rooms, clocks, and presence.
 *
 * @param {import('socket.io').Server} _io Socket.IO server attached to the HTTP server.
 */
export function injectSocketIO(_io) {
	// No-op until the gateway implementation lands.
}
