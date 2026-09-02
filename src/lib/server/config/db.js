/**
 * Database pool stub.
 * The persistence ticket replaces this module with a real pg Pool built from
 * the validated DATABASE_URL.
 */
export const pool = {
	async end() {
		// Nothing to close yet.
	}
};
