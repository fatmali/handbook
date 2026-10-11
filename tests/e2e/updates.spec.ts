import { test, expect } from '@playwright/test';
import { samplePack } from '../../src/content/sample';

declare global {
  interface Window {
    handbookTestUpdate?: () => void;
    handbookTestActivation?: boolean;
  }
}

test('content update preserves the exact cursor and marks/removes orphaned annotations deliberately', async ({ page }) => {
  await page.goto('./#/focus/everyday-evidence/evidence-01');
  await page.getByRole('button', { name: 'Next step', exact: true }).click();
  await page.getByRole('button', { name: 'Next step', exact: true }).click();
  await page.getByRole('button', { name: 'Save & stop' }).click();
  await expect(page).toHaveURL(/#\/course\/everyday-evidence/);
  await page.goto('./#/chapter/everyday-evidence/evidence-01');
  await page.getByRole('button', { name: 'Save selected quote or bookmark this block' }).first().click();
  await expect(page.getByText('Block bookmarked in your private notebook.')).toBeVisible();
  const next = structuredClone(samplePack);
  next.contentRevision = 2;
  const original = next.chapters[0].blocks.shift()!;
  next.chapters[0].blocks.unshift({ ...original, id: 'insert-1' }, { ...original, id: 'insert-2' });
  await page.goto('./#/import');
  await page.getByLabel('Choose Course Pack JSON').setInputFiles({ name: 'update.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(next)) });
  await page.getByRole('button', { name: 'Confirm replace course' }).click();
  await expect(page).toHaveURL(/#\/course\/everyday-evidence/);
  await page.getByRole('link', { name: 'Start / resume Focus' }).click();
  await expect(page.getByText('Step 4 / 6')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Why did the plant droop?' })).toBeVisible();
  await page.goto('./#/notes/everyday-evidence');
  await expect(page.getByText(/Original anchor removed. Quote and note are preserved./)).toBeVisible();
  await page.getByLabel('Note about this passage').fill('Preserved private annotation');
  await page.getByRole('button', { name: 'Save annotation' }).click();
  await expect(page.getByText('Annotation saved locally.')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Note about this passage')).toHaveValue('Preserved private annotation');
  await page.getByRole('button', { name: 'Remove annotation' }).click();
  await expect(page.getByLabel('Note about this passage')).toHaveCount(0);
});

test('service-worker update and controller changes cannot interrupt Focus or a mock', async ({ page }) => {
  await page.addInitScript(() => {
    const global = window;
    const installing = Object.assign(new EventTarget(), { state: 'installing' });
    const registration = Object.assign(new EventTarget(), { installing, waiting: null as { postMessage: () => void } | null });
    Object.defineProperty(navigator.serviceWorker, 'register', { value: async () => registration });
    Object.defineProperty(navigator.serviceWorker, 'controller', { value: {}, configurable: true });
    global.handbookTestActivation = false;
    global.handbookTestUpdate = () => {
      registration.waiting = { postMessage: () => { global.handbookTestActivation = true; } };
      registration.dispatchEvent(new Event('updatefound'));
      installing.state = 'installed'; installing.dispatchEvent(new Event('statechange'));
      navigator.serviceWorker.dispatchEvent(new Event('controllerchange'));
    };
  });
  await page.goto('./#/focus/everyday-evidence/evidence-01');
  await page.getByRole('button', { name: 'Next step', exact: true }).click();
  await page.evaluate(() => { if (!window.handbookTestUpdate) throw new Error('Missing update fixture'); window.handbookTestUpdate(); });
  await expect(page.getByRole('button', { name: 'Update and reload' })).toBeDisabled();
  await expect(page.getByText('Step 2 / 5')).toBeVisible();
  await page.getByRole('button', { name: 'Save & stop' }).click();
  await expect(page).toHaveURL(/#\/course\/everyday-evidence/);
  await expect(page.getByRole('button', { name: 'Update and reload' })).toBeEnabled();
  await page.goto('./#/practice/kbai');
  await page.getByRole('button', { name: 'Start Exam 1 mock', exact: true }).click();
  await page.evaluate(() => { if (!window.handbookTestUpdate) throw new Error('Missing update fixture'); window.handbookTestUpdate(); });
  await expect(page.getByRole('button', { name: 'Update and reload' })).toBeDisabled();
  await expect(page.getByText('Question 1 / 22')).toBeVisible();
});
