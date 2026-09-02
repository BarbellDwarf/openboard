import { beforeEach, describe, expect, it, vi } from 'vitest';

import { hydratePreferences } from './preferences';
import { playCapture, playCheck, playGameEnd, playLowTime, playMove } from './sound';

/* ------------------------------------------------------------------ */
/*  Stub the global Audio constructor so no real file is fetched.      */
/* ------------------------------------------------------------------ */

interface MockAudio {
	volume: number;
	play: ReturnType<typeof vi.fn>;
}

let lastAudio: MockAudio | null = null;

beforeEach(() => {
	hydratePreferences(null); // reset to defaults (soundsEnabled: true, volume: 70)
	lastAudio = null;
	vi.stubGlobal(
		'Audio',
		class {
			volume = 1;
			play = vi.fn();
			constructor(_src?: string) {
				lastAudio = this as unknown as MockAudio;
			}
		}
	);
});

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('playMove', () => {
	it('creates an Audio element and calls play', () => {
		playMove();
		expect(lastAudio).not.toBeNull();
		expect(lastAudio!.play).toHaveBeenCalledOnce();
	});

	it('sets volume from the preferences store (default 70%)', () => {
		playMove();
		expect(lastAudio!.volume).toBeCloseTo(0.7);
	});

	it('maps volume 0 to 0', () => {
		hydratePreferences({ soundVolume: 0 });
		playMove();
		expect(lastAudio!.volume).toBe(0);
	});

	it('maps volume 100 to 1', () => {
		hydratePreferences({ soundVolume: 100 });
		playMove();
		expect(lastAudio!.volume).toBe(1);
	});
});

describe('gating', () => {
	it('skips Audio creation entirely when sounds are disabled', () => {
		hydratePreferences({ soundsEnabled: false });
		playMove();
		expect(lastAudio).toBeNull();
	});

	it('does not call play when sounds are disabled', () => {
		hydratePreferences({ soundsEnabled: false });
		playCapture();
		playCheck();
		playLowTime();
		playGameEnd();
		expect(lastAudio).toBeNull();
	});

	it('resumes playback when sounds are re-enabled', () => {
		hydratePreferences({ soundsEnabled: false });
		playCheck();
		expect(lastAudio).toBeNull();

		hydratePreferences({ soundsEnabled: true });
		playCheck();
		expect(lastAudio).not.toBeNull();
		expect(lastAudio!.play).toHaveBeenCalledOnce();
	});
});

describe('each function maps to the correct asset', () => {
	it('playCapture uses capture.wav', () => {
		hydratePreferences({ soundVolume: 50 });
		playCapture();
		expect(lastAudio!.volume).toBeCloseTo(0.5);
		expect(lastAudio!.play).toHaveBeenCalledOnce();
	});

	it('playGameEnd uses gameend.wav', () => {
		playGameEnd();
		expect(lastAudio!.play).toHaveBeenCalledOnce();
	});

	it('playLowTime uses lowtime.wav', () => {
		playLowTime();
		expect(lastAudio!.play).toHaveBeenCalledOnce();
	});

	it('playCheck uses check.wav', () => {
		playCheck();
		expect(lastAudio!.play).toHaveBeenCalledOnce();
	});
});
