import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const read = relative => readFile(new URL(relative, root), 'utf8');
const skill = await read('SKILL.md');
const interview = await read('references/learner-interview.md');
const quality = await read('references/content-quality.md');
const contract = await read('references/course-pack-format.md');

test('course introductions use learner-facing purpose, with QA detail kept out of metadata', () => {
  assert.match(quality, /metadata\.description[\s\S]*?what the learner will study/i);
  assert.match(quality, /coverage\.summary[\s\S]*?original material/i);
  assert.match(quality, /QA metrics, preservation history[\s\S]*?provenance/i);
  assert.match(skill, /course introduction for the learner/i);
  assert.match(contract, /metadata\.description[\s\S]*?not release\s+notes/i);
});

test('skill metadata meets the portable Agent Skills naming and size limits', () => {
  const frontmatter = skill.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(frontmatter, 'SKILL.md must start with YAML frontmatter.');
  const name = frontmatter[1].match(/^name:\s*(.+)$/m)?.[1];
  const description = frontmatter[1].match(/^description:\s*(.+)$/m)?.[1];
  assert.equal(name, 'handbook-course-builder');
  assert.match(name, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  assert.ok(name.length <= 64);
  assert.ok(description && description.length <= 1024);
  assert.match(frontmatter[1], /version: "1\.1\.0"/);
  assert.match(description, /course-content notes plus explanatory diagrams/);
  assert.ok(skill.split('\n').length < 500, 'Keep the main skill instructions bounded.');
});

test('the main workflow defaults to substantive source notes and keeps diagrams, not mandatory exercises', () => {
  const preview = skill.split('## 4. Preview one complete week of notes')[1]?.split('## 5.')[0];
  assert.ok(preview, 'A complete representative week must be reviewed before batching.');
  assert.match(preview, /read the complete assigned source/i);
  assert.match(preview, /substantive prose and diagram/);
  assert.match(preview, /teaching order[\s\S]*continuous prose/);
  assert.match(preview, /original inline diagram/);
  assert.match(preview, /brief synthesis/);
  assert.match(preview, /not required[\s\S]*only when requested/);
  assert.doesNotMatch(preview, /- A step-by-step worked example\.|- An independent attempt and feedback\.|- A retrieval question/);
  assert.match(skill, /default pack may have `practice: \[\]`/);
  assert.match(skill, /Keep explanatory diagrams in the course notes/);
  assert.match(quality, /Include a useful selection of explanatory diagrams across the notes/);
  assert.doesNotMatch(skill, /- Create original practice mapped|- Give an example and a boundary/);
});

test('source fidelity requires real reading, figure inspection, source order, and honest later-lesson coverage', () => {
  assert.match(skill, /Read the actual supplied material/);
  assert.match(skill, /multi-column pages in column order[\s\S]*inspect actual figures/);
  assert.match(skill, /Existing generated notes are not evidence/);
  assert.match(skill, /real source heading and substantive page range/);
  assert.match(skill, /stronger algorithm[\s\S]*as if this source taught it/);
  assert.match(skill, /Read the finished notes against the actual source/);
  assert.match(skill, /Do not leave later[\s\S]*generic foundation filler/);
  assert.match(quality, /Counts|counts|quotas/);
  assert.match(quality, /source's example[\s\S]*understanding/);
});

test('weekly notes follow actual assignments and the existing renderer rather than invented schema or administration', () => {
  assert.match(skill, /actual syllabus week/);
  assert.match(skill, /Weeks with no new lessons[\s\S]*do not invent a chapter/);
  assert.match(skill, /Without a schedule[\s\S]*do not invent weekly dates/);
  assert.match(contract, /syllabus\.weeks\[\]\.chapterIds/);
  assert.match(contract, /syllabus\.weeks\[\]\.notes[\s\S]*blank[\s\S]*closing weekly synthesis/);
  assert.match(contract, /kind: "callout"[\s\S]*tone: "note"[\s\S]*ordinary headings and prose/);
  assert.match(contract, /single static|static diagram[\s\S]*one `steps` entry/);
  assert.match(contract, /#\/weekly\/<courseId>\/<weekId>/);
  assert.match(contract, /Use `practice: \[\]` when practice was not requested/);
});

test('source-notes updates preserve private data and flag changed or orphaned anchors', () => {
  assert.match(skill, /Keep existing question banks, recall IDs and historical snapshots[\s\S]*unchanged/);
  assert.match(skill, /Do not reuse an old block ID for unrelated replacement prose/);
  assert.match(skill, /changed or orphaned quotations and reading positions/);
  assert.match(skill, /Never automatically overwrite a custom or installed course/);
  assert.match(contract, /Preserve the old annotation in private state/);
});

test('all instruction reference links resolve within the package', async () => {
  const links = [...skill.matchAll(/\]\((references\/[^)]+)\)/g)].map(match => match[1]);
  assert.deepEqual(new Set(links), new Set([
    'references/learner-interview.md',
    'references/content-quality.md',
    'references/course-pack-format.md'
  ]));
  for (const link of links) {
    assert.ok(!link.includes('..'));
    assert.ok((await stat(new URL(link, root))).isFile(), `Missing reference: ${link}`);
  }
});

test('age disclosure is optional and does not require a birthdate or exact value', () => {
  assert.match(interview, /Would you like to share your age or an age band[\s\S]*?You can skip this/);
  assert.match(interview, /Prefer not to say/);
  assert.match(interview, /do not infer an exact number/i);
  assert.match(interview, /without requesting a birthdate/i);
  assert.match(interview, /If skipped, leave age absent/);
});

test('course level includes school and degree levels but excludes age as evidence', () => {
  for (const level of ['Middle school', 'High school', "Bachelor's / undergraduate", "Master's / graduate"]) {
    assert.ok(interview.includes(level), `Missing interview choice: ${level}`);
  }
  assert.match(interview, /An explicit course or syllabus statement/);
  assert.match(interview, /Institutional catalog designation/);
  assert.match(interview, /Required prerequisites and intended learning outcomes/);
  assert.match(interview, /Do not infer level from:\s*\n\s*-\s*Age or appearance/);
  assert.match(interview, /use unknown/i);
  assert.match(interview, /You can override that/);
});

test('learner profiles require consent and are separate from shared course content', () => {
  assert.match(interview, /Private profile consent/);
  assert.match(interview, /Default to no private profile when consent is absent/);
  assert.match(skill, /Do not put age, accessibility preferences, personal performance, or time logs in a course pack/);
  assert.match(contract, /Do not add these to a shared course:[\s\S]*Exact age[\s\S]*Answers, confidence/);
  assert.match(interview, /Do not require disclosure of ADHD/);
});

test('untimed study remains a real choice independent of timed assessment', () => {
  assert.match(interview, /Untimed, with no break cues/);
  assert.match(interview, /Study timing and an assessment's official timed format are separate settings/);
  assert.match(skill, /keep timers off/);
  assert.match(quality, /Do not force study timers, reminders, streaks/);
});

test('source alignment and instructional meaning are not reduced to structural validation', () => {
  assert.match(quality, /canonical source term/);
  assert.match(quality, /PDF viewer page numbers and printed page numbers are different locator types/);
  assert.match(quality, /A useful diagram must have a teaching purpose and a textual alternative/);
  assert.match(quality, /Do not count a course-cover illustration as an explanatory diagram/);
  assert.match(skill, /Passing a structural validator does not prove factual accuracy/);
  assert.match(skill, /Record missing or unreadable material rather than reconstructing it\s+from guesses/);
});

test('the skill does not pretend generation is browser installation', () => {
  assert.match(skill, /The skill cannot directly write into a remote browser's IndexedDB or localStorage/);
  assert.match(contract, /Generating a file does not mean it has been installed/);
  assert.match(contract, /Installing or replacing data needs a clear confirmation/);
  assert.match(contract, /For a failed import, keep existing courses and progress unchanged/);
});

test('missing executable integration is disclosed instead of reported as success', () => {
  assert.match(skill, /The executable validator and schema must be present in the released skill bundle/);
  assert.match(skill, /If either is unavailable, stop at a clearly labeled draft/);
  assert.match(contract, /Do not substitute this document for that schema/);
  assert.match(contract, /Do not describe this skill as fully packaged, tested, or import-compatible until/);
});

test('input restrictions, copyright and assessed-work boundaries remain explicit', () => {
  assert.match(skill, /Respect file restrictions and tool denials; do not bypass them/);
  assert.match(skill, /Do not upload source files to external AI, OCR, hosting, or storage services without explicit authorization/);
  assert.match(quality, /software's open-source license and the source material's rights are different/);
  assert.match(quality, /Do not copy complete chapters[\s\S]*real exam questions/);
  assert.match(skill, /Do not reproduce copyrighted chapters, lecture transcripts, textbook figures, or assessed solutions/);
});
