import { readFileSync, writeFileSync } from 'node:fs';
import { validateCoursePack, type CoursePack } from '../packages/course-pack/src/index.ts';
import { lessonBlocks, notes, weeklyNotes } from '../src/content/kbai-notes.ts';

const existing = validateCoursePack(JSON.parse(readFileSync('src/content/kbai.json', 'utf8')));
if (!existing.ok) throw new Error(JSON.stringify(existing.issues));
const pack: CoursePack = structuredClone(existing.pack);
pack.contentRevision = 6;
pack.metadata.updatedAt = '2026-10-11T14:00:00Z';
pack.metadata.description = 'Connected weekly course notes on how knowledgeable agents represent situations, reason, learn, and use memory. Read the Fall 2026 topics with source-linked explanations and original concept diagrams.';
pack.chapters = pack.chapters.map(chapter => {
  const lesson = notes[chapter.number];
  if (!lesson) throw new Error(`No source notes for Lesson ${chapter.number}`);
  return { ...chapter, summary: lesson.summary, depth: 'benchmark', blocks: lessonBlocks(chapter, lesson, pack.concepts) };
});
pack.syllabus.weeks = pack.syllabus.weeks.map(week => {
  const learning = weeklyNotes[week.number];
  if (!learning) throw new Error(`No notes for Week ${week.number}`);
  const title = week.chapterIds.map(id => pack.chapters.find(chapter => chapter.id === id)!.title).join(' & ');
  return { ...week, title: title || (week.number === 15 ? 'Consolidation & final project' : 'Revision & Exam 2'), notes: `${learning.overview}\n\n${learning.synthesis}` };
});
pack.coverage.summary = 'All 26 ebook lessons are summarized in the 17 Fall 2026 weeks, with topic explanations and source-linked concept schematics. Weeks without assigned lessons are identified as consolidation or revision. Use the book for its complete examples and the current syllabus for assessed work.';
pack.coverage.gaps = pack.coverage.gaps.filter(gap => !['gap-foundation-depth', 'gap-baseline-locators', 'gap-full-first-order-logic'].includes(gap.id));
pack.provenance.generatedAt = pack.metadata.updatedAt;
pack.provenance.generator = 'Handbook source-grounded weekly notes revision 6';
pack.provenance.method = 'Original summaries authored from the supplied 357-page ebook using column-ordered local reading and printed figures where transcripts are incomplete or damaged; current schedule checked against the supplied nine-page Fall 2026 syllabus. Original schematics and concise representation tables; existing practice questions, recall cards, source declarations and historical snapshots preserved. Replaced explanatory blocks use new IDs so update reconciliation explicitly preserves and flags removed anchors.';
const result = validateCoursePack(pack);
if (!result.ok) throw new Error(JSON.stringify(result.issues, null, 2));
writeFileSync('src/content/kbai.json', `${JSON.stringify(result.pack, null, 2)}\n`);
writeFileSync('public/courses/kbai.json', JSON.stringify(result.pack));
