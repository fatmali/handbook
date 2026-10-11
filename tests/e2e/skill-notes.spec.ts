import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('the portable notes-and-diagrams example installs through preview and reads as connected weekly notes', async ({ page }) => {
  await page.goto('./#/import');
  const example = readFileSync('skills/handbook-course-builder/assets/example-course.json');
  await page.getByLabel('Choose Course Pack JSON').setInputFiles({ name: 'notes-example.json', mimeType: 'application/json', buffer: example });
  await expect(page.getByRole('heading', { name: 'Review this course' })).toBeVisible();
  await expect(page.getByText(/no third-party course material included/i)).toBeVisible();
  await page.getByRole('button', { name: 'Confirm install course' }).click();
  await page.getByRole('link', { name: 'Read weekly course notes' }).click();
  await page.getByRole('link', { name: 'Week 1: Observation and explanation', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Week 1: Observation and explanation', exact: true })).toBeVisible();
  await expect(page.locator('.prose-section h3')).toHaveText([
    'What was observed and what is inferred',
    'Different predictions identify useful evidence',
    'What this lesson adds',
  ]);
  await expect(page.getByRole('img', { name: /Wet pavement is the observation/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next trace step' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Try without looking' })).toHaveCount(0);
  await expect(page.locator('.worked-example,.callout')).toHaveCount(0);
  await page.getByRole('button', { name: 'hypothesis', exact: true }).first().click();
  await expect(page.getByRole('complementary', { name: 'Definition: Hypothesis' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
