import { test, expect } from '@playwright/test';
import {
  send,
  registerUser,
  loginUser,
  createAuthedUser,
  authHeader,
  uniqueEmail,
  signJwt,
  readBackendEnv,
  isolatedRequest,
} from './helpers/api';

const VALID_ID = '000000000000000000000000';

test.describe('Auth guard on /api/v1/user', () => {
  test('GET /api/v1/user/greet stays public', async ({ request }) => {
    const res = await send(request, 'get', '/api/v1/user/greet');

    expect(res.status).toBe(200);
    expect(typeof res.body).toBe('string');
  });

  test('rejects requests with no credentials on every protected method', async ({
    request,
  }) => {
    const calls: Array<[string, string]> = [
      ['get', '/api/v1/user'],
      ['get', `/api/v1/user/${VALID_ID}`],
      ['post', '/api/v1/user'],
      ['put', `/api/v1/user/${VALID_ID}`],
      ['delete', `/api/v1/user/${VALID_ID}`],
    ];

    for (const [method, url] of calls) {
      const res = await send(request, method as 'get', url, { data: { name: 'x' } });
      expect(res.status, `${method.toUpperCase()} ${url}`).toBe(401);
      expect(res.body.success).toBe(false);
    }
  });

  test('rejects a malformed Authorization header', async ({ request, baseURL }) => {
    const ctx = await isolatedRequest(baseURL);

    for (const header of ['Basic abc', 'Bearer', 'Bearer  ', 'Token abc']) {
      const res = await send(ctx, 'get', '/api/v1/user', {
        headers: { Authorization: header },
      });
      expect(res.status, header).toBe(401);
    }

    await ctx.dispose();
  });

  test('rejects a tampered or garbage token', async ({ request, baseURL }) => {
    const ctx = await isolatedRequest(baseURL);

    for (const token of ['not-a-jwt', 'a.b.c', '']) {
      const res = await send(ctx, 'get', '/api/v1/user', {
        headers: { Authorization: `Bearer ${token}` },
      });
      expect(res.status, token || '<empty>').toBe(401);
      expect(res.body.message).toMatch(/invalid|required/i);
    }

    await ctx.dispose();
  });

  test('rejects a token signed with a different secret', async ({ request, baseURL }) => {
    const ctx = await isolatedRequest(baseURL);
    const forged = signJwt(
      { email: 'attacker@example.test', role: 'ROLE_ADMIN' },
      'wrong-secret',
    );

    const res = await send(ctx, 'get', '/api/v1/user', {
      headers: { Authorization: `Bearer ${forged}` },
    });

    expect(res.status).toBe(401);
    await ctx.dispose();
  });

  test('rejects a token whose payload was tampered with', async ({ request, baseURL }) => {
    const user = await registerUser(request);
    const token = await loginUser(request, user.email, user.password);

    // Re-encode the payload with an escalated role but keep the original signature.
    const [header, , signature] = token.split('.');
    const tamperedPayload = Buffer.from(
      JSON.stringify({ email: user.email, name: user.name, role: 'ROLE_ADMIN' }),
    ).toString('base64url');

    // Fresh context: the shared fixture still holds a valid cookie, and
    // authMiddleware would accept that before looking at the bad header.
    const ctx = await isolatedRequest(baseURL);
    const res = await send(ctx, 'get', '/api/v1/user', {
      headers: { Authorization: `Bearer ${header}.${tamperedPayload}.${signature}` },
    });

    expect(res.status).toBe(401);
    await ctx.dispose();
  });

  test('rejects an expired token', async ({ request, baseURL }) => {
    const ctx = await isolatedRequest(baseURL);
    const expired = signJwt(
      { email: 'x@example.test', role: 'ROLE_USER' },
      readBackendEnv('JWT_SECRET', 'fallback-secret'),
      -60,
    );

    const res = await send(ctx, 'get', '/api/v1/user', {
      headers: { Authorization: `Bearer ${expired}` },
    });

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid|expired/i);
    await ctx.dispose();
  });

  test('the cookie takes precedence over a bad Authorization header', async ({
    request,
    baseURL,
  }) => {
    // Documents the cookie-first ordering in authMiddleware: a valid cookie
    // authenticates even when the header is garbage.
    const user = await registerUser(request);
    await send(request, 'post', '/api/v1/auth/login', {
      data: { email: user.email, password: user.password },
    });

    const res = await send(request, 'get', '/api/v1/user', {
      headers: { Authorization: 'Bearer garbage' },
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test('accepts the httpOnly cookie set at login', async ({ request }) => {
    const user = await registerUser(request);

    // The request fixture keeps its own cookie jar, so no Authorization header
    // is needed here: the accessToken cookie must carry the request.
    const login = await send(request, 'post', '/api/v1/auth/login', {
      data: { email: user.email, password: user.password },
    });
    expect(login.status).toBe(200);
    expect(login.body.token).toEqual(expect.any(String));

    const res = await send(request, 'get', '/api/v1/user');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

test.describe('GET /api/v1/user', () => {
  test('returns users without password fields', async ({ request }) => {
    const { token } = await createAuthedUser(request);

    const res = await send(request, 'get', '/api/v1/user', { headers: authHeader(token) });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.count).toBe(res.body.data.length);
    for (const user of res.body.data) {
      expect(user).not.toHaveProperty('password');
    }
  });

  test('supports an exact email filter', async ({ request }) => {
    const { token, email } = await createAuthedUser(request);

    const res = await send(request, 'get', `/api/v1/user?email=${encodeURIComponent(email)}`, {
      headers: authHeader(token),
    });

    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.data[0].email).toBe(email);
  });

  test('ignores Mongo operators in the query string', async ({ request }) => {
    const { token, email } = await createAuthedUser(request);

    const baseline = await send(request, 'get', '/api/v1/user', { headers: authHeader(token) });

    // Each of these must be discarded rather than interpreted as a filter.
    const injections = [
      `email[$ne]=${encodeURIComponent(email)}`,
      `email[$regex]=.*`,
      `email[$gt]=`,
      `[$where]=1`,
      `password[$ne]=x`,
    ];

    for (const qs of injections) {
      const res = await send(request, 'get', `/api/v1/user?${qs}`, {
        headers: authHeader(token),
      });
      expect(res.status, qs).toBe(200);
      expect(res.body.count, `${qs} must not filter`).toBe(baseline.body.count);
    }

    // Confirm the data is still reachable via the allowed filter.
    const legit = await send(request, 'get', `/api/v1/user?email=${encodeURIComponent(email)}`, {
      headers: authHeader(token),
    });
    expect(legit.body.count).toBe(1);
  });
});

test.describe('GET /api/v1/user/:id', () => {
  test('returns the requested user without the password', async ({ request }) => {
    const { token, id, email } = await createAuthedUser(request);

    const res = await send(request, 'get', `/api/v1/user/${id}`, {
      headers: authHeader(token),
    });

    expect(res.status).toBe(200);
    expect(res.body.data._id).toBe(id);
    expect(res.body.data.email).toBe(email);
    expect(res.body.data).not.toHaveProperty('password');
  });

  test('returns 404 for a well-formed but unknown id', async ({ request }) => {
    const { token } = await createAuthedUser(request);

    const res = await send(request, 'get', `/api/v1/user/${VALID_ID}`, {
      headers: authHeader(token),
    });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  test('returns 400 for a malformed id instead of 500', async ({ request }) => {
    const { token } = await createAuthedUser(request);

    for (const id of ['not-an-id', '123', 'abc def', '%20']) {
      const res = await send(request, 'get', `/api/v1/user/${id}`, {
        headers: authHeader(token),
      });
      expect(res.status, id).toBe(400);
      expect(res.body.success).toBe(false);
    }
  });
});

test.describe('POST /api/v1/user', () => {
  test('creates a user and returns it without the password', async ({ request }) => {
    const { token } = await createAuthedUser(request);
    const email = uniqueEmail('post');

    const res = await send(request, 'post', '/api/v1/user', {
      headers: authHeader(token),
      data: { name: 'Created', email, password: 'Pass1234' },
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe(email);
    expect(res.body.data).not.toHaveProperty('password');
  });

  test('returns 409 for a duplicate email', async ({ request }) => {
    const { token, email } = await createAuthedUser(request);

    const res = await send(request, 'post', '/api/v1/user', {
      headers: authHeader(token),
      data: { name: 'Dup', email, password: 'Pass1234' },
    });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/exists/i);
  });

  test('returns 400 when password is missing', async ({ request }) => {
    const { token } = await createAuthedUser(request);

    const res = await send(request, 'post', '/api/v1/user', {
      headers: authHeader(token),
      data: { name: 'NoPassword', email: uniqueEmail('nopw') },
    });

    expect(res.status).toBe(400);
  });
});

test.describe('PUT /api/v1/user/:id', () => {
  test('updates the name without breaking the existing password', async ({ request }) => {
    const user = await createAuthedUser(request);

    const update = await send(request, 'put', `/api/v1/user/${user.id}`, {
      headers: authHeader(user.token),
      data: { name: 'Renamed Only' },
    });

    expect(update.status).toBe(200);
    expect(update.body.data.name).toBe('Renamed Only');

    // Regression guard: a name-only PUT must not overwrite the password hash.
    const relogin = await send(request, 'post', '/api/v1/auth/login', {
      data: { email: user.email, password: user.password },
    });
    expect(relogin.status).toBe(200);
    expect(relogin.body.success).toBe(true);
  });

  test('updates the email and lets the new address log in', async ({ request }) => {
    const user = await createAuthedUser(request);
    const nextEmail = uniqueEmail('moved');

    const update = await send(request, 'put', `/api/v1/user/${user.id}`, {
      headers: authHeader(user.token),
      data: { email: nextEmail },
    });

    expect(update.status).toBe(200);
    expect(update.body.data.email).toBe(nextEmail);

    const relogin = await send(request, 'post', '/api/v1/auth/login', {
      data: { email: nextEmail, password: user.password },
    });
    expect(relogin.status).toBe(200);
  });

  test('changes the password and invalidates the old one', async ({ request }) => {
    const user = await createAuthedUser(request);

    const update = await send(request, 'put', `/api/v1/user/${user.id}`, {
      headers: authHeader(user.token),
      data: { password: 'BrandNewPass99' },
    });
    expect(update.status).toBe(200);

    const withOld = await send(request, 'post', '/api/v1/auth/login', {
      data: { email: user.email, password: user.password },
    });
    expect(withOld.status).toBe(400);

    const withNew = await send(request, 'post', '/api/v1/auth/login', {
      data: { email: user.email, password: 'BrandNewPass99' },
    });
    expect(withNew.status).toBe(200);
  });

  test('returns 400 for an empty body rather than hashing undefined', async ({ request }) => {
    const user = await createAuthedUser(request);

    const res = await send(request, 'put', `/api/v1/user/${user.id}`, {
      headers: authHeader(user.token),
      data: {},
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);

    // Login must still work, proving the hash was untouched.
    const relogin = await send(request, 'post', '/api/v1/auth/login', {
      data: { email: user.email, password: user.password },
    });
    expect(relogin.status).toBe(200);
  });

  test('returns 409 when the new email belongs to another account', async ({ request }) => {
    const first = await createAuthedUser(request);
    const second = await createAuthedUser(request);

    const res = await send(request, 'put', `/api/v1/user/${first.id}`, {
      headers: authHeader(first.token),
      data: { email: second.email },
    });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/exists/i);
  });

  test('does not allow updating the email to the account own current value via 409', async ({
    request,
  }) => {
    const user = await createAuthedUser(request);

    const res = await send(request, 'put', `/api/v1/user/${user.id}`, {
      headers: authHeader(user.token),
      data: { email: user.email, name: 'SameEmail' },
    });

    expect(res.status).toBe(200);
  });

  test('ignores unknown fields in the update body', async ({ request }) => {
    const user = await createAuthedUser(request);

    const res = await send(request, 'put', `/api/v1/user/${user.id}`, {
      headers: authHeader(user.token),
      data: { name: 'Safe', role: 'ROLE_ADMIN', _id: VALID_ID },
    });

    expect(res.status).toBe(200);
    expect(res.body.data.role).toBeUndefined();
    expect(res.body.data._id).toBe(user.id);
  });

  test('returns 400 for a malformed id', async ({ request }) => {
    const { token } = await createAuthedUser(request);

    const res = await send(request, 'put', '/api/v1/user/not-an-id', {
      headers: authHeader(token),
      data: { name: 'X' },
    });

    expect(res.status).toBe(400);
  });

  test('returns 404 for an unknown id', async ({ request }) => {
    const { token } = await createAuthedUser(request);

    const res = await send(request, 'put', `/api/v1/user/${VALID_ID}`, {
      headers: authHeader(token),
      data: { name: 'X' },
    });

    expect(res.status).toBe(404);
  });
});

test.describe('DELETE /api/v1/user/:id', () => {
  test('deletes the account and makes it unreachable', async ({ request }) => {
    const user = await createAuthedUser(request);

    const del = await send(request, 'delete', `/api/v1/user/${user.id}`, {
      headers: authHeader(user.token),
    });
    expect(del.status).toBe(200);
    expect(del.body.success).toBe(true);

    const after = await send(request, 'get', `/api/v1/user/${user.id}`, {
      headers: authHeader(user.token),
    });
    expect(after.status).toBe(404);

    const relogin = await send(request, 'post', '/api/v1/auth/login', {
      data: { email: user.email, password: user.password },
    });
    expect(relogin.status).toBe(404);
  });

  test('returns 404 when deleting twice', async ({ request }) => {
    const user = await createAuthedUser(request);

    await send(request, 'delete', `/api/v1/user/${user.id}`, {
      headers: authHeader(user.token),
    });
    const again = await send(request, 'delete', `/api/v1/user/${user.id}`, {
      headers: authHeader(user.token),
    });

    expect(again.status).toBe(404);
  });

  test('returns 400 for a malformed id', async ({ request }) => {
    const { token } = await createAuthedUser(request);

    const res = await send(request, 'delete', '/api/v1/user/nope', {
      headers: authHeader(token),
    });

    expect(res.status).toBe(400);
  });
});