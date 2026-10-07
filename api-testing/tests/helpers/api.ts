import { createHmac } from 'crypto';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { request, APIRequestContext } from '@playwright/test';

type HttpMethod = 'get' | 'post' | 'put' | 'delete' | 'patch';

export type ApiResponse<T = any> = {
  status: number;
  body: T;
  headers: Record<string, string>;
};

let counter = 0;

export const uniqueEmail = (prefix = 'pw') =>
  `${prefix}.${Date.now()}.${process.pid}.${counter++}@example.test`;

export const uniqueTitle = (prefix = 'prod') =>
  `${prefix}-${Date.now()}-${process.pid}-${counter++}`;

/**
 * Minimal 1x1 PNG, valid enough for multer's mime/size checks.
 */
export const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
  'base64',
);

/** A buffer larger than the 5MB multer limit, for LIMIT_FILE_SIZE tests. */
export const OVERSIZE_BUFFER = Buffer.alloc(6 * 1024 * 1024, 0x41);

export const pngFile = (name = 'tiny.png'): FileSpec => ({
  name,
  mimeType: 'image/png',
  buffer: PNG_1X1,
});

export const jpegFile = (name = 'tiny.jpg'): FileSpec => ({
  name,
  mimeType: 'image/jpeg',
  buffer: PNG_1X1,
});

export const webpFile = (name = 'tiny.webp'): FileSpec => ({
  name,
  mimeType: 'image/webp',
  buffer: PNG_1X1,
});

export const textFile = (name = 'evil.json'): FileSpec => ({
  name,
  mimeType: 'application/json',
  buffer: Buffer.from('{"not":"an image"}'),
});

export const oversizedPng = (name = 'huge.png'): FileSpec => ({
  name,
  mimeType: 'image/png',
  buffer: OVERSIZE_BUFFER,
});

export type SendOptions = {
  data?: string | object;
  headers?: Record<string, string>;
  multipart?: FormData | Record<string, string | number | boolean>;
  params?: Record<string, string | number | boolean>;
  timeout?: number;
};

export type FileSpec = {
  /** Multipart field name. Defaults to 'images', which is what multer expects. */
  field?: string;
  name: string;
  mimeType: string;
  buffer: Buffer;
};

/**
 * Playwright's `multipart` object form does not accept an array of files (it
 * treats the array as a stream), and multer needs the same field name repeated
 * for `upload.array()`. A real FormData handles both correctly.
 */
export const multipart = (
  fields: Record<string, string | number | boolean> = {},
  files: FileSpec[] = [],
): FormData => {
  const form = new FormData();

  for (const [key, value] of Object.entries(fields)) {
    form.append(key, String(value));
  }

  for (const file of files) {
    const bytes = new Uint8Array(file.buffer);
    form.append(
      file.field ?? 'images',
      new File([bytes], file.name, { type: file.mimeType }),
    );
  }

  return form;
};

export const send = async <T = any>(
  context: APIRequestContext,
  method: HttpMethod,
  url: string,
  options: SendOptions = {},
): Promise<ApiResponse<T>> => {
  const res = await context.fetch(url, {
    ...options,
    method,
    failOnStatusCode: false,
  } as Parameters<APIRequestContext['fetch']>[1]);

  const text = await res.text();
  let body: any;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status(), body, headers: res.headers() };
};

export const registerUser = async (
  context: APIRequestContext,
  overrides: Partial<{ name: string; email: string; password: string }> = {},
) => {
  const email = overrides.email ?? uniqueEmail('register');
  const password = overrides.password ?? 'Pass1234';
  const name = overrides.name ?? 'PW Test User';

  const res = await send(context, 'post', '/api/v1/auth/register', {
    data: { name, email, password },
  });

  if (res.status !== 201) {
    throw new Error(
      `registerUser failed: ${res.status} ${JSON.stringify(res.body)}`,
    );
  }

  return { email, password, name, id: res.body.data._id as string };
};

export const loginUser = async (
  context: APIRequestContext,
  email: string,
  password = 'Pass1234',
) => {
  const res = await send(context, 'post', '/api/v1/auth/login', {
    data: { email, password },
  });
  if (res.status !== 200) {
    throw new Error(`loginUser failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.token as string;
};

/** Register + login, returning both the user record and a bearer token. */
export const createAuthedUser = async (context: APIRequestContext) => {
  const user = await registerUser(context);
  const token = await loginUser(context, user.email, user.password);
  return { ...user, token };
};

export const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` });

/**
 * A brand-new APIRequestContext with its own empty cookie jar. The shared
 * `request` fixture keeps cookies, and authMiddleware prefers a cookie over the
 * Authorization header, so negative auth tests must not reuse it.
 */
export const isolatedRequest = async (baseURL?: string) =>
  request.newContext({ baseURL });

export { request };

/**
 * Minimal HS256 JWT signer so the suite can forge expired / wrong-secret tokens
 * without depending on jsonwebtoken being installed here.
 */
export const signJwt = (
  payload: Record<string, unknown>,
  secret: string,
  expiresInSeconds = 900,
): string => {
  const header = { alg: 'HS256', typ: 'JWT' };
  const iat = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat, exp: iat + expiresInSeconds };

  const b64 = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString('base64url');

  const data = `${b64(header)}.${b64(body)}`;
  const signature = createHmac('sha256', secret).update(data).digest('base64url');

  return `${data}.${signature}`;
};

/** Reads a KEY=value pair from the backend .env, no dependency needed. */
export const readBackendEnv = (key: string, fallback = ''): string => {
  const path = resolve(process.cwd(), '../api-backend/.env');
  try {
    const contents = readFileSync(path, 'utf8');
    for (const line of contents.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (match && match[1] === key) {
        return match[2].replace(/^["']|["']$/g, '');
      }
    }
  } catch {
    // fall through to the default
  }
  return fallback;
};