import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('installable bundled validator accepts the notes example through the shared app contract and rejects private fields', () => {
  const example = 'skills/handbook-course-builder/assets/example-course.json';
  const cli = 'skills/handbook-course-builder/scripts/validate-course-pack.mjs';
  assert.equal(spawnSync(process.execPath, [cli, example], { encoding: 'utf8' }).status, 0);
  const directory = mkdtempSync(join(tmpdir(), 'handbook-skill-test-'));
  try {
    const pack = JSON.parse(readFileSync(example, 'utf8'));
    pack.profile = { ageBand: '13-15' };
    const file = join(directory, 'invalid.json'); writeFileSync(file, JSON.stringify(pack));
    const result = spawnSync(process.execPath, [cli, file], { encoding: 'utf8' });
    assert.equal(result.status, 1); assert.match(result.stderr, /Unrecognized key.*profile/);
  } finally { rmSync(directory, { recursive: true }); }
});

test('the example demonstrates notes plus a static diagram without a practice or exercise quota', () => {
  const pack = JSON.parse(readFileSync('skills/handbook-course-builder/assets/example-course.json', 'utf8'));
  assert.deepEqual(pack.practice, []);
  assert.deepEqual(pack.syllabus.assessments, []);
  assert.deepEqual(pack.chapters.map(chapter => chapter.id), pack.syllabus.weeks.flatMap(week => week.chapterIds));
  const blocks = pack.chapters.flatMap(chapter => chapter.blocks);
  assert.ok(blocks.some(block => block.kind === 'diagram'), 'Notes must retain an explanatory diagram.');
  assert.ok(blocks.some(block => block.kind === 'callout' && block.title === 'What this lesson adds'));
  assert.ok(blocks.every(block => !['recall', 'example'].includes(block.kind)), 'Exercises are not a required example format.');
  assert.ok(pack.syllabus.weeks[0].notes.split(/\n\s*\n/).length === 2, 'Overview and synthesis frame the lesson explanations.');
  const diagram = blocks.find(block => block.kind === 'diagram');
  assert.equal(diagram.steps.length, 1);
  assert.equal(diagram.nodes[0].label, 'Wet pavement');
  assert.ok(diagram.edges.every(edge => edge.label));
  assert.match(diagram.alternative, /observation[\s\S]*hypotheses[\s\S]*Compare/);
  assert.equal(pack.sources[0].verification, 'original');
  assert.ok(blocks.flatMap(block => block.citations).every(citation => citation.verification === 'unverified'));
});

test('the downloadable skill includes the exact corrected workflow, references, schemas, validator, and example', () => {
  const archive = 'public/downloads/handbook-course-builder.zip';
  const entries = [
    'SKILL.md', 'references/learner-interview.md', 'references/content-quality.md',
    'references/course-pack-format.md', 'assets/course-pack.schema.json',
    'assets/private-profile.schema.json', 'assets/example-course.json',
    'scripts/validate-course-pack.mjs',
  ];
  for (const entry of entries) {
    const shipped = execFileSync('unzip', ['-p', archive, `handbook-course-builder/${entry}`]);
    assert.deepEqual(shipped, readFileSync(`skills/handbook-course-builder/${entry}`), `Stale bundled resource: ${entry}`);
  }
  const directory = mkdtempSync(join(tmpdir(), 'handbook-portable-notes-'));
  try {
    execFileSync('unzip', ['-q', join(process.cwd(), archive), '-d', directory]);
    const cli = join(directory, 'handbook-course-builder/scripts/validate-course-pack.mjs');
    const example = join(directory, 'handbook-course-builder/assets/example-course.json');
    const result = spawnSync(process.execPath, [cli, example], { cwd: directory, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Structural integrity is not factual verification/);
  } finally { rmSync(directory, { recursive: true }); }
});
