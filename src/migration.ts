import { z } from 'zod';
import { type CoursePack, coursePackSchema, validateCoursePack } from '../packages/course-pack/src';
import { type Progress, type PracticeSession, emptyProgress, sessionSchema, MAX_NOTE_CHARS } from './domain';
import questionBanks from './content/legacy-questions.json';
import focusMap from './content/legacy-focus-map.json';

export const LEGACY_KEY = 'kbai-study-companion-v1';
const stringMap = z.record(z.string(), z.string().max(MAX_NOTE_CHARS));
const legacySchema = z.strictObject({
  version: z.literal(1), updatedAt: z.number().min(0),
  preferences: z.object({ theme: z.enum(['light', 'dark', 'system']), lesson: z.string(), screen: z.string() }),
  notes: stringMap, drafts: stringMap, highlights: z.record(z.string(), z.array(z.strictObject({ start: z.number().int().min(0), end: z.number().int().min(1) })).max(200)).optional(),
  tasks: z.record(z.string(), z.boolean()), objectives: z.record(z.string(), z.boolean()), readDone: z.record(z.string(), z.boolean()),
  reviews: z.record(z.string(), z.object({ due: z.number().min(0), rating: z.enum(['again', 'hard', 'good', 'easy']), stage: z.number().int().min(0).max(4) })),
  reviewLog: z.array(z.unknown()).max(1000), attempts: z.array(z.unknown()).max(100), active: z.unknown().nullable(),
  focus: z.object({ lesson: z.string(), phase: z.string(), positions: z.record(z.string(), z.number().int().min(0).max(100)), completed: z.record(z.string(), z.boolean()), revealed: z.record(z.string(), z.boolean()) }).optional(),
  handbook: z.object({
    version: z.literal(1), activeCourse: z.string(),
    last: z.object({ course: z.string(), chapter: z.string(), mode: z.enum(['chapter', 'focus']) }),
    courses: z.array(z.strictObject({
      id: z.string().regex(/^c-[a-f0-9-]{12,40}$/), title: z.string().min(1).max(120), code: z.string().max(30),
      institution: z.string().max(100), term: z.string().max(60), description: z.string().max(1000), sourceUrl: z.string().max(2000),
      chapters: z.array(z.strictObject({ id: z.string().regex(/^p-[a-f0-9-]{12,40}$/), title: z.string().min(1).max(150), content: z.string().min(1).max(30000), sourceUrl: z.string().max(2000) })).max(100),
    })).max(30),
    bookmarks: z.record(z.string(), z.boolean()),
    sessions: z.record(z.string(), z.object({ index: z.number().int().min(0), phase: z.string() })),
  }).optional(),
});
const legacySessionSchema = z.object({
  id: z.string().optional(), mode: z.enum(['diagnostic', 'mock', 'drill']), exam: z.number().int().min(1).max(2),
  bankRevision: z.number().int().min(1).max(3).optional(), questionIds: z.array(z.string()).min(1).max(44),
  answers: z.record(z.string(), z.array(z.number().int().min(0).max(4))),
  confidence: z.record(z.string(), z.enum(['low', 'medium', 'high', ''])), flagged: z.record(z.string(), z.boolean()),
  index: z.number().int().min(0).optional(), startedAt: z.number().min(0), deadline: z.number().min(0).nullable().optional(),
  endedAt: z.number().min(0).optional(), reason: z.enum(['submitted', 'expired']).optional(),
  optionOrder: z.record(z.string(), z.array(z.number().int().min(0).max(4))).optional(),
});
function migrateSession(value: unknown): PracticeSession {
  const old = legacySessionSchema.parse(value);
  const banks: unknown = questionBanks;
  const bank = z.record(z.string(), z.record(z.string(), z.unknown())).parse(banks)[String(old.bankRevision ?? 1)];
  if (!bank) throw new Error(`Legacy question revision ${old.bankRevision ?? 1} is unavailable. The original backup is retained.`);
  const questions = old.questionIds.map(id => {
    if (!bank[id]) throw new Error(`Legacy question ${id} cannot be mapped. The original backup is retained.`);
    const question = coursePackSchema.shape.practice.element.parse(bank[id]);
    const order = old.optionOrder?.[id];
    if (order) {
      if (order.length !== question.options.length || new Set(order).size !== order.length || order.some(index => index >= question.options.length)) throw new Error(`Legacy option ordering for ${id} is invalid. Original state is retained.`);
      return { ...question, options: order.map(index => question.options[index]) };
    }
    return question;
  });
  const optionIds = (questionId: string) => {
    const question = z.object({ options: z.array(z.object({ id: z.string() })) }).parse(bank[questionId]);
    return question.options.map(option => option.id);
  };
  const candidate = {
    id: old.id ?? `legacy-session-${old.startedAt}`, mode: old.mode === 'mock' ? 'mock' : 'practice',
    assessmentId: `exam-${old.exam}`, contentRevision: 1, questions,
    answers: Object.fromEntries(Object.entries(old.answers).map(([id, values]) => [id, values.map(index => optionIds(id)[index])])),
    confidence: old.confidence, flagged: old.flagged, index: old.index ?? 0,
    startedAt: old.startedAt, deadline: old.mode === 'mock' ? old.startedAt + 90 * 60000 : null,
    finishedAt: old.endedAt ?? null, reason: old.reason ?? null,
  };
  return sessionSchema.parse(candidate);
}
function noteKey(key: string) { return key.startsWith('lesson:') ? `chapter:lesson-${key.slice(7)}` : key; }
export function migrateLegacy(raw: string, kbai: CoursePack): { packs: CoursePack[]; progress: Progress[]; theme: string; warnings: string[] } {
  if (!kbai) throw new Error('The KBAI seed is required for legacy migration.');
  if (new TextEncoder().encode(raw).length > 5 * 1024 * 1024) throw new Error('Legacy state exceeds 5 MB. The original storage key is retained; export from the legacy app first.');
  const legacy = legacySchema.parse(JSON.parse(raw));
  const warnings = ['Legacy data was backed up transactionally. Weekly checks, review logs, and historical view settings remain available in the private legacy archive; no historical results were regraded.'];
  const progress = emptyProgress('kbai');
  progress.notes = Object.fromEntries(Object.entries(legacy.notes).map(([key, value]) => [noteKey(key), value]));
  for (const [key, value] of Object.entries(legacy.drafts)) progress.notes[`recall:${key}`] = value;
  for (const [key, ranges] of Object.entries(legacy.highlights ?? {})) {
    const nextKey = key.startsWith('note:') ? noteKey(key.slice(5)) : key.startsWith('draft:') ? `recall:${key.slice(6)}` : key;
    const text = progress.notes[nextKey];
    if (text === undefined || ranges.some(range => range.end > text.length || range.start >= range.end)) throw new Error(`Legacy highlight ${key} is invalid. Original storage is unchanged.`);
    progress.noteHighlights[nextKey] = ranges;
  }
  progress.checks = { ...legacy.tasks, ...Object.fromEntries(Object.entries(legacy.objectives).map(([key, value]) => [`objective:${key}`, value])), ...Object.fromEntries(Object.entries(legacy.readDone).map(([key, value]) => [`reading:${key}`, value])) };
  progress.recall = Object.fromEntries(Object.entries(legacy.reviews).map(([key, value]) => [key, { due: value.due, rating: value.rating, stage: value.stage }]));
  progress.history = legacy.attempts.map(migrateSession);
  if (legacy.active) progress.active = migrateSession(legacy.active);
  for (const [key, value] of Object.entries(legacy.focus?.revealed ?? {})) progress.revealed[key] = value;
  const mapping = z.record(z.string(), z.array(z.string().nullable())).parse(focusMap);
  for (const [lesson, index] of Object.entries(legacy.focus?.positions ?? {})) {
    const blockId = mapping[lesson]?.[index];
    const chapter = kbai.chapters.find(chapter => chapter.id === `lesson-${lesson}`);
    const position = chapter?.blocks.findIndex(block => block.id === blockId) ?? -1;
    if (position >= 0) progress.focusPositions[`lesson-${lesson}`] = position;
    else warnings.push(`Legacy L${lesson} step ${index + 1} is retained in the archive but has no exact new anchor. Resume this lesson manually; no approximate match was invented.`);
  }
  const focusLesson = legacy.focus?.lesson ?? legacy.preferences.lesson;
  const chapterId = `lesson-${focusLesson}`;
  const chapter = kbai.chapters.find(chapter => chapter.id === chapterId);
  if (chapter) progress.last = { chapterId, mode: legacy.handbook?.last.mode ?? 'focus', blockId: chapter.blocks[progress.focusPositions[chapterId] ?? 0]?.id ?? null };
  const packs: CoursePack[] = [];
  const progresses = [progress];
  for (const old of legacy.handbook?.courses ?? []) {
    if (!old.chapters.length) { warnings.push(`Empty legacy course “${old.title}” remains in the private archive; add a chapter there before importing it.`); continue; }
    const createdAt = new Date(legacy.updatedAt).toISOString();
    const pack: CoursePack = {
      schemaVersion: '1.0', id: old.id, contentRevision: 1,
      metadata: { title: old.title, subtitle: old.term || 'Imported private course', description: old.description || 'A personal course migrated from Handbook.', language: 'en', educationLevel: 'unknown', levelInference: { evidence: [], confidence: 'unknown', confirmed: false, unknowns: ['Legacy course had no verified academic level.'] }, ...(old.institution ? { institution: old.institution } : {}), ...(old.code ? { courseCode: old.code } : {}), cover: 'network', depth: 'standard', createdAt, updatedAt: createdAt },
      sources: [{ id: `${old.id}-source`, title: 'Legacy learner-authored notes', author: 'Learner', edition: 'Legacy v1', kind: 'original', rights: 'Private learner-authored content; review rights before sharing.', verification: 'original' }],
      concepts: [], assets: [],
      chapters: old.chapters.map((chapter, index) => ({
        id: chapter.id, number: index + 1, title: chapter.title, summary: 'Migrated original notes. External source alignment has not been verified.',
        outcomeIds: [], prerequisiteIds: [], depth: 'draft',
        blocks: chapter.content.split(/\n\s*\n/).flatMap((text, index) => {
          if (!text.trim()) return [];
          const parts = text.match(/[\s\S]{1,20000}/g) ?? [];
          return parts.map((part, partIndex) => ({ id: `${chapter.id}-text-${index}-${partIndex}`, kind: 'paragraph' as const, text: part, conceptIds: [], citations: [] }));
        }),
      })),
      syllabus: { outcomes: [], weeks: [], assessments: [], policies: [] }, practice: [],
      coverage: { summary: 'Preserved legacy text; no source verification or inferred deadlines.', gaps: [{ id: `${old.id}-gap`, description: 'Legacy source links are retained in the private archive, not silently trusted as course evidence.', status: 'unverified', chapterIds: old.chapters.map(chapter => chapter.id), sourceIds: [`${old.id}-source`] }] },
      provenance: { generatedAt: createdAt, generator: 'Handbook legacy migration', method: 'Lossless text conversion; no facts added.', contentLicense: 'Private; learner controls sharing', sourceRights: 'Legacy notes may refer to third-party sources.', originalExplanations: true },
    };
    const result = validateCoursePack(pack);
    if (!result.ok) throw new Error(`Legacy course ${old.title}: ${result.issues.map(issue => `${issue.path}: ${issue.message}`).join('; ')}`);
    const personal = emptyProgress(old.id);
    for (const chapter of old.chapters) {
      const oldKey = `chapter:${old.id}:${chapter.id}`;
      const newKey = `chapter:${chapter.id}`;
      if (legacy.notes[oldKey]) personal.notes[newKey] = legacy.notes[oldKey];
      if (legacy.highlights?.[`note:${oldKey}`]) personal.noteHighlights[newKey] = legacy.highlights[`note:${oldKey}`];
      delete progress.notes[oldKey]; delete progress.noteHighlights[oldKey];
      const session = legacy.handbook?.sessions[`${old.id}:${chapter.id}`];
      if (session) personal.focusPositions[chapter.id] = session.index;
    }
    const last = legacy.handbook?.last;
    if (last?.course === old.id) personal.last = { chapterId: last.chapter, mode: last.mode, blockId: pack.chapters.find(chapter => chapter.id === last.chapter)?.blocks[personal.focusPositions[last.chapter] ?? 0]?.id ?? null };
    packs.push(pack); progresses.push(personal);
  }
  for (const [key, marked] of Object.entries(legacy.handbook?.bookmarks ?? {})) {
    const [course, chapter] = key.split(':');
    const target = progresses.find(progress => progress.courseId === course);
    if (target) target.bookmarks[course === 'kbai' ? `lesson-${chapter}` : chapter] = marked;
  }
  return { packs, progress: progresses, theme: legacy.preferences.theme, warnings };
}
