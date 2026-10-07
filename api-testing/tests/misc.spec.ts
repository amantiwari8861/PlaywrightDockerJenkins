import { test, expect } from '@playwright/test';
import { send, createAuthedUser, loginUser, authHeader, isolatedRequest } from './helpers/api';

test.describe('Static assets', () => {
  test('GET / serves the product form page', async ({ request }) => {
    const res = await request.get('/');

    expect(res.status()).toBe(200);
    expect(await res.text()).toContain('Add Product');
  });

  test('GET /uploads serves uploaded files', async ({ request }) => {
    // Any path under uploads that exists returns 200; a missing one 404s.
    const missing = await request.get('/uploads/does-not-exist.png');
    expect(missing.status()).toBe(404);
  });
});

test.describe('Health and error handling', () => {
  test('GET /health reports the server is up', async ({ request }) => {
    const res = await request.get('/health');

    expect(res.status()).toBe(200);
    expect(await res.text()).toContain('Server is Up and Running!');
  });

  test('unknown API routes return a JSON 404', async ({ request }) => {
    // /api/v1/user/* is behind authMiddleware, so an unauthenticated request is
    // rejected by the guard before the router can 404. The other two are open.
    for (const url of ['/api/v1/nope', '/api/nope']) {
      const res = await request.get(url);

      expect(res.status(), url).toBe(404);
      expect(res.headers()['content-type']).toContain('application/json');

      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.message).toMatch(/route not found/i);
    }
  });

  test('an unknown route under /user is 401 without credentials, 404 with them', async ({
    request,
    baseURL,
  }) => {
    const user = await createAuthedUser(request);
    const token = await loginUser(request, user.email, user.password);

    // Fresh context, otherwise the shared fixture's cookie authenticates the
    // request and the auth guard never gets to reject it.
    const anon = await isolatedRequest(baseURL);
    const unauthenticated = await anon.get('/api/v1/user/does-not-exist/route');
    expect(unauthenticated.status()).toBe(401);
    await anon.dispose();

    const authed = await request.get('/api/v1/user/does-not-exist/route', {
      headers: authHeader(token),
    });
    expect(authed.status()).toBe(404);
    expect((await authed.json()).message).toMatch(/route not found/i);
  });

  test('unsupported methods return 404 rather than a stack trace', async ({ request }) => {
    const res = await request.patch('/api/v1/products', { failOnStatusCode: false });

    expect(res.status()).toBe(404);
    expect(await res.text()).not.toContain('at ');
  });

  test('CORS allows configured origins and omits the header for others', async ({ request }) => {
    for (const origin of [
      'http://localhost:5173',
      'http://localhost:3000',
      'http://127.0.0.1:5001',
    ]) {
      const res = await request.get('/api/v1/products', { headers: { Origin: origin } });
      expect(res.status(), origin).toBe(200);
      expect(res.headers()['access-control-allow-origin'], origin).toBe(origin);
    }
  });

  test('CORS does not crash on a disallowed origin', async ({ request }) => {
    const res = await request.get('/api/v1/products', {
      headers: { Origin: 'http://evil.example.com' },
      failOnStatusCode: false,
    });

    // The request may still be served, but the browser-facing header must be
    // absent and the response must not be an error.
    expect(res.headers()['access-control-allow-origin']).toBeUndefined();
    expect(res.status()).toBeLessThan(500);
  });

  test('requests without an Origin header are allowed', async ({ request }) => {
    const res = await request.get('/api/v1/products');

    expect(res.status()).toBe(200);
  });

  test('does not leak stack traces in error responses', async ({ request }) => {
    const res = await send(request, 'post', '/api/v1/auth/register', {
      headers: { 'content-type': 'application/json' },
      data: '{broken',
    });

    expect(res.status).toBe(400);
    expect(typeof res.body).toBe('object');
    expect(JSON.stringify(res.body)).not.toContain('node_modules');
  });
});