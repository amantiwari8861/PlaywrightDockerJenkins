import { test, expect } from '@playwright/test';
import {
  send,
  multipart,
  uniqueTitle,
  pngFile,
  jpegFile,
  webpFile,
  textFile,
  oversizedPng,
} from './helpers/api';

const baseFields = {
  price: '19.99',
  description: 'A useful widget',
  category: 'electronics',
};

const fields = (title: string, extra: Record<string, string | number> = {}) => ({
  ...baseFields,
  title,
  ...extra,
});

test.describe('POST /api/v1/products', () => {
  test('creates a product with no images', async ({ request }) => {
    const title = uniqueTitle('noimg');

    const res = await send(request, 'post', '/api/v1/products', {
      multipart: multipart(fields(title)),
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.title).toBe(title);
    expect(res.body.data.price).toBeCloseTo(19.99, 2);
    expect(res.body.data.category).toBe('electronics');
    expect(res.body.data.image).toEqual([]);
    expect(res.body.data.rating).toEqual({ rate: 0, count: 0 });
  });

  test('accepts nested rating fields from the form', async ({ request }) => {
    const title = uniqueTitle('rating');

    const res = await send(request, 'post', '/api/v1/products', {
      multipart: multipart(fields(title, { 'rating[rate]': '4.5', 'rating[count]': '120' })),
    });

    expect(res.status).toBe(201);
    expect(res.body.data.rating.rate).toBeCloseTo(4.5, 2);
    expect(res.body.data.rating.count).toBe(120);
  });

  test('stores uploaded image paths using forward slashes', async ({ request }) => {
    const title = uniqueTitle('img');

    const res = await send(request, 'post', '/api/v1/products', {
      multipart: multipart(fields(title), [pngFile('a.png'), pngFile('b.png')]),
    });

    expect(res.status).toBe(201);
    expect(res.body.data.image).toHaveLength(2);
    for (const path of res.body.data.image) {
      expect(path).toMatch(/^uploads\/[^/]+\.png$/);
      expect(path).not.toContain('\\');
    }
  });

  test('accepts all three allowed image mime types', async ({ request }) => {
    for (const file of [pngFile('x.png'), jpegFile('x.jpg'), webpFile('x.webp')]) {
      const res = await send(request, 'post', '/api/v1/products', {
        multipart: multipart(fields(uniqueTitle('mime')), [file]),
      });

      expect(res.status, file.mimeType).toBe(201);
      expect(res.body.data.image).toHaveLength(1);
    }
  });

  test('returns 400 JSON when the file type is not an image', async ({ request }) => {
    const res = await send(request, 'post', '/api/v1/products', {
      multipart: multipart(fields(uniqueTitle('badmime')), [textFile()]),
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/jpeg, png and webp/i);
    expect(res.body.code).toBeDefined();
  });

  test('returns 413 JSON when the file exceeds the 5MB limit', async ({ request }) => {
    const res = await send(request, 'post', '/api/v1/products', {
      multipart: multipart(fields(uniqueTitle('big')), [oversizedPng()]),
    });

    expect(res.status).toBe(413);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('LIMIT_FILE_SIZE');
  });

  test('rejects more than 5 images', async ({ request }) => {
    const res = await send(request, 'post', '/api/v1/products', {
      multipart: multipart(
        fields(uniqueTitle('toomany')),
        Array.from({ length: 6 }, (_, i) => pngFile(`f${i}.png`)),
      ),
    });

    expect(res.status).toBe(413);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('LIMIT_FILE_COUNT');
  });

  test('accepts exactly 5 images', async ({ request }) => {
    const res = await send(request, 'post', '/api/v1/products', {
      multipart: multipart(
        fields(uniqueTitle('exactly5')),
        Array.from({ length: 5 }, (_, i) => pngFile(`g${i}.png`)),
      ),
    });

    expect(res.status).toBe(201);
    expect(res.body.data.image).toHaveLength(5);
  });

  test('returns 400 when required product fields are missing', async ({ request }) => {
    const res = await send(request, 'post', '/api/v1/products', {
      multipart: multipart({ title: uniqueTitle('incomplete') }),
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errors).toMatchObject({
      price: expect.any(String),
      description: expect.any(String),
      category: expect.any(String),
    });
  });

  test('a validation failure does not leak a stack trace', async ({ request }) => {
    const res = await send(request, 'post', '/api/v1/products', {
      multipart: multipart({ title: uniqueTitle('leakcheck') }),
    });

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).not.toContain('node_modules');
    expect(res.body).not.toHaveProperty('error');
  });
});

test.describe('POST /api/v1/products/save-all', () => {
  test('inserts an array of products', async ({ request }) => {
    const a = uniqueTitle('bulk-a');
    const b = uniqueTitle('bulk-b');

    const res = await send(request, 'post', '/api/v1/products/save-all', {
      data: [
        { title: a, price: 10, description: 'first', category: 'books', image: [] },
        { title: b, price: 20, description: 'second', category: 'books', image: [] },
      ],
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data.map((p: any) => p.title).sort()).toEqual([a, b].sort());
  });

  test('accepts a single object and returns an array', async ({ request }) => {
    const title = uniqueTitle('bulk-single');

    const res = await send(request, 'post', '/api/v1/products/save-all', {
      data: { title, price: 5, description: 'solo', category: 'home', image: [] },
    });

    expect(res.status).toBe(201);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data[0].title).toBe(title);
  });

  test('returns 400 when a product in the batch is invalid', async ({ request }) => {
    const res = await send(request, 'post', '/api/v1/products/save-all', {
      data: [
        { title: uniqueTitle('good'), price: 10, description: 'ok', category: 'books', image: [] },
        { title: uniqueTitle('bad'), category: 'books', image: [] },
      ],
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.errors).toBeDefined();
  });

  test('returns 400 for an empty array', async ({ request }) => {
    const res = await send(request, 'post', '/api/v1/products/save-all', { data: [] });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

test.describe('GET /api/v1/products', () => {
  test('rewrites local upload paths to absolute URLs on the running port', async ({
    request,
    baseURL,
  }) => {
    const title = uniqueTitle('urls');

    await send(request, 'post', '/api/v1/products', {
      multipart: multipart(fields(title), [pngFile()]),
    });

    const res = await send(request, 'get', '/api/v1/products');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const created = res.body.data.find((p: any) => p.title === title);
    expect(created, 'created product should be listed').toBeDefined();

    const host = new URL(baseURL!).host;
    for (const image of created.image) {
      expect(image).toBe(`http://${host}${image.slice(image.indexOf('/uploads/'))}`);
      expect(image).not.toContain('\\');
    }
  });

  test('leaves remote image URLs untouched', async ({ request }) => {
    const res = await send(request, 'get', '/api/v1/products');

    for (const product of res.body.data) {
      for (const image of product.image ?? []) {
        expect(image).not.toContain('/uploads/uploads');
        expect(image).not.toContain('\\');
      }
    }
  });

  test('uploaded image URLs actually resolve', async ({ request, baseURL }) => {
    const title = uniqueTitle('resolve');

    await send(request, 'post', '/api/v1/products', {
      multipart: multipart(fields(title), [pngFile()]),
    });

    const list = await send(request, 'get', '/api/v1/products');
    const created = list.body.data.find((p: any) => p.title === title);
    const imageUrl = created.image[0];

    expect(imageUrl.startsWith(`http://${new URL(baseURL!).host}/uploads/`)).toBe(true);

    const fetched = await request.fetch(imageUrl, { failOnStatusCode: false });
    expect(fetched.status()).toBe(200);
    expect(fetched.headers()['content-type']).toContain('image');
  });

  test('does not require authentication', async ({ request }) => {
    const res = await send(request, 'get', '/api/v1/products');

    expect(res.status).toBe(200);
  });
});