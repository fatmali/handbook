import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { samplePack } from '../../src/content/sample';

test('library, reader and vocabulary share the original/import renderer', async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Make room for understanding.' })).toBeVisible();
  await page.goto('./#/chapter/everyday-evidence/evidence-01');
  await expect(page.getByRole('heading', { name: 'A wet pavement is not a weather report' })).toBeVisible();
  await page.getByRole('button', { name: 'hypothesis', exact: true }).first().click();
  await expect(page.getByRole('complementary', { name: 'Definition: Hypothesis' })).toBeVisible();
  await page.getByRole('button', { name: 'Close definition' }).click();
  await expect(page.getByRole('img', { name: /Wet pavement prompts/ })).toBeVisible();
  await page.getByRole('button', { name: 'Next trace step' }).click();
  await expect(page.getByText('2 / 3: Keep rival explanations')).toBeVisible();
});
test('invalid imports never install and a valid preview requires confirmation', async ({ page }) => {
  await page.goto('./#/import');
  const file = page.getByLabel('Choose Course Pack JSON');
  await file.setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ ...samplePack, profile: { ageBand: '13-15' } })) });
  await expect(page.getByRole('heading', { name: 'Course not imported' })).toBeVisible();
  const imported = structuredClone(samplePack); imported.id = 'import-evidence'; imported.metadata.title = 'Imported evidence course';
  await file.setInputFiles({ name: 'valid.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(imported)) });
  await expect(page.getByRole('heading', { name: 'Review this course' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirm install course' })).toBeVisible();
  await page.getByRole('button', { name: 'Confirm install course' }).click();
  await expect(page.getByRole('heading', { name: 'Imported evidence course', level: 1 })).toBeVisible();
  await page.getByRole('link', { name: 'A wet pavement is not a weather report' }).click();
  await expect(page.getByRole('img', { name: /Wet pavement prompts/ })).toBeVisible();
});
test('focus is untimed and resumes exact blocks and diagram steps after reload', async ({ page }) => {
  await page.goto('./#/focus/everyday-evidence/evidence-01');
  await expect(page.getByText('Untimed by default')).toBeVisible();
  await expect(page.getByRole('timer')).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Course' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Next step', exact: true }).click();
  await page.getByRole('button', { name: 'Next trace step' }).click();
  await expect(page.getByText('2 / 3: Keep rival explanations')).toBeVisible();
  await page.getByRole('button', { name: 'Save & stop' }).click();
  await expect(page).toHaveURL(/#\/course\/everyday-evidence/);
  await page.reload();
  await page.getByRole('link', { name: 'Start / resume Focus' }).click();
  await expect(page.getByText('Step 2 / 5')).toBeVisible();
  await expect(page.getByText('2 / 3: Keep rival explanations')).toBeVisible();
});
test('notes, highlights and course export maintain privacy and cross-course isolation', async ({ page }) => {
  await page.goto('./#/notes/everyday-evidence');
  const note = page.getByRole('textbox').first();
  await note.fill('PRIVATE learning note');
  await note.evaluate((element: HTMLTextAreaElement) => element.setSelectionRange(0, 7));
  await page.getByRole('button', { name: 'Highlight selection' }).first().click();
  await page.getByRole('button', { name: 'Save note' }).first().click();
  await page.getByRole('button', { name: 'Read note' }).first().click();
  await expect(page.locator('mark', { hasText: 'PRIVATE' })).toBeVisible();
  await page.goto('./#/course/everyday-evidence');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export course JSON' }).click()]);
  const path = await download.path();
  const { readFile } = await import('node:fs/promises');
  expect(await readFile(path!, 'utf8')).not.toContain('PRIVATE');
  await page.goto('./#/notes/kbai');
  await expect(page.getByRole('textbox').first()).toHaveValue('');
  await page.goto('./#/notes/everyday-evidence');
  await expect(page.getByRole('textbox').first()).toHaveValue('PRIVATE learning note');
});
test('generic practice supports skip, exact feedback and revisioned history without fake grades', async ({ page }) => {
  await page.goto('./#/practice/everyday-evidence');
  await page.getByRole('button', { name: 'Start untimed practice' }).click();
  await expect(page.getByRole('timer')).toHaveCount(0);
  await page.getByRole('button', { name: 'Check answer' }).click();
  await expect(page.getByText('Skipped, not scored as an answer')).toBeVisible();
  await page.getByRole('button', { name: 'Finish practice' }).click();
  await expect(page.getByRole('heading', { name: 'Practice results' })).toBeVisible();
  await expect(page.getByText(/0 \/ 2 exact matches; 2 skipped/)).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: /content revision 1, 0 exact matches/ })).toBeVisible();
});
test('90-minute original mocks keep scope, deadline and answers across reload', async ({ page }) => {
  await page.goto('./#/practice/kbai');
  await page.clock.install();
  await page.getByRole('button', { name: 'Start Exam 1 mock', exact: true }).click();
  await expect(page.getByText('Question 1 / 22')).toBeVisible();
  await expect(page.getByRole('timer')).toBeVisible();
  await page.getByRole('checkbox').first().check();
  await expect(page.getByRole('checkbox').first()).toBeChecked();
  await page.clock.fastForward(30000);
  await page.reload();
  await expect(page.getByText('Question 1 / 22')).toBeVisible();
  await expect(page.getByRole('checkbox').first()).toBeChecked();
  const time = await page.getByRole('timer').textContent();
  expect(time).toMatch(/^89:/);
  await page.getByRole('button', { name: 'Finish practice' }).click();
  await expect(page.getByText(/not an official grade/).first()).toBeVisible();
});
test('legacy Exam 1 links provide untimed scope without starting a mock', async ({ page }) => {
  await page.goto('./#exam-1');
  await page.getByRole('button', { name: 'Practice Exam 1 untimed' }).click();
  await expect(page.getByRole('heading', { name: 'Untimed practice' })).toBeVisible();
  await expect(page.getByRole('timer')).toHaveCount(0);
  const scope = await page.evaluate(async () => {
    const request = indexedDB.open('handbook-v1');
    const db = await new Promise<IDBDatabase>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const get = db.transaction('progress').objectStore('progress').get('kbai');
    const result = await new Promise<{ active: { questions: { chapterId: string }[]; deadline: number | null } }>((resolve, reject) => { get.onsuccess = () => resolve(get.result); get.onerror = () => reject(get.error); });
    db.close(); return result.active;
  });
  expect(scope.deadline).toBeNull();
  expect(scope.questions.every(question => Number(question.chapterId.slice(-2)) <= 12)).toBe(true);
});
test('local source PDF attachment persists and can be detached', async ({ page }) => {
  const pack = structuredClone(samplePack); pack.id = 'local-source-fixture';
  pack.sources[0].kind = 'ebook'; pack.sources[0].verification = 'unverified';
  await page.goto('./#/import');
  await page.getByLabel('Choose Course Pack JSON').setInputFiles({ name: 'source-fixture.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(pack)) });
  await page.getByRole('button', { name: 'Confirm install course' }).click();
  await expect(page).toHaveURL(/#\/course\/local-source-fixture/);
  await page.goto('./#/sources/local-source-fixture');
  const input = page.getByLabel('Attach matching local PDF').first();
  await input.setInputFiles({ name: 'private-source.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%original fixture only\n%%EOF') });
  await expect(page.getByText('Attached: private-source.pdf')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Attached: private-source.pdf')).toBeVisible();
  await page.getByRole('button', { name: 'Detach local PDF' }).click();
  await expect(page.getByText('Attached: private-source.pdf')).toHaveCount(0);
});
test('offline shell reload retains locally installed courses and the skill asset', async ({ page, context }) => {
  await page.goto('./');
  await page.evaluate(async () => { const registration = await navigator.serviceWorker.ready; if (!navigator.serviceWorker.controller) await new Promise<void>(resolve => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true })); return registration.scope; });
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Make room for understanding.' })).toBeVisible();
  await page.goto('./#/chapter/everyday-evidence/evidence-01');
  await expect(page.getByRole('heading', { name: 'A wet pavement is not a weather report' })).toBeVisible();
  const status = await page.evaluate(async () => (await fetch('/handbook/downloads/handbook-course-builder.zip')).status);
  expect(status).toBe(200);
});
test('mobile/light/dark layouts retain accessible controls and no horizontal page overflow', async ({ page }, testInfo) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Make room for understanding.' })).toBeVisible();
  for (const theme of ['light', 'dark']) {
    await page.getByLabel('Appearance').selectOption(theme);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(results.violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`library-${theme}.png`), fullPage: true });
  }
  await page.goto('./#/chapter/everyday-evidence/evidence-01');
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(results.violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('reader.png'), fullPage: true });
  await page.goto('./#/chapter/kbai/lesson-05');
  const sizes = await page.locator('.diagram').first().locator('svg').evaluate(svg => {
    const matrix = (svg as SVGSVGElement).getScreenCTM()!;
    return [...svg.querySelectorAll('text')].map(element => Number.parseFloat(getComputedStyle(element).fontSize) * Math.hypot(matrix.a, matrix.b));
  });
  expect(Math.min(...sizes)).toBeGreaterThanOrEqual(12);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
