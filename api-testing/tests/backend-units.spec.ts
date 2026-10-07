import { test, expect } from '@playwright/test';
import { readBackendEnv, signJwt, uniqueEmail } from './helpers/api';

/**
 * No endpoint currently echoes req.user, so a regression in how the auth
 * middleware populates it would be invisible over HTTP. These import the backend
 * modules directly to lock the contract in place.
 */
const BACKEND = '../../api-backend/src';

test.describe('backend jwt.util.verifyToken', () => {
  test.beforeAll(() => {
    // jwt.util reads process.env at call time; prime it from the backend .env.
    process.env.JWT_SECRET = readBackendEnv('JWT_SECRET', 'test-secret');
  });

  test('returns the decoded claims, not a boolean', async () => {
    const { verifyToken } = await import(`${BACKEND}/util/jwt.util.js`);

    const claims = verifyToken(
      signJwt({ email: 'someone@example.test', role: 'ROLE_USER' }, process.env.JWT_SECRET!),
    );

    expect(claims).not.toBe(true);
    expect(claims).toBeTruthy();
    expect(typeof claims).toBe('object');
    expect(claims).toMatchObject({
      email: 'someone@example.test',
      role: 'ROLE_USER',
    });
    expect(typeof claims.iat).toBe('number');
    expect(typeof claims.exp).toBe('number');
  });

  test('returns null for a tampered, expired or foreign token', async () => {
    const { verifyToken } = await import(`${BACKEND}/util/jwt.util.js`);
    const secret = process.env.JWT_SECRET!;

    expect(verifyToken('not-a-jwt')).toBeNull();
    expect(verifyToken('a.b.c')).toBeNull();
    expect(verifyToken(signJwt({ email: 'x@x.test' }, 'wrong-secret'))).toBeNull();
    expect(verifyToken(signJwt({ email: 'x@x.test' }, secret, -60))).toBeNull();
  });
});

test.describe('backend auth.middleware', () => {
  test.beforeAll(() => {
    process.env.JWT_SECRET = readBackendEnv('JWT_SECRET', 'test-secret');
  });

  const runMiddleware = (middleware: any, req: any) => {
    const res = {
      statusCode: 200,
      body: null as any,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(payload: any) {
        this.body = payload;
        return this;
      },
    };
    const next = { called: false };
    middleware(req, res, () => {
      next.called = true;
    });
    return { res, next };
  };

  test('assigns the decoded claims to req.user', async () => {
    const { default: authMiddleware } = await import(`${BACKEND}/middlewares/auth.middleware.js`);
    const email = uniqueEmail('mw');

    const token = signJwt({ email, name: 'Claims User', role: 'ROLE_USER' }, process.env.JWT_SECRET!);

    const req: any = { cookies: {}, headers: { authorization: `Bearer ${token}` } };
    const { res, next } = runMiddleware(authMiddleware, req);

    expect(next.called).toBe(true);
    expect(res.statusCode).toBe(200);
    expect(req.user).toBeTruthy();
    expect(req.user).not.toBe(true);
    expect(req.user.email).toBe(email);
    expect(req.user.role).toBe('ROLE_USER');
  });

  test('prefers the cookie over the Authorization header', async () => {
    const { default: authMiddleware } = await import(`${BACKEND}/middlewares/auth.middleware.js`);

    const goodToken = signJwt({ email: 'cookie@example.test' }, process.env.JWT_SECRET!);
    const req: any = { cookies: { accessToken: goodToken }, headers: {} };
    const { res, next } = runMiddleware(authMiddleware, req);

    expect(next.called).toBe(true);
    expect(req.user.email).toBe('cookie@example.test');
    expect(res.statusCode).toBe(200);
  });

  test('returns 401 and never calls next when the token is invalid', async () => {
    const { default: authMiddleware } = await import(`${BACKEND}/middlewares/auth.middleware.js`);

    const cases: Array<[string, any]> = [
      ['missing', { cookies: {}, headers: {} }],
      ['bad scheme', { cookies: {}, headers: { authorization: 'Basic abc' } }],
      ['no token after Bearer', { cookies: {}, headers: { authorization: 'Bearer' } }],
      ['garbage token', { cookies: {}, headers: { authorization: 'Bearer nope' } }],
      [
        'bad cookie',
        { cookies: { accessToken: 'nope' }, headers: { authorization: 'Bearer nope' } },
      ],
    ];

    for (const [label, req] of cases) {
      const { res, next } = runMiddleware(authMiddleware, req);
      expect(res.statusCode, label).toBe(401);
      expect(res.body.success, label).toBe(false);
      expect(next.called, label).toBe(false);
      expect(req.user, label).toBeUndefined();
    }
  });
});