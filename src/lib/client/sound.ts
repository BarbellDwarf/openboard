/**
 * Gameplay sound effects driven by the shared preferences store.
 *
 * Each helper reads the live enabled/volume values from the preferences
 * store at call time, so toggling mute or dragging the slider takes effect
 * immediately — no component re-render required.
 */

import { get } from 'svelte/store';
import { preferences } from './preferences';

const BASE = '/sounds/openboard';

function play(file: string): void {
	const { soundsEnabled, soundVolume } = get(preferences);
	if (!soundsEnabled) return;
	const audio = new Audio(`${BASE}/${file}`);
	audio.volume = soundVolume / 100;
	void audio.play();
}

export function playMove(): void {
	play('move.wav');
}

export function playCapture(): void {
	play('capture.wav');
}

export function playCheck(): void {
	play('check.wav');
}

export function playLowTime(): void {
	play('lowtime.wav');
}

export function playGameEnd(): void {
	play('gameend.wav');
}
