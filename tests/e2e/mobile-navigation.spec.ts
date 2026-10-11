import { test, expect } from './fixtures';

test('visible mobile course tools expose practice, recall and sources without hash guessing', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('./');
  await page.getByRole('link', { name: 'Everyday evidence', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Everyday evidence', level: 1 })).toBeVisible();
  await page.getByText('Course tools', { exact: true }).click();
  const tools = page.getByRole('navigation', { name: 'Mobile course tools' });
  await tools.getByRole('link', { name: 'Practice', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Practice your reasoning' })).toBeVisible();
  await tools.getByRole('link', { name: 'Recall', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Retrieve, then compare' })).toBeVisible();
  await tools.getByRole('link', { name: 'Sources', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sources & coverage' })).toBeVisible();
  await tools.getByRole('link', { name: 'Chapters', exact: true }).click();
  await page.getByRole('link', { name: 'Start / resume Focus' }).click();
  await expect(page.getByText('Course tools', { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});
