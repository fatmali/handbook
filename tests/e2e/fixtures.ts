import { test as base, expect } from '@playwright/test';
import { kbaiFixture } from '../course-fixtures';
import { samplePack } from '../../src/content/sample';
import { emptyProgress } from '../../src/domain';

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.goto('./');
    await expect(page.getByRole('heading', { name: 'Your course, your handbook.' })).toBeVisible();
    await page.evaluate(async ({ packs, progress }) => {
      const request = indexedDB.open('handbook-v1');
      const db = await new Promise<IDBDatabase>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
      const tx = db.transaction(['packs', 'progress'], 'readwrite');
      for (const pack of packs) tx.objectStore('packs').put(pack, pack.id);
      for (const value of progress) tx.objectStore('progress').put(value, value.courseId);
      await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
      db.close();
    }, { packs: [kbaiFixture, samplePack], progress: [emptyProgress(kbaiFixture.id), emptyProgress(samplePack.id)] });
    await page.goto('about:blank');
    await use(page);
  },
});

export { expect };
