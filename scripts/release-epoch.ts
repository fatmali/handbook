import { createHash } from 'node:crypto';

export function releaseEpoch(files: Record<string, string | Uint8Array>) {
  const hash = createHash('sha256');
  for (const name of Object.keys(files).sort()) { hash.update(name); hash.update('\0'); hash.update(files[name]); hash.update('\0'); }
  return hash.digest('hex').slice(0, 20);
}
export function renderWorker(template: string, version: string, urls: string[]) {
  if (!template.includes('const URLS = __URLS__;')) throw new Error('Service-worker precache placeholder is missing.');
  return template.replace('__VERSION__', version).replace('const URLS = __URLS__;', `const URLS = ${JSON.stringify(urls)};`);
}
