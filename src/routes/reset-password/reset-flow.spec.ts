import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The reset page spends both kinds of tokens: admin-issued ones through the
 * local token service and emailed ones delegated to better-auth. Failure
 * messages never say which of the three failure modes applied.
 */

const authMock = vi.hoisted(() => ({
	auth: {
		api: {
			resetPassword: vi.fn()
		}
	}
}));
vi.mock('$lib/server/auth', () => authMock);

const resetTokensMock = vi.hoisted(() => ({
	applyPasswordReset: vi.fn()
}));
vi.mock('$lib/server/auth/reset-tokens', () => resetTokensMock);

import { actions } from './+page.server';

type ActionEvent = Parameters<typeof actions.setPassword>[0];

function actionEvent(fields: Record<string, string>): ActionEvent {
	const form = new FormData();
	for (const [key, value] of Object.entries(fields)) form.append(key, value);
	return {
		request: new Request('https://openboard.example.com/reset-password', {
			method: 'POST',
			body: form
		})
	} as unknown as ActionEvent;
}

const VALID = { token: 'one-time-code', password: 'brand-new-password' };

beforeEach(() => {
	vi.clearAllMocks();
	resetTokensMock.applyPasswordReset.mockResolvedValue('invalid-token');
});

describe('setPassword action', () => {
	it('spends an admin-issued token without delegating', async () => {
		resetTokensMock.applyPasswordReset.mockResolvedValue('ok');

		await expect(actions.setPassword(actionEvent(VALID))).resolves.toEqual({
			success: true
		});
		expect(resetTokensMock.applyPasswordReset).toHaveBeenCalledWith(
			'one-time-code',
			'brand-new-password'
		);
		expect(authMock.auth.api.resetPassword).not.toHaveBeenCalled();
	});

	it('falls back to better-auth for emailed forget-password tokens', async () => {
		resetTokensMock.applyPasswordReset.mockResolvedValue('invalid-token');
		authMock.auth.api.resetPassword.mockResolvedValue({ status: true });

		await expect(actions.setPassword(actionEvent(VALID))).resolves.toEqual({
			success: true
		});
		expect(authMock.auth.api.resetPassword).toHaveBeenCalledWith({
			body: { newPassword: 'brand-new-password', token: 'one-time-code' }
		});
	});

	it('reports one neutral error when both paths reject the code', async () => {
		resetTokensMock.applyPasswordReset.mockResolvedValue('invalid-token');
		authMock.auth.api.resetPassword.mockRejectedValue(new Error('INVALID_TOKEN'));

		const result = await actions.setPassword(actionEvent(VALID));

		expect(result).toMatchObject({
			status: 422,
			data: { error: 'This reset code is invalid, was already used, or has expired.' }
		});
	});

	it('explains SSO-only accounts instead of a fake success', async () => {
		resetTokensMock.applyPasswordReset.mockResolvedValue('no-password-account');

		const result = await actions.setPassword(actionEvent(VALID));

		expect(result).toMatchObject({ status: 422 });
		const data = (result as { data?: { error?: string } }).data;
		expect(data?.error).toContain('single sign-on');
		expect(authMock.auth.api.resetPassword).not.toHaveBeenCalled();
	});

	it('enforces the minimum password length before anything else', async () => {
		const result = await actions.setPassword(actionEvent({ ...VALID, password: 'too-short' }));

		expect(result).toMatchObject({ status: 422 });
		expect(resetTokensMock.applyPasswordReset).not.toHaveBeenCalled();
		expect(authMock.auth.api.resetPassword).not.toHaveBeenCalled();
	});

	it('refuses to act without a code at all', async () => {
		const result = await actions.setPassword(actionEvent({ password: 'long-enough-pass' }));

		expect(result).toMatchObject({ status: 422 });
		expect(resetTokensMock.applyPasswordReset).not.toHaveBeenCalled();
	});
});
