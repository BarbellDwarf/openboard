import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit()],
	// Dev Socket.IO middleware plugin registers here in the realtime gateway ticket.
	test: {
		passWithNoTests: true
	}
});
