// See https://svelte.dev/docs/kit/types#app.d.ts
import type { Session, User } from 'better-auth';

declare global {
	interface SocketData {
		userId?: string;
		userName?: string;
		/** Handshake-time snapshot for client affordances; never authoritative. */
		userRole?: string;
	}
	namespace App {
		interface Locals {
			session: Session | null;
			user: User | null;
		}
	}
}

export {};
