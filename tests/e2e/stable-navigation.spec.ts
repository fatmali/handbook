import { expect, test } from './fixtures';
import AxeBuilder from '@axe-core/playwright';

test('app navigation keeps identical labels and destinations when different courses open', async ({ page }, testInfo) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Make room for understanding.' })).toBeVisible();
  const railLinks = () => page.locator('.rail a').evaluateAll(links => links.map(link => ({
    text: link.textContent, href: link.getAttribute('href'),
  })));
  const mobileLinks = () => page.getByRole('navigation', { name: 'Mobile navigation' }).locator('a').evaluateAll(links => links.map(link => ({
    text: link.textContent, href: link.getAttribute('href'),
  })));
  const originalRail = await railLinks();
  const originalMobile = await mobileLinks();
  expect(originalRail).toEqual([
    { text: 'Handbook', href: '#/library' },
    { text: 'Course library', href: '#/library' },
    { text: 'Import course', href: '#/import' },
    { text: 'Settings & backups', href: '#/settings' },
  ]);
  await expect(page.locator('.course-context')).toHaveCount(0);
  const courseIds = ['kbai', 'everyday-evidence'];
  for (const [index, title] of ['Knowledge-Based AI', 'Everyday evidence'].entries()) {
    await page.getByRole('link', { name: title, exact: true }).click();
    await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible();
    expect(await railLinks()).toEqual(originalRail);
    expect(await mobileLinks()).toEqual(originalMobile);
    await expect(page.locator('.rail [href*="/kbai"], .rail [href*="/everyday-evidence"]')).toHaveCount(0);
    const context = page.locator('.course-context');
    await expect(context).toBeVisible();
    const course = context.locator('.course-tabs');
    expect(await course.locator('a').evaluateAll(links => links.map(link => link.getAttribute('href')))).toEqual(
      ['course', 'weekly', 'syllabus', 'vocabulary', 'practice', 'recall', 'notes', 'sources'].map(route => `#/${route}/${courseIds[index]}`),
    );
    await expect(course.locator('[aria-current="page"]')).toHaveText('Chapters');
    if (testInfo.project.name === 'desktop') {
      await expect(page.locator('.rail')).toBeVisible();
      await course.getByRole('link', { name: 'Vocabulary', exact: true }).click();
    } else {
      await context.getByText('Course tools', { exact: true }).click();
      await context.getByRole('navigation', { name: 'Mobile course tools' }).getByRole('link', { name: 'Vocabulary', exact: true }).click();
    }
    await expect(page).toHaveURL(new RegExp(`#/vocabulary/${courseIds[index]}$`));
    await expect(page.getByRole('heading', { name: 'Vocabulary & source crosswalk' })).toBeVisible();
    expect(await railLinks()).toEqual(originalRail);
    expect(await mobileLinks()).toEqual(originalMobile);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await context.getByRole('link', { name: 'Change course' }).click();
    await expect(page.getByRole('heading', { name: 'Make room for understanding.' })).toBeVisible();
    await expect(page.locator('.course-context')).toHaveCount(0);
  }
  await page.goto('./#/weekly/kbai/week-03');
  await expect(page.getByRole('heading', { name: 'Week 3: Means-Ends Analysis & Production Systems', exact: true })).toBeVisible();
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(results.violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('stable-navigation.png') });
});

test('changing courses saves a private draft and keeps course tools out of global pages and Focus', async ({ page }, testInfo) => {
  await page.goto('./#/notes/everyday-evidence');
  const text = 'A private evidence thought';
  await page.getByRole('textbox').first().fill(text);
  await page.locator('.course-context').getByRole('link', { name: 'Change course' }).click();
  await expect(page).toHaveURL(/#\/library$/);
  await page.getByRole('link', { name: 'Knowledge-Based AI', exact: true }).click();
  const context = page.locator('.course-context');
  if (testInfo.project.name === 'mobile') await context.getByText('Course tools', { exact: true }).click();
  await context.getByRole('link', { name: 'Notebook', exact: true }).filter({ visible: true }).click();
  await expect(page.getByRole('textbox').first()).toHaveValue('');
  await context.getByRole('link', { name: 'Change course' }).click();
  await page.getByRole('link', { name: 'Everyday evidence', exact: true }).click();
  if (testInfo.project.name === 'mobile') await context.getByText('Course tools', { exact: true }).click();
  await context.getByRole('link', { name: 'Notebook', exact: true }).filter({ visible: true }).click();
  await expect(page.getByRole('textbox').first()).toHaveValue(text);
  await page.goto('./#/settings');
  await expect(page.getByRole('heading', { name: 'Settings & private backups' })).toBeVisible();
  await expect(context).toHaveCount(0);
  await page.goto('./#/import');
  await expect(page.getByRole('heading', { name: 'Import a course handbook' })).toBeVisible();
  await expect(context).toHaveCount(0);
  await page.goto('./#/focus/everyday-evidence/evidence-01');
  await expect(page.getByRole('button', { name: 'Save & stop' })).toBeVisible();
  await expect(context).toHaveCount(0);
  await expect(page.locator('.rail')).toHaveCount(0);
});
