import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { migrateLegacy } from '../src/migration';
import { validateCoursePack } from '../packages/course-pack/src';
import { kbaiFixture as kbaiJSON } from './course-fixtures';
import { Library } from '../src/storage';
import { validateBackup } from '../src/domain';

const result = validateCoursePack(kbaiJSON);
if (!result.ok) throw new Error('KBAI fixture invalid');
const kbai = result.pack;
const legacy = () => ({
  version: 1, updatedAt: 1791710000000,
  preferences: { theme: 'dark', lesson: '01', screen: 'focus', hours: 16, week: 7, form: 'A', exam: 1, focusDefault: true },
  notes: { 'lesson:01': 'private understanding', parking: 'one more thought' }, drafts: { 'r01-1': 'recall draft' },
  highlights: { 'note:lesson:01': [{ start: 0, end: 7 }] }, tasks: { '1:core': true }, objectives: { '01:0': true }, readDone: { source: true },
  reviews: { 'r01-1': { due: 100, rating: 'good', stage: 2, last: 50, lapses: 1 } }, reviewLog: [{ card: 'r01-1', at: 50, rating: 'good' }],
  attempts: [], active: null,
  focus: { lesson: '01', phase: 'paused', positions: { '01': 0 }, completed: { '01': false }, revealed: { 'r01-1': true } },
  handbook: { version: 1, activeCourse: 'kbai', last: { course: 'kbai', chapter: '01', mode: 'focus' }, courses: [], bookmarks: { 'kbai:01': true }, sessions: {} },
});
beforeEach(() => vi.stubGlobal('indexedDB', new IDBFactory()));
describe('legacy migration', () => {
  it('archives legacy KBAI privately without a public seed and connects it only after explicit local import', async () => {
    const value = legacy();
    const raw = JSON.stringify(value);
    const library = await Library.open();
    const migration = await library.initialize([], raw);
    expect(migration?.theme).toBe('dark');
    expect(migration?.pendingKBAI).toBe(true);
    expect((await library.snapshot()).packs).toEqual([]);
    expect((await library.snapshot()).progress).toEqual([]);
    expect(await library.legacyBackup()).toEqual(value);
    const backup = await library.privateBackup();
    expect(backup.packs).toEqual([]);
    expect(backup.legacy).toEqual(value);
    await library.install(kbai, 0);
    const installed = await library.snapshot();
    expect(installed.packs[0]).toEqual(kbai);
    expect(installed.progress[0].notes['chapter:lesson-01']).toBe('private understanding');
    expect(installed.progress[0].noteHighlights['chapter:lesson-01']).toEqual([{ start: 0, end: 7 }]);
    expect(await library.legacyBackup()).toEqual(value);
    await library.saveProgress({ ...installed.progress[0], notes: { ...installed.progress[0].notes, scratch: 'New work' } });
    await library.initialize([], raw);
    expect((await library.snapshot()).progress[0].notes.scratch).toBe('New work');
    library.close();
  });
  it('preserves long legacy notes/drafts and end highlights through subsequent saves and backup restore', async () => {
    const text = 'n'.repeat(25000);
    const value = { ...legacy(), notes: { 'lesson:01': text }, drafts: { 'r01-1': text }, highlights: { 'note:lesson:01': [{ start: 24990, end: 25000 }], 'draft:r01-1': [{ start: 24995, end: 25000 }] } };
    const library = await Library.open();
    await library.initialize([kbai], JSON.stringify(value));
    const progress = (await library.snapshot()).progress[0];
    await library.saveProgress({ ...progress, notes: { ...progress.notes, scratch: 'A later save still works' } });
    const backup = validateBackup(JSON.stringify(await library.privateBackup()));
    expect(backup.progress[0].notes['chapter:lesson-01']).toHaveLength(25000);
    expect(backup.progress[0].notes['recall:r01-1']).toHaveLength(25000);
    expect(backup.progress[0].noteHighlights['chapter:lesson-01']).toEqual([{ start: 24990, end: 25000 }]);
    await library.restore(JSON.stringify(backup), 0);
    expect((await library.snapshot()).progress[0].noteHighlights['recall:r01-1']).toEqual([{ start: 24995, end: 25000 }]);
    library.close();
  });
  it('preserves annotations, drafts, checks, resume, reviews and appearance without enabling timers', async () => {
    const raw = JSON.stringify(legacy());
    const migrated = migrateLegacy(raw, kbai);
    expect(migrated.theme).toBe('dark');
    expect(migrated.progress[0].notes['chapter:lesson-01']).toBe('private understanding');
    expect(migrated.progress[0].notes['recall:r01-1']).toBe('recall draft');
    expect(migrated.progress[0].noteHighlights['chapter:lesson-01']).toEqual([{ start: 0, end: 7 }]);
    expect(migrated.progress[0].bookmarks['lesson-01']).toBe(true);
    expect(migrated.progress[0].checks['1:core']).toBe(true);
    expect(migrated.progress[0].recall['r01-1'].stage).toBe(2);
    expect(migrated.progress[0].last?.chapterId).toBe('lesson-01');
    const library = await Library.open(); await library.initialize([kbai], raw);
    expect((await library.snapshot()).profile.studyTimers).toBe(false);
    expect(await library.legacyBackup()).toEqual(legacy()); library.close();
  });
  it('migrates active 90-minute mocks with bank snapshots and preserves deadline', () => {
    const value = { ...legacy(), active: { mode: 'mock', exam: 1, form: 'A', bankRevision: 1, questionIds: ['e1-01-a'], optionOrder: { 'e1-01-a': [4, 3, 2, 1, 0] }, answers: { 'e1-01-a': [0, 1] }, confidence: {}, flagged: {}, startedAt: 1000, deadline: 1000 + 90 * 60000, index: 0, revealed: {} } };
    const active = migrateLegacy(JSON.stringify(value), kbai).progress[0].active!;
    expect(active.deadline).toBe(1000 + 90 * 60000); expect(active.questions[0].id).toBe('e1-01-a');
    expect(active.answers['e1-01-a']).toHaveLength(2); expect(active.mode).toBe('mock');
    expect(active.answers['e1-01-a']).toContain(active.questions[0].options[4].id);
  });
  it('converts private courses through the same renderer contract and isolates notes', () => {
    const id = 'c-123456789abc'; const chapterId = 'p-123456789abc';
    const value = legacy();
    const raw = JSON.stringify({ ...value, notes: { ...value.notes, [`chapter:${id}:${chapterId}`]: 'personal note' }, handbook: { ...value.handbook, courses: [{ id, code: '', institution: '', term: '', title: 'Private course', description: '', sourceUrl: '', chapters: [{ id: chapterId, title: 'Original chapter', content: 'First paragraph.\n\nSecond paragraph.', sourceUrl: '' }] }], bookmarks: { [`${id}:${chapterId}`]: true }, last: { course: id, chapter: chapterId, mode: 'focus' }, sessions: { [`${id}:${chapterId}`]: { index: 1, phase: 'paused' } } } });
    const migrated = migrateLegacy(raw, kbai);
    expect(validateCoursePack(migrated.packs[0]).ok).toBe(true);
    expect(migrated.progress.find(progress => progress.courseId === id)?.notes[`chapter:${chapterId}`]).toBe('personal note');
    expect(migrated.progress[0].notes[`chapter:${id}:${chapterId}`]).toBeUndefined();
    expect(migrated.progress.find(progress => progress.courseId === id)?.focusPositions[chapterId]).toBe(1);
  });
  it('is transactional and idempotent; corrupt legacy state is not discarded', async () => {
    const library = await Library.open(); const raw = JSON.stringify(legacy());
    await library.initialize([kbai], raw);
    const before = await library.snapshot();
    await library.saveProgress({ ...before.progress[0], notes: { ...before.progress[0].notes, scratch: 'new work' } });
    await library.initialize([kbai], raw);
    expect((await library.snapshot()).progress[0].notes.scratch).toBe('new work');
    expect(await library.legacyBackup()).toEqual(legacy());
    library.close();
    const fresh = await Library.open('bad-migration');
    await expect(fresh.initialize([kbai], '{"version":2}')).rejects.toThrow();
    expect((await fresh.snapshot()).packs).toEqual([]);
    fresh.close();
  });
});
