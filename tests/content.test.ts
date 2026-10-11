import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { validateCoursePack, type Block, type CoursePack, type Question } from '../packages/course-pack/src/index.ts';
import content from '../src/content/kbai.json';
import legacyQuestions from '../src/content/legacy-questions.json';
import legacyFocusMap from '../src/content/legacy-focus-map.json';

const result = validateCoursePack(content);
if (!result.ok) throw new Error(JSON.stringify(result.issues, null, 2));
const pack = result.pack;
const fingerprint = (input: unknown) => createHash('sha256').update(JSON.stringify(input)).digest('hex');
const text = (block: Block): string => {
  switch (block.kind) {
    case 'paragraph': case 'callout': return block.text;
    case 'list': return block.items.join(' ');
    case 'example': return [block.problem, ...block.steps, block.conclusion].join(' ');
    case 'table': return block.rows.flat().join(' ');
    case 'recall': return `${block.prompt} ${block.answer}`;
    case 'diagram': return [block.caption, block.alternative, ...block.nodes.flatMap(node => [node.label, node.detail]), ...block.steps.flatMap(step => [step.title, step.explanation])].join(' ');
  }
};
const words = (value: string) => value.match(/\S+/g)?.length ?? 0;
const unkeyedOptions = (question: Question) => question.options.map(({ text, correct, explanation }) => ({ text, correct, explanation }));
const snapshotView = (question: Question) => ({ id: question.id, prompt: question.prompt, options: unkeyedOptions(question) });
const titles = [
  'Introduction to Knowledge-Based AI', 'Introduction to CS7637', 'Semantic Networks', 'Generate & Test',
  'Means-Ends Analysis', 'Production Systems', 'Frames', 'Learning by Recording Cases', 'Case-Based Reasoning',
  'Incremental Concept Learning', 'Classification', 'Logic', 'Planning', 'Understanding', 'Commonsense Reasoning',
  'Scripts', 'Explanation-Based Learning', 'Analogical Reasoning', 'Version Spaces', 'Constraint Propagation',
  'Configuration', 'Diagnosis', 'Learning by Correcting Mistakes', 'Meta-Reasoning', 'Advanced Topics', 'Wrap-Up',
];
const baselineSizes = [496, 480, 456, 405, 439, 457, 393, 447, 488, 463, 419, 555];
const focusSizes = [15, 15, 16, 15, 15, 15, 15, 15, 16, 15, 15, 18, 16, 15, 15, 15, 15, 15, 16, 15, 15, 16, 15, 16, 18, 15];
const lessonId = (number: number) => `lesson-${String(number).padStart(2, '0')}`;
const requiredTerms = [
  ['Knowledge representation', 'Reaction', 'Deliberation', 'Metacognition', 'Four schools of AI'],
  ['Computational psychometrics', 'Raven’s Progressive Matrices', 'Cognitive connection'],
  ['Semantic network', 'Lexicon', 'Structure', 'Semantics', 'Weighted matching'],
  ['Generate and test', 'Generator', 'Tester', 'Smart generator', 'Smart tester'],
  ['Means-ends analysis', 'State space', 'Difference', 'Operator', 'Problem reduction'],
  ['Production rule', 'Working memory', 'Semantic knowledge', 'Procedural knowledge', 'Episodic knowledge', 'Impasse', 'Chunking'],
  ['Frame', 'Slot', 'Filler', 'Default value', 'Inheritance'],
  ['Case', 'Nearest neighbor', 'Euclidean distance', 'k-dimensional space'],
  ['Case-based reasoning', 'Case retrieval', 'Case adaptation', 'Case evaluation', 'Case storage', 'Discrimination tree'],
  ['Variabilization', 'Drop-link', 'Require-link', 'Forbid-link', 'Enlarge-set', 'Climb-tree', 'Close-interval'],
  ['Classification', 'Axiomatic concept', 'Prototype concept', 'Exemplar concept', 'Establish-and-refine', 'Bottom-up search'],
  ['Knowledge base', 'Inference engine', 'Soundness', 'Completeness', 'Modus ponens', 'Modus tollens', 'Conjunctive normal form', 'Resolution theorem proving', 'Universal quantifier', 'Existential quantifier'],
];

