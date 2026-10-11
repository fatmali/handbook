import { beforeEach, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { render, screen, fireEvent } from '@testing-library/react';
import { validateCoursePack, type CoursePack } from '../packages/course-pack/src';
import { kbaiFixture as content } from './course-fixtures';
import { KBAI_COPY, KBAI_COVERAGE_COPY, LEGACY_KBAI_COPY, correctStockKBAICopy, correctStockCourseCopy, DEMO_DESCRIPTION, LEGACY_DEMO_DESCRIPTION } from '../src/content/kbai-copy';
import { CoverageDetails } from '../src/components/CoverageDetails';
import { Library } from '../src/storage';
import { samplePack } from '../src/content/sample';
import { makeSession } from '../src/domain';

const result = validateCoursePack(content);
if (!result.ok) throw new Error('Invalid historical course');
const pack = result.pack;
function stockV4(): CoursePack {
  return {
    ...structuredClone(pack), contentRevision: 4,
    provenance: { ...pack.provenance, generator: 'scripts/build-kbai.ts' },
    metadata: { ...pack.metadata, subtitle: LEGACY_KBAI_COPY.subtitle, description: LEGACY_KBAI_COPY.description },
    coverage: { ...pack.coverage, summary: LEGACY_KBAI_COPY.coverage, gaps: pack.coverage.gaps.map(gap => ({ ...gap, description: KBAI_COVERAGE_COPY[gap.id].previous })) },
  };
}
beforeEach(() => vi.stubGlobal('indexedDB', new IDBFactory()));

it('uses ordinary course-purpose language rather than release diagnostics', () => {
  expect(pack.metadata.subtitle).toBe(KBAI_COPY.subtitle);
  expect(pack.metadata.description).toContain('Connected weekly course notes');
  expect([pack.metadata.subtitle, pack.metadata.description, pack.coverage.summary, ...pack.coverage.gaps.map(gap => gap.description)].join(' ')).not.toMatch(/benchmark|baseline|preserved|revision \d|declarative|private inputs|live-exam assistant/i);
  expect(pack.coverage.summary).toContain('All 26 ebook lessons');
});
it('keeps the original demo label but replaces only its stock product-description sentence', () => {
  expect(samplePack.metadata.subtitle).toBe('An original demonstration course');
  expect(samplePack.metadata.description).toBe(DEMO_DESCRIPTION);
  const old = { ...samplePack, contentRevision: 1, metadata: { ...samplePack.metadata, description: LEGACY_DEMO_DESCRIPTION } };
  expect(correctStockCourseCopy(old).metadata.description).toBe(DEMO_DESCRIPTION);
  const custom = { ...old, metadata: { ...old.metadata, description: 'My own evidence lesson' } };
  expect(correctStockCourseCopy(custom)).toBe(custom);
});
it('corrects exact stock v4 text without changing lessons, sources, scope, identities or revisions', () => {
  const old = stockV4();
  const fixed = correctStockKBAICopy(old);
  expect(fixed.metadata.description).toBe(KBAI_COPY.description);
  expect(fixed.metadata.subtitle).toBe(KBAI_COPY.subtitle);
  expect(fixed.coverage.summary).toBe(KBAI_COPY.coverage);
  expect(fixed.chapters).toEqual(old.chapters);
  expect(fixed.concepts).toEqual(old.concepts);
  expect(fixed.practice).toEqual(old.practice);
  expect(fixed.syllabus).toEqual(old.syllabus);
  expect(fixed.sources).toEqual(old.sources);
  expect(fixed.contentRevision).toBe(4);
  expect(fixed.metadata.updatedAt).toBe(old.metadata.updatedAt);
  expect(correctStockKBAICopy(fixed)).toBe(fixed);
});
it('never overwrites learner-edited fields or treats another imported course as the stock course', () => {
  const custom = stockV4();
  custom.metadata.title = 'My KBAI study';
  custom.metadata.description = 'My course description';
  custom.metadata.subtitle = 'My own semester';
  custom.coverage.summary = 'My own coverage note';
  custom.coverage.gaps[0].description = 'My own source gap';
  const fixed = correctStockKBAICopy(custom);
  expect(fixed.metadata).toEqual(custom.metadata);
  expect(fixed.coverage.summary).toBe(custom.coverage.summary);
  expect(fixed.coverage.gaps[0]).toEqual(custom.coverage.gaps[0]);
  expect(correctStockKBAICopy({ ...custom, id: 'imported-kbai' })).toEqual({ ...custom, id: 'imported-kbai' });
  const editedRevision = { ...custom, contentRevision: 6 };
  expect(correctStockKBAICopy(editedRevision)).toBe(editedRevision);
  const imported = { ...stockV4(), provenance: { ...pack.provenance, generator: 'My course builder' } };
  expect(correctStockKBAICopy(imported)).toBe(imported);
});
it('updates an already installed v4 course transactionally and preserves every private record', async () => {
  const library = await Library.open();
  await library.initialize([samplePack], null);
  const old = stockV4();
  await library.install(old, 0);
  let snapshot = await library.snapshot();
  const progress = snapshot.progress.find(progress => progress.courseId === 'kbai')!;
  await library.saveProgress({ ...progress, notes: { scratch: 'private note' }, bookmarks: { 'lesson-05': true }, focusPositions: { 'lesson-05': 3 }, diagramPositions: { 'lesson-05-diagram': 1 }, active: makeSession(old), last: { chapterId: 'lesson-05', blockId: old.chapters[4].blocks[3].id, mode: 'focus' } });
  snapshot = await library.snapshot();
  await library.initialize([pack, samplePack], null);
  const updated = await library.snapshot();
  expect(updated.packs.find(pack => pack.id === 'kbai')?.metadata.description).toBe(KBAI_COPY.description);
  expect(updated.progress).toEqual(snapshot.progress);
  expect(updated.profile).toEqual(snapshot.profile);
  expect(updated.revision).toBe(snapshot.revision + 1);
  await library.initialize([pack, samplePack], null);
  expect(await library.snapshot()).toEqual(updated);
  library.close();
});
it('places truthful learning limits behind an accessible closed disclosure', () => {
  render(<CoverageDetails pack={pack}/>);
  const disclosure = screen.getByText('Coverage & limitations').closest('details')!;
  expect(disclosure.open).toBe(false);
  expect(screen.getByText(pack.coverage.summary)).not.toBeVisible();
  fireEvent.click(screen.getByText('Coverage & limitations'));
  expect(screen.getByText(pack.coverage.summary)).toBeVisible();
  expect(screen.getByText(KBAI_COVERAGE_COPY['gap-transcripts'].current)).toBeVisible();
});
