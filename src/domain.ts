import { z } from 'zod';
import { type CoursePack, type Question, coursePackSchema, privateProfileSchema, validateCoursePack } from '../packages/course-pack/src';
export const MAX_COURSES = 32;
export const MAX_NOTE_CHARS = 30_000;

const key = z.string().min(1).max(240).refine(value => !['__proto__', 'constructor', 'prototype'].includes(value));
const stringMap = z.record(key, z.string().max(MAX_NOTE_CHARS));
const numberMap = z.record(key, z.number().int().min(0).max(10000));
const boolMap = z.record(key, z.boolean());
export const annotationSchema = z.strictObject({
  id: key, chapterId: key, blockId: key.nullable(), quote: z.string().max(20000),
  note: z.string().max(20000), status: z.enum(['current', 'changed', 'orphaned']), createdAt: z.number().min(0),
});
export type Annotation = z.infer<typeof annotationSchema>;
const questionSnapshot = coursePackSchema.shape.practice.element;
export const sessionSchema = z.strictObject({
  id: key, mode: z.enum(['practice', 'mock']), assessmentId: key.nullable(), contentRevision: z.number().int().min(1),
  questions: z.array(questionSnapshot).min(1).max(200), answers: z.record(key, z.array(key).max(10)),
  confidence: z.record(key, z.enum(['low', 'medium', 'high', ''])), flagged: boolMap,
  index: z.number().int().min(0).max(199), startedAt: z.number().min(0), deadline: z.number().min(0).nullable(),
  finishedAt: z.number().min(0).nullable(), reason: z.enum(['submitted', 'expired']).nullable(),
}).superRefine((session, ctx) => {
  const issue = (message: string) => ctx.addIssue({ code: 'custom', message });
  if (session.index >= session.questions.length) issue('Question position out of bounds');
  if (new Set(session.questions.map(question => question.id)).size !== session.questions.length) issue('Duplicate question IDs');
  if (session.mode === 'practice' && session.deadline !== null) issue('Untimed practice must not have a deadline');
  if (session.mode === 'mock' && (!session.deadline || session.deadline <= session.startedAt || session.deadline > session.startedAt + 360 * 60000)) issue('Invalid mock deadline');
  for (const [id, answer] of Object.entries(session.answers)) {
    const question = session.questions.find(question => question.id === id);
    if (!question || answer.some(option => !question.options.some(value => value.id === option)) || new Set(answer).size !== answer.length) issue('Answer references unknown or duplicate options');
  }
  for (const id of [...Object.keys(session.flagged), ...Object.keys(session.confidence)]) if (!session.questions.some(question => question.id === id)) issue('Flag or confidence references an unknown question');
  if ((session.finishedAt === null) !== (session.reason === null)) issue('Completion reason and timestamp must agree');
  if (session.finishedAt && session.finishedAt < session.startedAt) issue('Completion precedes start');
});
export type PracticeSession = z.infer<typeof sessionSchema>;
export const progressSchema = z.strictObject({
  version: z.literal(1), courseId: key, revision: z.number().int().min(0),
  notes: stringMap, noteHighlights: z.record(key, z.array(z.strictObject({ start: z.number().int().min(0), end: z.number().int().min(1) })).max(200)),
  annotations: z.array(annotationSchema).max(2000), bookmarks: boolMap, checks: boolMap,
  focusPositions: numberMap, diagramPositions: numberMap, revealed: boolMap,
  anchorWarnings: z.array(z.strictObject({ chapterId: key, blockId: key.nullable(), kind: z.enum(['focus', 'diagram']), message: z.string().max(2000) })).max(2000).default([]),
  recall: z.record(key, z.strictObject({ due: z.number().min(0), rating: z.enum(['again', 'hard', 'good', 'easy']), stage: z.number().int().min(0).max(4) })),
  last: z.strictObject({ chapterId: key, mode: z.enum(['chapter', 'focus']), blockId: key.nullable() }).nullable(),
  active: sessionSchema.nullable(), history: z.array(sessionSchema).max(100),
  updatedAt: z.number().min(0),
}).superRefine((progress, ctx) => {
  if (new TextEncoder().encode(JSON.stringify(progress)).length > 8_000_000) ctx.addIssue({ code: 'custom', message: 'Private course progress exceeds 8 MB. Export notes and old practice history before adding more.' });
  for (const value of [progress.notes, progress.checks, progress.bookmarks, progress.recall, progress.noteHighlights]) if (Object.keys(value).length > 2000) ctx.addIssue({ code: 'custom', message: 'At most 2000 entries per private progress map.' });
  for (const [key, ranges] of Object.entries(progress.noteHighlights)) {
    const text = progress.notes[key] ?? '';
    let previous = -1;
    for (const range of ranges) {
      if (range.start < previous || range.start >= range.end || range.end > text.length) ctx.addIssue({ code: 'custom', message: `Invalid highlight in ${key}` });
      previous = range.end;
    }
  }
});
export type Progress = z.infer<typeof progressSchema>;
export function emptyProgress(courseId: string): Progress {
  return { version: 1, courseId, revision: 0, notes: {}, noteHighlights: {}, annotations: [], bookmarks: {}, checks: {}, focusPositions: {}, diagramPositions: {}, revealed: {}, anchorWarnings: [], recall: {}, last: null, active: null, history: [], updatedAt: Date.now() };
}
export function latestResume(progress: Progress[]) {
  return progress.filter(progress => progress.last).sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null;
}