describe('persistent KBAI course pack', () => {
  it('passes the shared contract without app-only or private-input fields', () => {
    expect(validateCoursePack(content).ok).toBe(true);
    expect(pack.id).toBe('kbai');
    expect(pack.schemaVersion).toBe('1.0');
    expect(pack.contentRevision).toBe(5);
    expect(pack.metadata.cover).toBe('cube');
    expect(pack.assets).toEqual([
      { id: 'asset-ebook-2016-pdf', sourceId: 'ebook-2016', mediaType: 'application/pdf', filename: 'kbai-2016-ebook.pdf', sha256: '9f8e120b152fcdee0e1f59ddec10e7c522c26d3578f594fea91ee69e52e1a6ff' },
      { id: 'asset-syllabus-fa26-pdf', sourceId: 'syllabus-fa26', mediaType: 'application/pdf', filename: 'kbai-fall2026-syllabus.pdf', sha256: 'fdf83711dde8bbe1bd51352d3d255c947ce17408f81d61454ff98f2595679d32' },
    ]);
    for (const asset of pack.assets) {
      expect(pack.sources.find(source => source.id === asset.sourceId)?.assetId).toBe(asset.id);
      expect(asset.filename).not.toMatch(/[/\\]/);
    }
    const raw = JSON.stringify(pack);
    expect(raw).not.toMatch(/\.inputs\/|\/Users\/|data:application\/pdf|base64|kbai_ebook\.pdf|CS7637_FA26\.pdf/);
    expect(raw).not.toContain('timestampSeconds');
    expect(pack.sources.find(source => source.id === 'ebook-2016')?.pageCount).toBe(357);
    expect(pack.sources.find(source => source.id === 'syllabus-fa26')?.pageCount).toBe(9);
  });

  it('rejects mismatched source ownership of the fingerprinted PDF declarations', () => {
    const swapped = {
      ...pack,
      sources: pack.sources.map(source => source.id === 'ebook-2016' ? { ...source, assetId: 'asset-syllabus-fa26-pdf' } : source),
    };
    expect(validateCoursePack(swapped).ok).toBe(false);
    const orphan = {
      ...pack,
      sources: pack.sources.map(source => source.id === 'ebook-2016' ? { ...source, assetId: undefined } : source),
    };
    expect(validateCoursePack(orphan).ok).toBe(false);
  });

  it('retains all 26 ordered baseline titles and distinguishes actual depth', () => {
    expect(pack.chapters).toHaveLength(26);
    expect(pack.chapters.map(chapter => chapter.title)).toEqual(titles);
    expect(pack.chapters.map(chapter => chapter.id)).toEqual(Array.from({ length: 26 }, (_, i) => lessonId(i + 1)));
    expect(pack.chapters.slice(0, 12).every(chapter => chapter.depth === 'benchmark')).toBe(true);
    expect(pack.chapters.slice(12).every(chapter => chapter.depth === 'foundation')).toBe(true);
    for (const chapter of pack.chapters) for (const block of chapter.blocks) {
      expect(block.id).toMatch(new RegExp(`^${chapter.id}-${block.kind}-[1-9]\\d*$`));
    }
  });

  it.each(Array.from({ length: 12 }, (_, i) => i))('makes Lesson%s materially deeper than its baseline', index => {
    const chapter = pack.chapters[index];
    const wordCount = words(chapter.blocks.map(text).join(' '));
    // Baseline inventory includes object keys; this is a conservative 2.5× floor.
    expect(wordCount).toBeGreaterThan(baselineSizes[index] * 2.5);
    expect(wordCount).toBeGreaterThan(1500);
    const mechanisms = chapter.blocks.filter(block => block.kind === 'paragraph' && block.citations.some(citation => citation.sourceId === 'ebook-2016' && citation.verification === 'verified'));
    expect(mechanisms.length).toBeGreaterThanOrEqual(3);
    expect(mechanisms.every(block => words(text(block)) >= 75)).toBe(true);
    expect(chapter.blocks.some(block => block.kind === 'list' && block.title === 'Mechanism assumptions and counterexample checks' && block.items.length >= 3)).toBe(true);
    const examples = chapter.blocks.filter(block => block.kind === 'example');
    expect(examples.some(block => block.title.startsWith('Original worked trace:') && block.steps.length >= 4)).toBe(true);
    expect(examples.some(block => block.title.startsWith('Transfer exercise:') && block.steps.length >= 4)).toBe(true);
    for (const term of requiredTerms[index]) {
      const concept = pack.concepts.find(concept => concept.term === term);
      expect(concept, `Missing canonical term ${term}`).toBeDefined();
      expect(concept?.id).toMatch(/^kbai-[a-z0-9-]+$/);
      expect(concept?.citations.some(citation => citation.verification === 'verified' && citation.pdfPage && citation.section)).toBe(true);
      const vocabulary = chapter.blocks.find(block => block.kind === 'table' && block.title === 'Canonical course vocabulary');
      expect(vocabulary?.conceptIds).toContain(concept?.id);
      expect(vocabulary && text(vocabulary)).toContain(term);
    }
  });

  it('contains original declarative diagrams with real dependencies, steps, captions, and alternatives', () => {
    const diagrams = pack.chapters.flatMap(chapter => chapter.blocks.filter(block => block.kind === 'diagram'));
    expect(diagrams).toHaveLength(12);
    const signatures = new Set<string>();
    pack.chapters.slice(0, 12).forEach(chapter => {
      const diagram = chapter.blocks.find(block => block.kind === 'diagram');
      expect(diagram?.kind).toBe('diagram');
      if (!diagram || diagram.kind !== 'diagram') return;
      expect(diagram.nodes.length).toBeGreaterThanOrEqual(5);
      expect(diagram.edges.length).toBeGreaterThanOrEqual(4);
      expect(diagram.steps.length).toBeGreaterThanOrEqual(4);
      expect(words(diagram.caption)).toBeGreaterThan(15);
      expect(words(diagram.alternative)).toBeGreaterThan(20);
      for (const node of diagram.nodes) expect(words(node.detail), `${diagram.id}/${node.id}`).toBeGreaterThanOrEqual(5);
      for (const step of diagram.steps) {
        expect(step.activeNodeIds.length, `${diagram.id}/${step.title}`).toBeGreaterThan(0);
        expect(words(step.explanation), `${diagram.id}/${step.title}`).toBeGreaterThanOrEqual(8);
      }
      expect(diagram.citations.some(citation => citation.sourceId === 'original-handbook')).toBe(true);
      expect(diagram.citations.some(citation => citation.sourceId === 'ebook-2016' && citation.verification === 'verified')).toBe(true);
      signatures.add(JSON.stringify(diagram.nodes.map(node => node.label)));
    });
    expect(signatures.size).toBe(12);
    const logic = diagrams.find(diagram => diagram.id.startsWith('lesson-12-'))!;
    expect(logic.edges.filter(edge => edge.to === 'n7')).toHaveLength(2);
    const learning = diagrams.find(diagram => diagram.id.startsWith('lesson-10-'))!;
    expect(learning.edges.some(edge => edge.label === 'positive label')).toBe(true);
    expect(learning.edges.some(edge => edge.label === 'negative label')).toBe(true);
  });

  it('preserves all 66 original current questions and 78 recall cards byte-for-byte in learner fields', () => {
    expect(pack.practice).toHaveLength(66);
    expect(pack.practice.every(question => question.revision === 3 && question.original)).toBe(true);
    expect(pack.practice.filter(question => question.id.startsWith('e1-'))).toHaveLength(44);
    expect(pack.practice.filter(question => question.id.startsWith('e2-'))).toHaveLength(22);
    expect(fingerprint(pack.practice.map(question => ({
      id: question.id, chapterId: question.chapterId, prompt: question.prompt, options: unkeyedOptions(question),
    })))).toBe('1c821a5cb25d3789d49c49eae37b0f5c1f4dc7c54a420a828c8b2ff6fad636db');
    const cards = pack.chapters.flatMap(chapter => chapter.blocks.filter(block => block.kind === 'recall'));
    expect(cards).toHaveLength(78);
    expect(fingerprint(cards.map(card => ({ id: card.id, prompt: card.prompt, answer: card.answer })))).toBe('e0f7b31b38a8c31316655b3542907213981fbbda79abe0a951156d7cda4168d2');
    pack.chapters.forEach(chapter => expect(chapter.blocks.filter(block => block.kind === 'recall').map(card => card.id)).toEqual([1, 2, 3].map(index => `${chapter.id}-recall-${index}`)));
  });

  it('preserves all historical revision snapshots, including changed answer keys', () => {
    const revisions = legacyQuestions as Record<string, Record<string, Question>>;
    const expectedHashes: Record<string, string> = {
      '1': 'c9e0a11377b25f9a5d3ca0299fe293cb603129397e760f1d982e06b1328241ed',
      '2': 'f340c2e52392c5709611a458724978d55b6ac82242caeea6be73ca547030b2ca',
      '3': '524819093d218e27d9e2e9728323f9a98c7e14897911775d214bdcba24339f67',
    };
    expect(Object.keys(revisions)).toEqual(['1', '2', '3']);
    for (const revision of Object.keys(revisions)) {
      const questions = Object.values(revisions[revision]);
      expect(questions).toHaveLength(66);
      expect(questions.every(question => question.revision === Number(revision))).toBe(true);
      expect(fingerprint(questions.map(snapshotView))).toBe(expectedHashes[revision]);
      const historicalPack: CoursePack = { ...pack, practice: questions };
      expect(validateCoursePack(historicalPack).ok).toBe(true);
    }
    expect(revisions['3']).toEqual(Object.fromEntries(pack.practice.map(question => [question.id, question])));
    expect(revisions['1']['e1-03-a'].options).not.toEqual(revisions['2']['e1-03-a'].options);
    expect(revisions['2']['e2-15-a'].prompt).not.toBe(revisions['3']['e2-15-a'].prompt);
    for (const questions of Object.values(revisions)) for (const question of Object.values(questions)) {
      expect(question.options.map(option => option.id)).toEqual(['option-1', 'option-2', 'option-3', 'option-4', 'option-5']);
    }
  });

  it('maps every original focus position to its own preserved canonical block', () => {
    const map = legacyFocusMap as Record<string, string[]>;
    expect(Object.keys(map)).toHaveLength(26);
    pack.chapters.forEach((chapter, index) => {
      const sequence = map[String(index + 1).padStart(2, '0')];
      expect(sequence).toHaveLength(focusSizes[index]);
      expect(new Set(sequence).size).toBe(sequence.length);
      expect(sequence).toEqual(chapter.blocks.slice(0, sequence.length).map(block => block.id));
      const first = chapter.blocks[0];
      expect(first.kind === 'callout' && first.title).toBe('Preview');
      const final = chapter.blocks[sequence.length - 1];
      expect(final.kind === 'callout' && final.title).toBe('Keep your next step');
      const traces = chapter.blocks.slice(0, sequence.length).filter(block => block.kind === 'example');
      expect(traces.every(block => block.steps.length === 1 && /— step \d+$/.test(block.title))).toBe(true);
      expect(chapter.blocks.slice(0, sequence.length).filter(block => block.kind === 'recall')).toHaveLength(3);
    });
  });

  it('preserves the verified 17-week Fall2026 calendar and both exam contracts', () => {
    expect(pack.syllabus.weeks).toHaveLength(17);
    const expected = [[1, 2], [3, 4], [5, 6], [7, 8], [9], [10, 11], [12], [13, 14], [15, 16], [17, 18], [19, 20], [21, 22], [23, 24], [25], [], [], [26]];
    expect(pack.syllabus.weeks.map(week => week.chapterIds)).toEqual(expected.map(numbers => numbers.map(lessonId)));
    const deliverables = [
      ['assessment-start-survey', 'assessment-syllabus-quiz'], ['assessment-arc-a'], ['assessment-mini-1'],
      ['assessment-hw-1', 'assessment-tic-tac-toe'], ['assessment-mini-2', 'assessment-quarter-survey'],
      ['assessment-arc-b'], ['exam-1', 'assessment-connect-basic'], ['assessment-hw-2'],
      ['assessment-mini-3', 'assessment-mid-survey'], ['assessment-arc-c', 'assessment-connect-extended'],
      ['assessment-mini-4'], ['assessment-hw-3'], ['assessment-mini-5', 'assessment-connect-multi'],
      ['assessment-arc-d'], ['assessment-arc-final'], ['exam-2', 'assessment-connect-hidden'],
      ['assessment-end-survey', 'assessment-cios'],
    ];
    expect(pack.syllabus.weeks.map(week => week.assessmentIds)).toEqual(deliverables);
    pack.syllabus.weeks.forEach((week, index) => {
      const expectedDate = new Date(Date.UTC(2026, 7, 30 + index * 7)).toISOString().slice(0, 10);
      expect(week.notes).toContain(`planning deadline ${expectedDate} at 23:59 AoE`);
      for (const id of week.assessmentIds) {
        expect(pack.syllabus.assessments.find(assessment => assessment.id === id)?.dueAt).toBe(`${expectedDate}T23:59:00-12:00`);
      }
    });
    for (const [number, dueAt, chapters] of [
      [1, '2026-10-11T23:59:00-12:00', Array.from({ length: 12 }, (_, i) => lessonId(i + 1))],
      [2, '2026-12-13T23:59:00-12:00', Array.from({ length: 13 }, (_, i) => lessonId(i + 13))],
    ] as const) {
      const exam = pack.syllabus.assessments.find(assessment => assessment.id === `exam-${number}`)!;
      expect(exam.dueAt).toBe(dueAt);
      expect(exam.timezone).toBe('Etc/GMT+12');
      expect(exam.chapterIds).toEqual(chapters);
      expect(exam.mock).toEqual({ durationMinutes: 90, questionCount: 22, optionCount: 5, minCorrect: 1, maxCorrect: 4 });
      expect(exam.policyIds).toContain('policy-diagnostic');
      expect(exam.citations.map(citation => citation.pdfPage)).toEqual([3, 4]);
    }
    expect(pack.syllabus.assessments.some(assessment => assessment.title.includes('ARC-AGI Milestone A'))).toBe(true);
    expect(pack.syllabus.assessments.some(assessment => /Raven/i.test(assessment.title))).toBe(false);
    expect(pack.syllabus.policies.find(policy => policy.id === 'policy-ai')?.text).toMatch(/AI-generated|AI generate/);
    expect(pack.syllabus.policies.find(policy => policy.id === 'policy-exam')?.text).toMatch(/retain or share exam/);
  });

  it('includes requested exact source anchors and honest limitations', () => {
    for (const [term, start, end] of [
      ['Move-object', 202, 205], ['Move-possession', 202, 205], ['Ingest', 202, 205],
      ['Knowledge gap', 317, 317], ['Learning goal', 317, 317], ['Specific model', 253, 253],
      ['General model', 253, 253], ['Preconditions', 175, 175], ['Postconditions', 175, 175],
    ] as const) {
      const concept = pack.concepts.find(concept => concept.term === term);
      expect(concept?.citations[0]).toMatchObject({ sourceId: 'ebook-2016', pdfPage: start, pdfPageEnd: end, verification: 'verified' });
    }
    expect(pack.coverage.gaps.some(gap => gap.id === 'gap-external-readings' && gap.status === 'unverified')).toBe(true);
    expect(pack.coverage.gaps.some(gap => gap.id === 'gap-foundation-depth' && gap.chapterIds.length === 14)).toBe(true);
    expect(pack.coverage.gaps.some(gap => gap.id === 'gap-calendar-display')).toBe(true);
    const report = readFileSync('docs/kbai-coverage.md', 'utf8');
    expect(report).toContain('357');
    expect(report).toContain('unverified');
    expect(report).toContain('Lessons13–26');
  });
});
