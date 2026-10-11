import type { CoursePack } from '../../packages/course-pack/src';

export const KBAI_COPY = {
  subtitle: 'CS7637 · Fall 2026',
  description: 'How knowledge, reasoning, memory, and learning work together to build intelligent agents.',
  coverage: 'Lessons 1–12 include detailed explanations and worked examples. Later lessons offer shorter introductions; use the ebook to study them in greater depth.',
};
export const DEMO_DESCRIPTION = 'Learn to separate an observation, a hypothesis, and a test. Compare explanations and design a test that can tell them apart.';
export const LEGACY_DEMO_DESCRIPTION = 'Learn to separate an observation, a hypothesis, and a test. A small original course showing the same reading, diagram, and practice tools as imported handbooks.';

// Exact shipped strings make this a stock-copy correction, not a rewrite of learner-authored text.
export const LEGACY_KBAI_COPY = {
  subtitle: 'CS7637 · Fall2026 · a source-grounded course pack',
  description: 'All 26 course lessons and the 17-week Fall2026 plan. Lessons01–12 have expanded benchmark-depth explanations and original diagrams; Lessons13–26 retain the foundation with explicitly limited corrections. Includes 66 original practice questions and 78 preserved recall cards. Not an official course text, assessed submission, or live-exam assistant.',
  coverage: 'Benchmark expansion covers Lessons01–12 with mechanisms, assumptions, original traces, transfer, vocabulary, and 12 original declarative diagrams. All 26 baseline lessons, 17 syllabus weeks, 66 current original questions, and 78 recall cards are preserved. Exact current practice and three historical answer-key revisions are stored independently of private inputs. Later lessons are foundation, not equivalently deep.',
};
export const KBAI_COVERAGE_COPY: Record<string, { previous: string; current: string }> = {
  'gap-foundation-depth': {
    previous: 'Lessons13–26 are preserved foundation, not full benchmark-depth reconstructions. Verified terminology corrections at pp.175, 202–205, 253, and 317 do not close this depth gap.',
    current: 'Lessons 13–26 are shorter introductions. Read the corresponding ebook sections for more examples and detail.',
  },
  'gap-external-readings': {
    previous: 'Linked readings remain bibliographic learning pointers. Full texts, editions, exact reading-page claims, and availability were not independently inspected; do not treat them as verified evidence for the new explanations.',
    current: 'Optional readings are listed for further study. Their full texts and page references have not been checked.',
  },
  'gap-baseline-locators': {
    previous: 'Some preserved baseline guide heading/page pairings point to where a heading begins near a page boundary rather than where its substantive explanation appears (for example drop-link begins at p.123 and is explained at p.124). They are marked unverified; new mechanism blocks cite the inspected substantive ranges.',
    current: 'Some page links lead to a section heading; the explanation may continue on the next page. Unchecked links are marked unverified.',
  },
  'gap-transcripts': {
    previous: 'The ebook itself flags correspondence problems for Lessons02,04,14,25 and incomplete transcripts in Lessons03,05,24,25 on p.3. New explanations use inspectable PDF sections; video-link correspondence, precise timestamps, and missing transcript material were not verified or reconstructed.',
    current: 'Some ebook transcripts are incomplete or differ from the lectures. Video timestamps and missing lecture material have not been checked.',
  },
  'gap-live-administration': {
    previous: 'Authenticated live Canvas pages, assignment rubrics, opening dates, and exam partial-credit formula were not independently reviewed. The supplied Fall2026 syllabus is the snapshot authority; current official announcements can supersede it.',
    current: 'The schedule follows the Fall 2026 syllabus. Check Canvas announcements for current deadlines, rubrics, and exam instructions.',
  },
  'gap-calendar-display': {
    previous: 'The syllabus p.3 weekly table specifies Sunday 23:59 AoE; pp.7–9 render local summary times and the end-of-course survey differs from the week17 planning date. This pack uses the p.3 calendar for planning, flags the discrepancy, and makes no invented reconciliation of the survey deadline.',
    current: 'The syllabus shows conflicting dates for the end-of-course survey. Confirm its deadline in Canvas. Weekly planning follows the syllabus calendar on PDF page 3.',
  },
  'gap-full-first-order-logic': {
    previous: 'Lesson12 includes predicate/quantifier concepts and original scope counterexamples, but not a complete first-order resolution implementation, unification algorithm, Skolemization treatment, or exhaustive proof-search complexity account. The worked refutation is propositional.',
    current: 'The Logic lesson introduces predicates and quantifiers, but its worked resolution proof is propositional. First-order resolution, unification, and Skolemization need further reading.',
  },
};

export function correctStockKBAICopy(pack: CoursePack): CoursePack {
  if (pack.id !== 'kbai' || ![3, 4].includes(pack.contentRevision) || pack.metadata.courseCode !== 'CS7637'
    || pack.provenance.generator !== 'scripts/build-kbai.ts'
    || !pack.sources.some(source => source.id === 'ebook-2016' && source.edition === 'Updated October 6, 2016')) return pack;
  const subtitle = pack.metadata.subtitle === LEGACY_KBAI_COPY.subtitle ? KBAI_COPY.subtitle : pack.metadata.subtitle;
  const description = pack.metadata.description === LEGACY_KBAI_COPY.description ? KBAI_COPY.description : pack.metadata.description;
  const summary = pack.coverage.summary === LEGACY_KBAI_COPY.coverage ? KBAI_COPY.coverage : pack.coverage.summary;
  const gaps = pack.coverage.gaps.map(gap => {
    const replacement = KBAI_COVERAGE_COPY[gap.id];
    return replacement && gap.description === replacement.previous ? { ...gap, description: replacement.current } : gap;
  });
  if (subtitle === pack.metadata.subtitle && description === pack.metadata.description && summary === pack.coverage.summary
    && gaps.every((gap, index) => gap === pack.coverage.gaps[index])) return pack;
  return { ...pack, metadata: { ...pack.metadata, subtitle, description }, coverage: { ...pack.coverage, summary, gaps } };
}

export function correctStockCourseCopy(pack: CoursePack): CoursePack {
  if (pack.id === 'everyday-evidence' && pack.contentRevision === 1
    && pack.provenance.generator === 'Handbook contributors'
    && pack.metadata.description === LEGACY_DEMO_DESCRIPTION) {
    return { ...pack, metadata: { ...pack.metadata, description: DEMO_DESCRIPTION } };
  }
  return correctStockKBAICopy(pack);
}
