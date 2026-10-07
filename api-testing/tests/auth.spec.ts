import { test, expect } from '@playwright/test';
import { send, registerUser, loginUser, uniqueEmail } from './helpers/api';

test.describe('POST /api/v1/auth/register', () => {
  test('creates a user and omits the password from the response', async ({ request }) => {
    const email = uniqueEmail('reg');

    const res = await send(request, 'post', '/api/v1/auth/register', {
      data: { name: 'Alice', email, password: 'Pass1234' },
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe(email);
    expect(res.body.data.name).toBe('Alice');
    expect(res.body.data._id).toEqual(expect.any(String));
    expect(res.body.data).not.toHaveProperty('password');
    expect(res.body.data).not.toHaveProperty('role');
  });

  test('returns 409 for a duplicate email', async ({ request }) => {
    const user = await registerUser(request);

    const res = await send(request, 'post', '/api/v1/auth/register', {
      data: { name: 'Impostor', email: user.email, password: 'Pass1234' },
    });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/exists/i);
  });

  test('returns 400 when required fields are missing', async ({ request }) => {
    const cases: Array<[string, Record<string, unknown>]> = [
      ['no password', { name: 'X', email: uniqueEmail('nopass') }],
      ['no email', { name: 'X', password: 'Pass1234' }],
      ['no name', { email: uniqueEmail('noname'), password: 'Pass1234' }],
      ['empty body', {}],
    ];

    for (const [label, data] of cases) {
      const res = await send(request, 'post', '/api/v1/auth/register', { data });
      expect(res.status, label).toBe(400);
      expect(res.body.success, label).toBe(false);
    }
  });

  test('ignores extra fields in the body instead of persisting them', async ({ request }) => {
    const email = uniqueEmail('inject');

    const res = await send(request, 'post', '/api/v1/auth/register', {
      data: {
        name: 'Mallory',
        email,
        password: 'Pass1234',
        role: 'ROLE_ADMIN',
        isAdmin: true,
        _id: '000000000000000000000000',
      },
    });

    expect(res.status).toBe(201);
    expect(res.body.data.role).toBeUndefined();
    expect(res.body.data.isAdmin).toBeUndefined();
    expect(res.body.data._id).not.toBe('000000000000000000000000');
  });

  test('stores the password as a bcrypt hash, not plaintext', async ({ request }) => {
    const email = uniqueEmail('hash');

    await send(request, 'post', '/api/v1/auth/register', {
      data: { name: 'Hash', email, password: 'PlainSecret123' },
    });

    const login = await send(request, 'post', '/api/v1/auth/login', {
      data: { email, password: 'PlainSecret123' },
    });
    expect(login.status).toBe(200);

    // A second account with the same plaintext must not collide.
    const second = await send(request, 'post', '/api/v1/auth/register', {
      data: { name: 'Hash2', email: uniqueEmail('hash2'), password: 'PlainSecret123' },
    });
    expect(second.status).toBe(201);
  });

  test('returns 400 JSON for a malformed JSON body', async ({ request }) => {
    const res = await send(request, 'post', '/api/v1/auth/register', {
      headers: { 'content-type': 'application/json' },
      data: '{not-json',
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/invalid json/i);
  });
});

test.describe('POST /api/v1/auth/login', () => {
  test('returns a JWT containing the user claims and sets an httpOnly cookie', async ({
    request,
  }) => {
    const user = await registerUser(request);

    const res = await send(request, 'post', '/api/v1/auth/login', {
      data: { email: user.email, password: user.password },
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toEqual(expect.any(String));

    const setCookie = res.headers['set-cookie'] ?? '';
    expect(setCookie).toContain('accessToken=');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Lax');
    expect(setCookie).toMatch(/Max-Age=900/i);

    const payload = JSON.parse(
      Buffer.from(res.body.token.split('.')[1], 'base64url').toString('utf8'),
    );
    expect(payload.email).toBe(user.email);
    expect(payload.name).toBe(user.name);
    expect(payload.role).toBe('ROLE_USER');
    expect(payload.exp - payload.iat).toBe(900);
  });

  test('returns 400 for a wrong password', async ({ request }) => {
    const user = await registerUser(request);

    const res = await send(request, 'post', '/api/v1/auth/login', {
      data: { email: user.email, password: 'WrongPassword!' },
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/invalid credentials/i);
    expect(res.body).not.toHaveProperty('token');
  });

  test('returns 404 for an unknown account', async ({ request }) => {
    const res = await send(request, 'post', '/api/v1/auth/login', {
      data: { email: uniqueEmail('ghost'), password: 'Pass1234' },
    });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  test('returns 400 when email or password is missing', async ({ request }) => {
    for (const data of [
      { email: uniqueEmail('only-email') },
      { password: 'Pass1234' },
      {},
    ]) {
      const res = await send(request, 'post', '/api/v1/auth/login', { data });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    }
  });

  test('a token obtained at login authenticates a protected route', async ({ request }) => {
    const user = await registerUser(request);
    const token = await loginUser(request, user.email, user.password);

    const res = await send(request, 'get', '/api/v1/user', {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});