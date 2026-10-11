import { test, expect } from '@playwright/test';

test('legacy appearance migrates before new preferences are written and the original key remains', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('kbai-study-companion-v1', JSON.stringify({
      version: 1, updatedAt: 1791710000000,
      preferences: { theme: 'dark', week: 7, lesson: '01', hours: 16, screen: 'focus', focusDefault: true, exam: 1, form: 'A' },
      notes: { 'lesson:01': 'An original private note' }, drafts: {}, highlights: { 'note:lesson:01': [{ start: 0, end: 2 }] },
      tasks: {}, objectives: {}, readDone: {}, reviews: {}, reviewLog: [], attempts: [], active: null,
      focus: { lesson: '01', phase: 'paused', positions: { '01': 0 }, completed: {}, revealed: {} },
    }));
  });
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Make room for understanding.' })).toBeVisible();
  await expect(page.getByLabel('Appearance')).toHaveValue('dark');
  expect(await page.evaluate(() => localStorage.getItem('handbook-theme'))).toBe('dark');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('kbai-study-companion-v1')!).preferences.theme)).toBe('dark');
  await page.goto('./#/notes/kbai');
  await page.getByText('chapter:lesson-01', { exact: true }).click();
  await expect(page.getByRole('textbox').nth(1)).toHaveValue('An original private note');
});
