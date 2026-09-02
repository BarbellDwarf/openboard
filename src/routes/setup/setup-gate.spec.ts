import { beforeEach, describe, expect, it, vi } from 'vitest';
import { APIError } from 'better-auth';

/**
 * First-run setup gating and creation, driven against mocked better-auth and
 * role helpers: the form exists only until an administrator exists, on both
 * GET and POST.
 */

const authMock = vi.hoisted(() => ({
	api: {
		signUpEmail: vi.fn()
	}
}));
vi.mock('$lib/server/auth', () => ({ auth: authMock }));

const rolesMock = vi.hoisted(() => ({
	isAdminUser: vi.fn(async () => false),
	hasAdmin: vi.fn(async () => true),
	promoteToAdmin: vi.fn(async () => false),
	mayCloseGame: vi.fn(() => false),
	mayDeleteChatMessage: vi.fn(() => false)
}));
vi.mock('$lib/server/auth/roles', () => rolesMock);

import { actions, load } from './+page.server';

type LoadEvent = Parameters<typeof load>[0];
type ActionEvent = Parameters<typeof actions.default>[0];

const loadEvent = { locals: { user: null } } as unknown as LoadEvent;

function actionEvent(fields: Record<string, string>): ActionEvent {
	const form = new FormData();
	for (const [key, value] of Object.entries(fields)) form.append(key, value);
	return {
		request: new Request('https://openboard.example.com/setup', { method: 'POST', body: form })
	} as unknown as ActionEvent;
}

const VALID = { name: 'clubkeeper', email: 'keeper@example.com', password: 'long-enough-pass' };

beforeEach(() => {
	vi.clearAllMocks();
	authMock.api.signUpEmail.mockResolvedValue({ token: 'tok', user: { id: 'new-admin' } });
	rolesMock.promoteToAdmin.mockResolvedValue(true);
});

describe('setup gating', () => {
	it('offers the creation form while no admin exists', async () => {
		rolesMock.hasAdmin.mockResolvedValue(false);
		await expect(load(loadEvent)).resolves.toEqual({ setupComplete: false });
	});

	it('renders the complete page once an admin exists', async () => {
		rolesMock.hasAdmin.mockResolvedValue(true);
		await expect(load(loadEvent)).resolves.toEqual({ setupComplete: true });
	});

	it('refuses POST with 403 semantics when an admin exists', async () => {
		rolesMock.hasAdmin.mockResolvedValue(true);

		const outcome = await actions.default(actionEvent(VALID));

		expect(outcome).toMatchObject({ status: 403, data: { setupComplete: true } });
		expect(authMock.api.signUpEmail).not.toHaveBeenCalled();
	});
});

describe('admin creation', () => {
	beforeEach(() => {
		rolesMock.hasAdmin.mockResolvedValue(false);
	});

	it('creates the account through better-auth and promotes it to admin', async () => {
		let caught: unknown;
		try {
			await actions.default(actionEvent(VALID));
		} catch (error) {
			caught = error;
		}

		expect(authMock.api.signUpEmail).toHaveBeenCalledWith({
			body: { name: VALID.name, email: VALID.email, password: VALID.password }
		});
		expect(rolesMock.promoteToAdmin).toHaveBeenCalledWith('new-admin');
		expect((caught as { status: number }).status).toBe(303);
		expect((caught as { location: string }).location).toBe('/');
	});

	it('rejects short passwords before touching auth', async () => {
		const outcome = await actions.default(actionEvent({ ...VALID, password: 'too-short' }));

		expect(outcome).toMatchObject({ status: 422 });
		expect(authMock.api.signUpEmail).not.toHaveBeenCalled();
		expect(rolesMock.promoteToAdmin).not.toHaveBeenCalled();
	});

	it('rejects bad usernames before touching auth', async () => {
		const outcome = await actions.default(actionEvent({ ...VALID, name: 'ab' }));

		expect(outcome).toMatchObject({ status: 422 });
		expect(authMock.api.signUpEmail).not.toHaveBeenCalled();
	});

	it('surfaces better-auth failures without leaking internals', async () => {
		authMock.api.signUpEmail.mockRejectedValue(
			new APIError(422, { message: 'User already exists' })
		);

		const outcome = await actions.default(actionEvent(VALID));

		expect(outcome).toMatchObject({
			status: 422,
			data: { error: 'User already exists' }
		});
		expect(rolesMock.promoteToAdmin).not.toHaveBeenCalled();
	});

	it('closes setup when another request won the promotion race', async () => {
		rolesMock.promoteToAdmin.mockResolvedValue(false);

		const outcome = await actions.default(actionEvent(VALID));

		expect(outcome).toMatchObject({ status: 403, data: { setupComplete: true } });
	});

	it('rethrows unexpected failures instead of masking them', async () => {
		authMock.api.signUpEmail.mockRejectedValue(new Error('connection refused'));

		await expect(actions.default(actionEvent(VALID))).rejects.toThrow('connection refused');
	});
});
