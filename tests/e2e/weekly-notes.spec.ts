import { expect, test } from './fixtures';
import AxeBuilder from '@axe-core/playwright';
import { kbaiFixture } from '../course-fixtures';
import { emptyProgress } from '../../src/domain';

test('weekly notes are reachable, source-linked, and readable without trace or practice clutter', async ({ page }, testInfo) => {
  await page.goto('./#/course/kbai');
  await page.getByRole('link', { name: 'Read weekly course notes' }).click();
  await page.getByRole('link', { name: 'Week 3: Means-Ends Analysis & Production Systems', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Week 3: Means-Ends Analysis & Production Systems', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'State spaces: what is being searched?' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next trace step' })).toHaveCount(0);
  await expect(page.getByText('Use the difference between the current state and goal to select actions, and turn unmet preconditions into subproblems.')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Try without looking' }).first()).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Means-ends analysis', exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Means-ends analysis', exact: true }).first().click();
  await expect(page.getByRole('complementary', { name: 'Definition: Means-ends analysis' })).toBeVisible();
  await page.getByRole('button', { name: 'Close definition' }).click();
  const figures = page.locator('.diagram svg');
  await expect(figures).toHaveCount(4);
  const geometry = await figures.evaluateAll(elements => elements.map(element => {
    const svg = element as SVGSVGElement;
    const matrix = svg.getScreenCTM()!;
    return [...svg.querySelectorAll('text')].map(text => ({
      size: Number.parseFloat(getComputedStyle(text).fontSize) * Math.hypot(matrix.a, matrix.b),
      within: text.getBBox().x >= 0 && text.getBBox().x + text.getBBox().width <= svg.viewBox.baseVal.width,
    }));
  }));
  expect(geometry.flat().every(text => text.size >= 12 && text.within)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(results.violations).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath('week3-notes.png'), fullPage: true });
  await page.goto('./#/weekly/kbai/week-07');
  await expect(page.getByRole('heading', { name: 'Implication truth table' })).toBeVisible();
  await page.goto('./#/weekly/kbai/week-15');
  await expect(page.getByText(/There are no new lessons this week/)).toBeVisible();
  await expect(page.locator('.weekly-lesson')).toHaveCount(0);
  await page.goto('./#week-11');
  await expect(page.getByRole('heading', { name: 'Week 11: Version Spaces & Constraint Propagation', exact: true })).toBeVisible();
});

test('an installed v5 course changes only after local update import and keeps private records', async ({ page }) => {
  const old = structuredClone(kbaiFixture);
  old.contentRevision = 5;
  old.metadata.description = 'My installed v5 course';
  old.chapters[4].blocks = [
    { id: 'lesson-05-callout-1', kind: 'callout', tone: 'note', title: 'Preview', text: 'Old private anchor text', conceptIds: [], citations: [] },
    { id: 'lesson-05-diagram-1', kind: 'diagram', title: 'Old diagram', caption: 'Old diagram caption', alternative: 'Old diagram alternative', nodes: [{ id: 'old-node', label: 'Old node', detail: 'Old detail', column: 0 }], edges: [], steps: [{ title: 'Old step', explanation: 'Old explanation', activeNodeIds: ['old-node'] }], conceptIds: [], citations: [] },
    ...old.chapters[4].blocks.filter(block => block.kind === 'recall'),
  ];
  const progress = {
    ...emptyProgress('kbai'), notes: { scratch: 'Keep my private note' },
    noteHighlights: { scratch: [{ start: 0, end: 4 }] }, bookmarks: { 'lesson-05': true },
    annotations: [{ id: 'old-quote', chapterId: 'lesson-05', blockId: 'lesson-05-callout-1', quote: 'Old private anchor text', note: 'Keep the quote note', status: 'current', createdAt: 1 }],
    focusPositions: { 'lesson-05': 0 }, diagramPositions: { 'lesson-05-diagram-1': 0 },
    last: { chapterId: 'lesson-05', blockId: 'lesson-05-callout-1', mode: 'focus' },
  };
  const archive = { untouched: 'original private snapshot' };
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Make room for understanding.' })).toBeVisible();
  await page.evaluate(async ({ old, progress, archive }) => {
    const request = indexedDB.open('handbook-v1');
    const db = await new Promise<IDBDatabase>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const tx = db.transaction(['packs', 'progress', 'meta', 'assets'], 'readwrite');
    tx.objectStore('packs').put(old, 'kbai');
    tx.objectStore('progress').put(progress, 'kbai');
    tx.objectStore('meta').put(archive, 'legacyBackup');
    tx.objectStore('assets').put({ id: 'kbai:ebook-2016', courseId: 'kbai', sourceId: 'ebook-2016', name: 'private.pdf', fingerprint: 'retained', blob: new Blob(['%PDF-private fixture']) }, 'kbai:ebook-2016');
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); });
    db.close();
  }, { old, progress, archive });
  await page.goto('./#/course/kbai');
  await page.reload();
  await expect(page.getByText('My installed v5 course', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Review course update' })).toHaveCount(0);
  await page.goto('./#/import');
  await page.getByLabel('Choose Course Pack JSON').setInputFiles({ name: 'local-kbai-update.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(kbaiFixture)) });
  await expect(page.getByRole('heading', { name: 'Replace revision 5' })).toBeVisible();
  await expect(page.getByText(/Changed or missing annotation anchors will be flagged, never guessed/)).toBeVisible();
  await page.getByRole('button', { name: 'Confirm replace course' }).click();
  await expect(page.getByText(/Connected weekly course notes/)).toBeVisible();
  const stored = await page.evaluate(async () => {
    const request = indexedDB.open('handbook-v1');
    const db = await new Promise<IDBDatabase>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const tx = db.transaction(['packs', 'progress', 'meta', 'assets']);
    const get = (store: string, key: string) => new Promise<unknown>((resolve, reject) => { const req = tx.objectStore(store).get(key); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
    const values = await Promise.all([get('packs', 'kbai'), get('progress', 'kbai'), get('meta', 'legacyBackup'), get('assets', 'kbai:ebook-2016')]);
    db.close();
    return values;
  });
  expect(stored[0]).toMatchObject({ contentRevision: 6 });
  expect(stored[1]).toMatchObject({ notes: progress.notes, noteHighlights: progress.noteHighlights, bookmarks: progress.bookmarks, annotations: [{ ...progress.annotations[0], status: 'orphaned' }], last: null });
  expect(stored[2]).toEqual(archive);
  expect(stored[3]).toMatchObject({ fingerprint: 'retained', name: 'private.pdf' });
  await page.goto('./#/focus/kbai/lesson-05');
  await expect(page.getByRole('heading', { name: 'Choose a new study anchor' })).toBeVisible();
  await page.goto('./#/weekly/kbai/week-03');
  await expect(page.getByRole('heading', { name: 'Why getting closer can trap the search' })).toBeVisible();
});
