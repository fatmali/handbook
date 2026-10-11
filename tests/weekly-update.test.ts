import { beforeEach, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { execFileSync } from 'node:child_process';
import { validateCoursePack } from '../packages/course-pack/src';
import content from '../src/content/kbai.json';
import { Library } from '../src/storage';
import { diffPacks, emptyProgress, makeSession, reconcileProgress } from '../src/domain';
import { migrateLegacy } from '../src/migration';

const currentResult = validateCoursePack(content);
const previousResult = validateCoursePack(JSON.parse(execFileSync('git', ['show', 'ea89ab985acbfab6497e99ac017e42d534d8580a:src/content/kbai.json'], { encoding: 'utf8', maxBuffer: 4_000_000 })));
if (!currentResult.ok || !previousResult.ok) throw new Error('Invalid course revision fixture');
const current = currentResult.pack;
const previous = previousResult.pack;

beforeEach(() => vi.stubGlobal('indexedDB', new IDBFactory()));

it('reconciles the actual shipped v5 course without inventing replacement anchors or regrading histories', async () => {
  expect(previous.contentRevision).toBe(5);
  expect(current.syllabus.assessments).toEqual(previous.syllabus.assessments);
  expect(current.practice).toEqual(previous.practice);
  expect(current.assets).toEqual(previous.assets);
  expect(current.sources).toEqual(previous.sources);
  const oldBlock = previous.chapters[4].blocks[0];
  const oldDiagram = previous.chapters[4].blocks.find(block => block.kind === 'diagram')!;
  const recall = previous.chapters[4].blocks.find(block => block.kind === 'recall')!;
  const session = makeSession(previous, 'exam-1', 1000);
  session.answers[session.questions[0].id] = [session.questions[0].options[0].id];
  const progress = {
    ...emptyProgress('kbai'), notes: { scratch: 'Private note', 'chapter:lesson-05': 'Private chapter' },
    noteHighlights: { scratch: [{ start: 0, end: 7 }] }, bookmarks: { 'lesson-05': true },
    checks: { 'outcome-01': true }, focusPositions: { 'lesson-05': 0 }, diagramPositions: { [oldDiagram.id]: 3 },
    recall: { [recall.id]: { due: 1000, rating: 'good' as const, stage: 2 } },
    active: session, history: [{ ...session, finishedAt: 2000, reason: 'submitted' as const }],
    last: { chapterId: 'lesson-05', blockId: oldBlock.id, mode: 'focus' as const },
    annotations: [{ id: 'quoted-v5', chapterId: 'lesson-05', blockId: oldBlock.id, quote: 'Private selected quote', note: 'Keep this', status: 'current' as const, createdAt: 1 }],
  };
  const diff = diffPacks(previous, current);
  expect(diff.removed).toContain(oldBlock.id);
  expect(diff.questionChanges).toEqual([]);
  const reconciled = reconcileProgress(progress, previous, current);
  expect(reconciled.last).toBeNull();
  expect(reconciled.focusPositions['lesson-05']).toBeUndefined();
  expect(reconciled.annotations[0]).toEqual({ ...progress.annotations[0], status: 'orphaned' });
  expect(reconciled.anchorWarnings.map(warning => warning.kind)).toEqual(['focus', 'diagram']);
  for (const key of ['notes', 'noteHighlights', 'bookmarks', 'checks', 'recall', 'active', 'history'] as const) expect(reconciled[key]).toEqual(progress[key]);
  const library = await Library.open();
  await library.initialize([previous], null);
  await library.saveProgress(progress);
  const before = await library.snapshot();
  await library.initialize([current], null);
  expect(await library.snapshot()).toEqual(before);
  await library.install(current, before.revision);
  expect((await library.snapshot()).packs[0]).toEqual(current);
  expect((await library.snapshot()).progress[0].active).toEqual(session);
  library.close();
});

it('preserves an old legacy anchor with an explicit warning instead of treating the new first block as its match', () => {
  const old = { version: 1, updatedAt: 1, preferences: { theme: 'light', lesson: '05', screen: 'focus' }, notes: {}, drafts: {}, tasks: {}, objectives: {}, readDone: {}, reviews: {}, reviewLog: [], attempts: [], active: null, focus: { lesson: '05', phase: 'paused', positions: { '05': 0 }, completed: {}, revealed: {} } };
  const migrated = migrateLegacy(JSON.stringify(old), current).progress[0];
  expect(migrated.last?.blockId).toBe('lesson-05-callout-1');
  expect(migrated.anchorWarnings[0]).toMatchObject({ chapterId: 'lesson-05', kind: 'focus', blockId: 'lesson-05-callout-1' });
  expect(migrated.focusPositions['lesson-05']).toBeUndefined();
});
