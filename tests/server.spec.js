import { test, expect } from '@playwright/test';

test('serves the app and rejects traversal/non-public files', async ({ request }) => {
  const index = await request.get('/');
  expect(index.status()).toBe(200);
  expect(await index.text()).toContain('POCKET TABLE TENNIS');

  for (const path of [
    '/index.html',
    '/progression.js',
    '/icon.svg',
    '/manifest.webmanifest',
    '/assets/brand/pocket-table-tennis-logo.png',
    '/assets/fonts/manrope-latin-var.woff2',
    '/assets/fonts/outfit-latin-var.woff2'
  ]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
  }

  for (const path of [
    '/package.json',
    '/server.js',
    '/node_modules/playwright/package.json',
    '/%2e%2e/%2e%2e/package.json',
    '/..%2f..%2fpackage.json'
  ]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(404);
  }
});

test('rejects unsupported methods', async ({ request }) => {
  const response = await request.post('/', { data: 'x' });
  expect(response.status()).toBe(405);
  expect(response.headers()['allow']).toContain('GET');
});
