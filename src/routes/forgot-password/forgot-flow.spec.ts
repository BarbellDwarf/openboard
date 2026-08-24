import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The forgot-password form must be unusable for account enumeration:
 * unknown addresses, disabled SMTP, and provider failures all return the
 * exact same neutral confirmation.
 */

const authMock = vi.hoisted(() => ({
	auth: {
		api: {
			requestPasswordReset: vi.fn()
		}
	}
}));
vi.mock('$lib/server/auth', () => authMock);

const mailMock = vi.hoisted(() => ({
	isMailConfigured: vi.fn(() => true)
}));
vi.mock('$lib/server/mail', () => mailMock);

import { actions, load } from './+page.server';

type ActionEvent = Parameters<typeof actions.request>[0];

function actionEvent(email: string): ActionEvent {
	const form = new FormData();
	form.append('email', email);
	return {
		request: new Request('https://openboard.example.com/forgot-password', {
			method: 'POST',
			body: form
		})
	} as unknown as ActionEvent;
}

beforeEach(() => {
	vi.clearAllMocks();
	authMock.auth.api.requestPasswordReset.mockResolvedValue({ status: true });
	mailMock.isMailConfigured.mockReturnValue(true);
});

describe('request action', () => {
	it('answers with the neutral confirmation on success', async () => {
		const result = await actions.request(actionEvent('keeper@example.com'));

		expect(result).toEqual({ sent: true });
		expect(authMock.auth.api.requestPasswordReset).toHaveBeenCalledWith({
			body: { email: 'keeper@example.com', redirectTo: '/reset-password' }
		});
	});

	it('answers identically when better-auth reports an unknown address', async () => {
		authMock.auth.api.requestPasswordReset.mockRejectedValue(new Error('User not found'));

		const result = await actions.request(actionEvent('nobody@example.com'));
		expect(result).toEqual({ sent: true });
	});

	it('answers identically when outgoing mail is disabled', async () => {
		authMock.auth.api.requestPasswordReset.mockRejectedValue(
			new Error("Reset password isn't enabled")
		);

		await expect(actions.request(actionEvent('anyone@example.com'))).resolves.toEqual({
			sent: true
		});
	});

	it('rejects malformed input before touching auth', async () => {
		const result = await actions.request(actionEvent('not-an-email'));

		expect(result).toMatchObject({ status: 422 });
		expect(authMock.auth.api.requestPasswordReset).not.toHaveBeenCalled();
	});
});

describe('load', () => {
	it('reports whether outgoing mail exists so the page can hint honestly', async () => {
		mailMock.isMailConfigured.mockReturnValue(false);
		await expect(load({} as Parameters<typeof load>[0])).resolves.toEqual({
			mailEnabled: false
		});

		mailMock.isMailConfigured.mockReturnValue(true);
		await expect(load({} as Parameters<typeof load>[0])).resolves.toEqual({
			mailEnabled: true
		});
	});
});
