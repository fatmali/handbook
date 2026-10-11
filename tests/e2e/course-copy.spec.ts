import { test, expect } from '@playwright/test';
import { KBAI_COPY, LEGACY_KBAI_COPY, KBAI_COVERAGE_COPY } from '../../src/content/kbai-copy';
import { readFileSync } from 'node:fs';
import { validateCoursePack } from '../../packages/course-pack/src';
import { emptyProgress } from '../../src/domain';

const result = validateCoursePack(JSON.parse(readFileSync(new URL('../../src/content/kbai.json', import.meta.url), 'utf8')));
if (!result.ok) throw new Error('Invalid KBAI fixture');
const content = result.pack;

test('existing stock v4 copy is corrected without losing notes and coverage stays quiet', async ({ page }) => {
  const old = structuredClone(content);
  old.contentRevision = 4;
  old.metadata.subtitle = LEGACY_KBAI_COPY.subtitle;
  old.metadata.description = LEGACY_KBAI_COPY.description;
  old.coverage.summary = LEGACY_KBAI_COPY.coverage;
  old.coverage.gaps = old.coverage.gaps.map(gap => ({ ...gap, description: KBAI_COVERAGE_COPY[gap.id].previous }));
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Make room for understanding.' })).toBeVisible();
  await page.evaluate(async ({ pack, progress }) => {
    const request = indexedDB.open('handbook-v1');
    const db = await new Promise<IDBDatabase>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const tx = db.transaction(['packs', 'progress'], 'readwrite');
    tx.objectStore('packs').put(pack, 'kbai'); tx.objectStore('progress').put(progress, 'kbai');
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
    db.close();
  }, { pack: old, progress: { ...emptyProgress('kbai'), notes: { scratch: 'My private thought' } } });
  await page.reload();
  await expect(page.getByText(KBAI_COPY.description)).toBeVisible();
  await expect(page.getByText(LEGACY_KBAI_COPY.description)).toHaveCount(0);
  await page.getByRole('link', { name: 'Knowledge-Based AI', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Knowledge-Based AI', level: 1 })).toBeVisible();
  await expect(page.getByText(KBAI_COPY.description)).toBeVisible();
  await expect(page.getByText(KBAI_COPY.coverage)).not.toBeVisible();
  const disclosure = page.locator('summary', { hasText: 'Coverage & limitations' });
  await disclosure.focus(); await page.keyboard.press('Enter');
  await expect(page.getByText(KBAI_COPY.coverage)).toBeVisible();
  await page.goto('./#/notes/kbai');
  await expect(page.getByRole('textbox').first()).toHaveValue('My private thought');
});
test('a learner-edited introduction is not replaced by the stock-copy correction', async ({ page }) => {
  const old = structuredClone(content);
  old.contentRevision = 4; old.metadata.description = 'My own KBAI course introduction';
  old.metadata.subtitle = 'My semester';
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Make room for understanding.' })).toBeVisible();
  await page.evaluate(async pack => {
    const request = indexedDB.open('handbook-v1');
    const db = await new Promise<IDBDatabase>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const tx = db.transaction('packs', 'readwrite'); tx.objectStore('packs').put(pack, 'kbai');
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }); db.close();
  }, old);
  await page.reload();
  await expect(page.getByText('My own KBAI course introduction')).toBeVisible();
  await expect(page.getByText('My semester')).toBeVisible();
});
