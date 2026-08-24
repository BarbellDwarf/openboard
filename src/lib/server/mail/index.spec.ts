import { afterEach, describe, expect, it, vi } from 'vitest';

import { isMailConfigured, mailConfigFromEnv, sendMail } from './index';

/**
 * The mailer is optional infrastructure: every consumer must cope with a
 * server that has no SMTP at all. These tests pin the honest degradation:
 * unset env reads as unconfigured and sends resolve false without touching
 * the network or throwing.
 */

const SMTP_KEYS = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'] as const;

function clearSmtpEnv() {
	for (const key of SMTP_KEYS) vi.stubEnv(key, '');
}

afterEach(() => {
	vi.unstubAllEnvs();
});

describe('isMailConfigured', () => {
	it('answers false when nothing is set', () => {
		clearSmtpEnv();
		expect(isMailConfigured()).toBe(false);
	});

	it('needs a host and a from address together', () => {
		vi.stubEnv('SMTP_HOST', 'smtp.example.com');
		expect(isMailConfigured()).toBe(false);

		clearSmtpEnv();
		vi.stubEnv('SMTP_FROM', 'OpenBoard <no-reply@example.com>');
		expect(isMailConfigured()).toBe(false);

		vi.stubEnv('SMTP_HOST', 'smtp.example.com');
		expect(isMailConfigured()).toBe(true);
	});
});

describe('mailConfigFromEnv', () => {
	it('defaults the port to 587 and turns on TLS only for 465', () => {
		clearSmtpEnv();
		vi.stubEnv('SMTP_HOST', 'smtp.example.com');
		vi.stubEnv('SMTP_FROM', 'no-reply@example.com');

		const config = mailConfigFromEnv();
		expect(config).toMatchObject({ host: 'smtp.example.com', port: 587, secure: false });

		vi.stubEnv('SMTP_PORT', '465');
		expect(mailConfigFromEnv()).toMatchObject({ port: 465, secure: true });
	});

	it('keeps credentials optional', () => {
		clearSmtpEnv();
		vi.stubEnv('SMTP_HOST', 'smtp.example.com');
		vi.stubEnv('SMTP_FROM', 'no-reply@example.com');
		expect(mailConfigFromEnv()?.user).toBeUndefined();

		vi.stubEnv('SMTP_USER', 'openboard');
		vi.stubEnv('SMTP_PASS', 'secret-pass');
		expect(mailConfigFromEnv()).toMatchObject({ user: 'openboard', pass: 'secret-pass' });
	});
});

describe('sendMail without SMTP', () => {
	it('resolves false and never throws when unconfigured', async () => {
		clearSmtpEnv();
		await expect(sendMail({ to: 'player@example.com', subject: 'Hi', text: 'Body' })).resolves.toBe(
			false
		);
	});
});