export function exactMatch(question: Question, selected: string[]): boolean {
  const correct = question.options.filter(option => option.correct).map(option => option.id);
  return correct.length === selected.length && new Set(selected).size === selected.length && correct.every(id => selected.includes(id));
}
export function makeSession(pack: CoursePack, assessmentId: string | null = null, now = Date.now(), mode: 'practice' | 'mock' = assessmentId ? 'mock' : 'practice'): PracticeSession {
  const assessment = assessmentId ? pack.syllabus.assessments.find(value => value.id === assessmentId) : null;
  if (assessmentId && !assessment) throw new Error('Unknown assessment scope.');
  if (mode === 'mock' && !assessment?.mock) throw new Error('This assessment has no mock specification.');
  const pool = pack.practice.filter(question => !assessment || assessment.chapterIds.includes(question.chapterId));
  const spec = mode === 'mock' ? assessment?.mock : null;
  const candidates = pool.filter(question => !spec || (question.options.length === spec.optionCount && question.options.filter(option => option.correct).length >= spec.minCorrect && question.options.filter(option => option.correct).length <= spec.maxCorrect));
  if (!candidates.length || (spec && candidates.length < spec.questionCount)) throw new Error('Not enough original in-scope questions for this practice format.');
  const shuffled = [...candidates];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32 * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return { id: `session-${crypto.randomUUID()}`, mode: spec ? 'mock' : 'practice', assessmentId, contentRevision: pack.contentRevision, questions: structuredClone(shuffled.slice(0, spec?.questionCount ?? 12)), answers: {}, confidence: {}, flagged: {}, index: 0, startedAt: now, deadline: spec ? now + spec.durationMinutes * 60000 : null, finishedAt: null, reason: null };
}
export function finishSession(session: PracticeSession, now = Date.now()): PracticeSession {
  return { ...session, finishedAt: now, reason: session.deadline !== null && now >= session.deadline ? 'expired' : 'submitted' };
}
export function adjustNoteHighlights(previous: string, next: string, ranges: { start: number; end: number }[]) {
  let prefix = 0;
  while (prefix < Math.min(previous.length, next.length) && previous[prefix] === next[prefix]) prefix++;
  let suffix = 0;
  while (suffix < Math.min(previous.length, next.length) - prefix && previous[previous.length - 1 - suffix] === next[next.length - 1 - suffix]) suffix++;
  const oldEnd = previous.length - suffix;
  const change = next.length - previous.length;
  return ranges.flatMap(range => range.end <= prefix ? [range] : range.start >= oldEnd ? [{ start: range.start + change, end: range.end + change }] : []);
}
export type PackDiff = { added: string[]; removed: string[]; changed: string[]; questionChanges: string[] };
export function diffPacks(old: CoursePack, next: CoursePack): PackDiff {
  if (old.id !== next.id) throw new Error('Course identities differ.');
  const previous = new Map(old.chapters.flatMap(chapter => chapter.blocks.map(block => [block.id, block] as const)));
  const current = new Map(next.chapters.flatMap(chapter => chapter.blocks.map(block => [block.id, block] as const)));
  const questionChanges = next.practice.filter(question => {
    const before = old.practice.find(value => value.id === question.id);
    if (!before || JSON.stringify(before) === JSON.stringify(question)) return false;
    if (question.revision <= before.revision) throw new Error(`Changed question ${question.id} must increment its revision.`);
    return true;
  }).map(question => question.id);
  return { added: [...current.keys()].filter(id => !previous.has(id)), removed: [...previous.keys()].filter(id => !current.has(id)), changed: [...current.keys()].filter(id => previous.has(id) && JSON.stringify(previous.get(id)) !== JSON.stringify(current.get(id))), questionChanges };
}
export function reconcileProgress(progress: Progress, previous: CoursePack, next: CoursePack): Progress {
  const diff = diffPacks(previous, next);
  const chapterIds = new Set(next.chapters.map(chapter => chapter.id));
  const owners = new Map(next.chapters.flatMap(chapter => chapter.blocks.map(block => [block.id, chapter.id] as const)));
  const focusPositions: Record<string, number> = {};
  const diagramPositions = { ...progress.diagramPositions };
  const warnings = [...progress.anchorWarnings];
  for (const [chapterId, index] of Object.entries(progress.focusPositions)) {
    const blockId = previous.chapters.find(chapter => chapter.id === chapterId)?.blocks[index]?.id ?? null;
    const newIndex = next.chapters.find(chapter => chapter.id === chapterId)?.blocks.findIndex(block => block.id === blockId) ?? -1;
    if (newIndex >= 0) focusPositions[chapterId] = newIndex;
    else warnings.push({ chapterId, blockId, kind: 'focus', message: blockId && owners.has(blockId) ? 'The saved block moved to a different chapter. Choose a new study location deliberately.' : 'The saved block was removed. Your previous anchor is preserved here; choose a new study location.' });
  }
  for (const blockId of Object.keys(diagramPositions)) {
    if (diff.changed.includes(blockId) || diff.removed.includes(blockId)) {
      delete diagramPositions[blockId];
      const chapterId = previous.chapters.find(chapter => chapter.blocks.some(block => block.id === blockId))?.id ?? progress.last?.chapterId ?? previous.chapters[0].id;
      warnings.push({ chapterId, blockId, kind: 'diagram', message: 'This diagram changed or was removed. The previous trace index is not treated as an exact new step; review the revised diagram from its beginning.' });
    }
  }
  const last = progress.last;
  const lastValid = last && chapterIds.has(last.chapterId) && (!last.blockId || owners.get(last.blockId) === last.chapterId);
  if (last && !lastValid && !warnings.some(warning => warning.kind === 'focus' && warning.chapterId === last.chapterId)) warnings.push({ chapterId: last.chapterId, blockId: last.blockId, kind: 'focus', message: 'Your saved resume anchor is no longer in this chapter. Choose a new location.' });
  return {
    ...progress, focusPositions, diagramPositions, anchorWarnings: warnings,
    annotations: progress.annotations.map(annotation => ({
      ...annotation, status: !chapterIds.has(annotation.chapterId) || (annotation.blockId && owners.get(annotation.blockId) !== annotation.chapterId) ? 'orphaned' : annotation.blockId && diff.changed.includes(annotation.blockId) ? 'changed' : annotation.status,
    })),
    last: lastValid ? last : null,
  };
}
export const backupSchema = z.strictObject({
  format: z.literal('handbook-private-backup'), version: z.literal(1), exportedAt: z.iso.datetime({ offset: true }),
  packs: z.array(z.unknown()).max(MAX_COURSES), progress: z.array(progressSchema).max(MAX_COURSES), profile: privateProfileSchema,
  legacy: z.unknown().optional(),
});
export function validateBackup(raw: string) {
  if (new TextEncoder().encode(raw).length > 64_000_000) throw new Error('Private backup exceeds 64 MB.');
  const result = backupSchema.parse(JSON.parse(raw));
  const packs = result.packs.map(value => {
    const result = validateCoursePack(value);
    if (!result.ok) throw new Error(result.issues.map(issue => `${issue.path}: ${issue.message}`).join('\n'));
    return result.pack;
  });
  if (new Set(packs.map(pack => pack.id)).size !== packs.length) throw new Error('Duplicate courses in backup.');
  if (new Set(result.progress.map(progress => progress.courseId)).size !== result.progress.length || result.progress.some(progress => !packs.some(pack => pack.id === progress.courseId))) throw new Error('Invalid progress/course mapping.');
  return { ...result, packs };
}
