import { expect, it } from 'vitest';
import { releaseEpoch, renderWorker } from '../scripts/release-epoch';
import { readFileSync } from 'node:fs';

it('changes the offline release epoch for course-only and skill-only updates', () => {
  const files = { 'index.html': 'shell', 'assets/app-x.js': 'app', 'courses/kbai.json': 'revision1', 'skill.zip': new Uint8Array([1, 2, 3]) };
  const before = releaseEpoch(files);
  expect(releaseEpoch({ ...files, 'courses/kbai.json': 'revision2' })).not.toBe(before);
  expect(releaseEpoch({ ...files, 'skill.zip': new Uint8Array([1, 2, 4]) })).not.toBe(before);
  expect(releaseEpoch(Object.fromEntries(Object.entries(files).reverse()))).toBe(before);
});
it('does not activate updates on install and uses a guaranteed offline fallback', () => {
  const worker = readFileSync('scripts/sw-template.js', 'utf8');
  expect(worker.match(/skipWaiting/g)).toHaveLength(1);
  expect(worker).toContain("event.data?.type === 'ACTIVATE_UPDATE'");
  expect(worker).toContain("cache.match('/handbook/index.html')");
  expect(readFileSync('vite.config.ts', 'utf8')).toContain("'/handbook/index.html'");
  expect(worker).toContain('allowed.has(url.href)');
  const rendered = renderWorker(worker, 'test', ['/handbook/index.html']);
  expect(rendered).toContain('const URLS = ["/handbook/index.html"];');
  expect(rendered).not.toContain('const URLS = __URLS__;');
});
