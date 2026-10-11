import { describe, expect, it } from 'vitest';
import { adjustNoteHighlights, diffPacks, emptyProgress, exactMatch, finishSession, latestResume, makeSession, reconcileProgress, validateBackup } from '../src/domain';
import { samplePack } from '../src/content/sample';
import { defaultProfile } from '../packages/course-pack/src';

describe('generic practice and updates', () => {
  it('resumes the last saved course, not the first IndexedDB course', () => {
    const first = { ...emptyProgress('first'), updatedAt: 100, last: { chapterId: 'a', mode: 'focus' as const, blockId: 'a-block' } };
    const second = { ...emptyProgress('second'), updatedAt: 200, last: { chapterId: 'b', mode: 'chapter' as const, blockId: 'b-block' } };
    expect(latestResume([first, second])?.courseId).toBe('second');
    expect(latestResume([])).toBeNull();
  });
  it('uses exact multiple-correct sets; skip and extra options are not exact', () => {
    const q = samplePack.practice[0];
    const correct = q.options.filter(option => option.correct).map(option => option.id);
    expect(exactMatch(q, correct)).toBe(true); expect(exactMatch(q, [])).toBe(false);
    expect(exactMatch(q, q.options.map(option => option.id))).toBe(false);
    expect(exactMatch(q, [correct[0], correct[0]])).toBe(false);
  });
  it('keeps untimed practice and snapshots separate from content', () => {
    const session = makeSession(samplePack, null, 100);
    expect(session.deadline).toBeNull(); expect(session.questions).toHaveLength(2);
    session.questions[0].prompt = 'changed locally';
    expect(samplePack.practice.some(q => q.prompt === 'changed locally')).toBe(false);
  });
  it('enforces declared mock scope, count, option shape, duration and expiry after reload', () => {
    const pack = structuredClone(samplePack);
    pack.syllabus.assessments = [{ id: 'sample-exam', title: 'Sample mock', kind: 'exam', dueAt: '2026-10-11T23:59:00-12:00', timezone: 'Etc/GMT+12', chapterIds: ['evidence-01'], policyIds: [], description: 'Original practice', mock: { durationMinutes: 90, questionCount: 2, optionCount: 3, minCorrect: 1, maxCorrect: 2 }, citations: [] }];
    const session = makeSession(pack, 'sample-exam', 1000);
    expect(session.deadline).toBe(1000 + 90 * 60000); expect(session.questions).toHaveLength(2);
    const reloaded = JSON.parse(JSON.stringify(session));
    expect(finishSession(reloaded, session.deadline! + 1).reason).toBe('expired');
    pack.syllabus.assessments[0].mock!.questionCount = 22;
    expect(() => makeSession(pack, 'sample-exam')).toThrow('Not enough');
  });
  it('keeps assessment-scoped untimed practice distinct from opt-in mocks', () => {
    const pack = structuredClone(samplePack);
    pack.practice.push({ ...pack.practice[0], id: 'out-of-scope', chapterId: 'outside' });
    pack.syllabus.assessments = [{ id: 'scope', title: 'Original exam scope', kind: 'exam', dueAt: '2026-10-11T23:59:00-12:00', timezone: 'Etc/GMT+12', chapterIds: ['evidence-01'], policyIds: [], description: 'Scope', citations: [] }];
    const scoped = makeSession(pack, 'scope', 100, 'practice');
    expect(scoped.deadline).toBeNull(); expect(scoped.mode).toBe('practice');
    expect(scoped.questions.every(question => question.chapterId === 'evidence-01')).toBe(true);
    expect(makeSession(pack).questions).toHaveLength(3);
  });
  it('requires new question revisions, preserves history, and visibly marks changed/orphaned anchors', () => {
    const old = structuredClone(samplePack); const next = structuredClone(old); next.contentRevision++;
    const progress = emptyProgress(old.id); progress.active = makeSession(old);
    progress.annotations = [{ id: 'a1', chapterId: old.chapters[0].id, blockId: old.chapters[0].blocks[0].id, note: 'My note', quote: 'My quote', status: 'current', createdAt: 100 }];
    next.chapters[0].blocks[0] = { ...next.chapters[0].blocks[0], citations: [] };
    expect(reconcileProgress(progress, old, next).annotations[0].status).toBe('changed');
    next.chapters[0].blocks.shift();
    expect(reconcileProgress(progress, old, next).annotations[0]).toMatchObject({ status: 'orphaned', quote: 'My quote', note: 'My note' });
    next.practice[0].prompt = 'New prompt';
    expect(() => diffPacks(old, next)).toThrow('increment');
    next.practice[0].revision++;
    expect(diffPacks(old, next).questionChanges).toEqual([next.practice[0].id]);
    expect(reconcileProgress(progress, old, next).active?.questions).toEqual(progress.active.questions);
  });
  it('shifts unaffected highlights and removes overlaps instead of guessing', () => {
    expect(adjustNoteHighlights('hello world', 'Xhello world', [{ start: 6, end: 11 }])).toEqual([{ start: 7, end: 12 }]);
    expect(adjustNoteHighlights('hello world', 'hello earth', [{ start: 6, end: 11 }])).toEqual([]);
  });
  it('reconciles inserted/reordered blocks by exact IDs and flags removed/moved cursors', () => {
    const old = structuredClone(samplePack); const next = structuredClone(old); next.contentRevision++;
    const progress = emptyProgress(old.id);
    progress.focusPositions[old.chapters[0].id] = 2;
    progress.last = { chapterId: old.chapters[0].id, blockId: old.chapters[0].blocks[2].id, mode: 'focus' };
    progress.annotations = [{ id: 'cursor-note', chapterId: old.chapters[0].id, blockId: old.chapters[0].blocks[2].id, note: 'keep', quote: 'keep', status: 'current', createdAt: 1 }];
    next.chapters[0].blocks.unshift({ ...next.chapters[0].blocks[0], id: 'inserted-before' });
    expect(reconcileProgress(progress, old, next).focusPositions[old.chapters[0].id]).toBe(3);
    next.chapters[0].blocks.reverse();
    expect(reconcileProgress(progress, old, next).focusPositions[old.chapters[0].id]).toBe(next.chapters[0].blocks.findIndex(block => block.id === progress.last!.blockId));
    const moved = next.chapters[0].blocks.splice(next.chapters[0].blocks.findIndex(block => block.id === progress.last!.blockId), 1)[0];
    next.chapters.push({ ...next.chapters[0], id: 'second-chapter', number: 2, blocks: [moved] });
    const reconciled = reconcileProgress(progress, old, next);
    expect(reconciled.last).toBeNull(); expect(reconciled.annotations[0].status).toBe('orphaned');
    expect(reconciled.anchorWarnings.some(warning => warning.message.includes('moved'))).toBe(true);
    next.chapters.pop();
    expect(reconcileProgress(progress, old, next).anchorWarnings.some(warning => warning.message.includes('removed'))).toBe(true);
  });
  it('does not pretend an old numeric diagram step is an exact step after a diagram changes', () => {
    const old = structuredClone(samplePack); const next = structuredClone(old); next.contentRevision++;
    const diagram = next.chapters[0].blocks.find(block => block.kind === 'diagram')!;
    if (diagram.kind !== 'diagram') throw new Error('Missing fixture');
    const progress = emptyProgress(old.id); progress.diagramPositions[diagram.id] = 2;
    diagram.steps.reverse();
    const reconciled = reconcileProgress(progress, old, next);
    expect(reconciled.diagramPositions[diagram.id]).toBeUndefined();
    expect(reconciled.anchorWarnings.some(warning => warning.kind === 'diagram')).toBe(true);
  });
  it('validates private backup identity and private boundaries', () => {
    const backup = { format: 'handbook-private-backup', version: 1, exportedAt: '2026-10-11T00:00:00Z', packs: [samplePack], progress: [emptyProgress(samplePack.id)], profile: { ...defaultProfile, ageBand: '25-plus', goals: 'PRIVATE' } };
    expect(validateBackup(JSON.stringify(backup)).profile.goals).toBe('PRIVATE');
    expect(JSON.stringify(backup.packs)).not.toContain('PRIVATE');
    expect(() => validateBackup(JSON.stringify({ ...backup, packs: [samplePack, samplePack] }))).toThrow('Duplicate');
    expect(() => validateBackup(JSON.stringify({ ...backup, progress: [{ ...emptyProgress('missing') }] }))).toThrow('mapping');
    expect(() => validateBackup(' '.repeat(64_000_001))).toThrow('64 MB');
  });
});
