import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { samplePack } from '../../src/content/sample';

test('new visitors start with onboarding, not someone else’s course, even offline after activation', async ({ page, context }, testInfo) => {
  const requests: string[] = [];
  page.on('request', request => requests.push(request.url()));
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Your course, your handbook.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Import your notes' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Download the course-builder skill' })).toBeVisible();
  await expect(page.getByText('Your library is empty.', { exact: false })).toBeVisible();
  await expect(page.locator('.course-shelf,.course-context')).toHaveCount(0);
  expect(requests.some(url => /\/courses\/kbai\.json/.test(url))).toBe(false);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(results.violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('onboarding.png'), fullPage: true });
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise<void>(resolve => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true }));
  });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Your course, your handbook.' })).toBeVisible();
  await page.getByRole('button', { name: 'Import your notes' }).click();
  await expect(page.getByRole('heading', { name: 'Import a course handbook' })).toBeVisible();
  expect(await page.evaluate(async () => (await fetch('/handbook/downloads/handbook-course-builder.zip')).status)).toBe(200);
});

test('local import requires confirmation, persists only the visitor’s course, and never uploads their notes', async ({ page, browser }) => {
  const uploads: string[] = [];
  page.on('request', request => { if (request.method() !== 'GET') uploads.push(request.url()); });
  await page.goto('./');
  await page.getByRole('button', { name: 'Import your notes' }).click();
  const course = structuredClone(samplePack);
  course.id = 'my-own-course';
  course.metadata.title = 'My own course notes';
  await page.getByLabel('Choose Course Pack JSON').setInputFiles({ name: 'my-notes.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(course)) });
  await expect(page.getByRole('heading', { name: 'Review this course' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your course, your handbook.' })).toBeVisible();
  await page.getByRole('button', { name: 'Import your notes' }).click();
  await page.getByLabel('Choose Course Pack JSON').setInputFiles({ name: 'my-notes.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(course)) });
  await page.getByRole('button', { name: 'Confirm install course' }).click();
  await expect(page.getByRole('heading', { name: 'My own course notes', level: 1 })).toBeVisible();
  await page.goto('./#/notes/my-own-course');
  await page.getByRole('textbox').first().fill('My private margin note');
  await page.getByRole('button', { name: 'Save note' }).first().click();
  await expect(page.getByRole('button', { name: 'Save note' }).first()).toBeEnabled();
  await page.reload();
  await expect(page.getByRole('textbox').first()).toHaveValue('My private margin note');
  await page.goto('./');
  await expect(page.locator('.course-volume')).toHaveCount(1);
  await expect(page.getByRole('link', { name: 'My own course notes', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Knowledge-Based AI', exact: true })).toHaveCount(0);
  expect(uploads).toEqual([]);
  const fresh = await browser.newContext();
  try {
    const other = await fresh.newPage();
    await other.goto(page.url());
    await expect(other.getByRole('heading', { name: 'Your course, your handbook.' })).toBeVisible();
    await expect(other.getByRole('link', { name: 'My own course notes', exact: true })).toHaveCount(0);
  } finally { await fresh.close(); }
});

test('empty-library settings and missing course links are safe and do not manufacture a course', async ({ page }) => {
  await page.goto('./#/focus/kbai/lesson-05');
  await expect(page.getByRole('heading', { name: 'Saved course or chapter is unavailable' })).toBeVisible();
  await expect(page.locator('.rail')).toBeAttached();
  await page.goto('./#/settings');
  await expect(page.getByRole('heading', { name: 'Settings & private backups' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Export selected private course backup' })).toHaveCount(0);
  const [backup] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export private backup', exact: true }).click()]);
  const path = await backup.path();
  const { readFile } = await import('node:fs/promises');
  const data = JSON.parse(await readFile(path!, 'utf8'));
  expect(data.packs).toEqual([]);
  expect(data.progress).toEqual([]);
  await page.goto('./#/import');
  await page.getByLabel('Choose Course Pack JSON').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{"notes":"not a course pack"}') });
  await expect(page.getByRole('heading', { name: 'Course not imported' })).toBeVisible();
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Your course, your handbook.' })).toBeVisible();
});
