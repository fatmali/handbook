import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { renderWorker } from '../../scripts/release-epoch';

test('a waiting release never mixes navigation HTML and hashed assets offline', async ({ page, context }) => {
  let release = 'A';
  const template = readFileSync('scripts/sw-template.js', 'utf8');
  const server = createServer((request, response) => {
    const path = new URL(request.url!, 'http://localhost').pathname;
    response.setHeader('Cache-Control', 'no-store');
    if (path === '/handbook/' || path === '/handbook/index.html') {
      response.setHeader('Content-Type', 'text/html');
      response.end(`<!doctype html><html lang="en"><head><title>Release ${release}</title><link rel="stylesheet" href="/handbook/assets/app-${release}.css"></head><body><h1>Release fixture</h1><script src="/handbook/assets/app-${release}.js"></script></body></html>`);
    } else if (path === '/handbook/sw.js') {
      response.setHeader('Content-Type', 'text/javascript');
      response.end(renderWorker(template, release, ['/handbook/', '/handbook/index.html', `/handbook/assets/app-${release}.js`, `/handbook/assets/app-${release}.css`]));
    } else if (path === `/handbook/assets/app-${release}.js`) {
      response.setHeader('Content-Type', 'text/javascript'); response.end(`document.body.dataset.release="${release}";`);
    } else if (path === `/handbook/assets/app-${release}.css`) {
      response.setHeader('Content-Type', 'text/css'); response.end('body{color:rgb(20,30,40)}');
    } else { response.statusCode = 404; response.end('Not in this release'); }
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not listen.');
  const url = `http://127.0.0.1:${address.port}/handbook/`;
  try {
    await page.goto(url);
    await page.evaluate(async () => { await navigator.serviceWorker.register('/handbook/sw.js', { scope: '/handbook/' }); await navigator.serviceWorker.ready; });
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    await expect(page.locator('body')).toHaveAttribute('data-release', 'A');
    release = 'B';
    await page.evaluate(async () => { await (await navigator.serviceWorker.getRegistration())!.update(); });
    await page.waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting);
    await page.goto(`${url}?another-view`);
    await expect(page.locator('body')).toHaveAttribute('data-release', 'A');
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator('body')).toHaveAttribute('data-release', 'A');
    await page.evaluate(async () => {
      const registration = (await navigator.serviceWorker.getRegistration())!;
      const changed = new Promise<void>(resolve => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }));
      registration.waiting!.postMessage({ type: 'ACTIVATE_UPDATE' }); await changed;
    });
    await page.reload();
    await expect(page.locator('body')).toHaveAttribute('data-release', 'B');
  } finally {
    await context.setOffline(false);
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
