import { expect, it } from 'vitest';
import { releaseEpoch, renderWorker } from '../scripts/release-epoch';
import { existsSync, readFileSync } from 'node:fs';

it('does not distribute the personal KBAI course or automatically fetch a starter course', () => {
  expect(existsSync('public/courses/kbai.json')).toBe(false);
  expect(existsSync('public/legacy/Handbook-v0.html')).toBe(false);
  expect(existsSync('src/content/kbai.json')).toBe(false);
  expect(readFileSync('src/App.tsx', 'utf8')).not.toMatch(/courses\/kbai\.json|bundledPacks/);
  expect(readFileSync('vite.config.ts', 'utf8')).not.toContain('courses/kbai.json');
  expect(readFileSync('scripts/release.ts', 'utf8')).not.toContain('kbai.json');
});

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
