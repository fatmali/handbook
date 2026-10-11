import { z } from 'zod';

export const LIMITS = { bytes: 8_000_000, chapters: 150, blocks: 3000, concepts: 1500, questions: 2000, nodes: 80, edges: 160, assets: 30, text: 20_000 } as const;
const id = z.string().regex(/^(?!(?:constructor|prototype)$)[a-zA-Z][a-zA-Z0-9._-]{0,119}$/);
const text = z.string().min(1).max(LIMITS.text);
const short = z.string().min(1).max(300);
const ids = z.array(id).max(1500);
const timestamp = z.iso.datetime({ offset: true });
const url = z.url().regex(/^https:\/\/[^/@?#]+(?:[/?#]|$)/, 'Use an HTTPS URL without credentials');
export const educationLevelSchema = z.enum(['middle-school', 'high-school', 'bachelors', 'masters', 'other', 'unknown']);
export const citationSchema = z.strictObject({
  sourceId: id, section: short.optional(), pdfPage: z.number().int().min(1).max(100_000).optional(),
  pdfPageEnd: z.number().int().min(1).max(100_000).optional(), printedPage: short.optional(),
  timestampSeconds: z.number().min(0).max(86400).optional(), verification: z.enum(['verified', 'unverified']),
});
const citations = z.array(citationSchema).max(30);
const common = { id, conceptIds: ids, citations };
export const blockSchema = z.discriminatedUnion('kind', [
  z.strictObject({ ...common, kind: z.literal('paragraph'), text }),
  z.strictObject({ ...common, kind: z.literal('list'), title: short, ordered: z.boolean(), items: z.array(text).min(1).max(100) }),
  z.strictObject({ ...common, kind: z.literal('callout'), tone: z.enum(['note', 'warning', 'misconception']), title: short, text }),
  z.strictObject({ ...common, kind: z.literal('example'), title: short, problem: text, steps: z.array(text).min(1).max(60), conclusion: text }),
  z.strictObject({ ...common, kind: z.literal('table'), title: short, columns: z.array(short).min(1).max(10), rows: z.array(z.array(text).max(10)).max(100) }),
  z.strictObject({ ...common, kind: z.literal('recall'), prompt: text, answer: text }),
  z.strictObject({
    ...common, kind: z.literal('diagram'), title: short, caption: text, alternative: text,
    nodes: z.array(z.strictObject({ id, label: short, detail: text, column: z.number().int().min(0).max(7) })).min(1).max(LIMITS.nodes),
    edges: z.array(z.strictObject({ from: id, to: id, label: short })).max(LIMITS.edges),
    steps: z.array(z.strictObject({ title: short, explanation: text, activeNodeIds: ids })).min(1).max(80),
  }),
]);
export const coursePackSchema = z.strictObject({
  schemaVersion: z.literal('1.0'), id, contentRevision: z.number().int().min(1),
  metadata: z.strictObject({
    title: short, subtitle: short,
    description: text.describe('Learner-facing course purpose: explain what the learner will study or learn to do. No release metrics, preservation history, implementation terminology or QA reports.'),
    language: z.string().regex(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/),
    educationLevel: educationLevelSchema,
    levelInference: z.strictObject({ evidence: z.array(text).max(20), confidence: z.enum(['high', 'medium', 'low', 'unknown']), confirmed: z.boolean(), unknowns: z.array(text).max(20) }),
    institution: short.optional(), courseCode: short.optional(), cover: z.enum(['cube', 'network', 'leaf']),
    depth: z.enum(['introductory', 'standard', 'deep']), createdAt: timestamp, updatedAt: timestamp,
  }),
  sources: z.array(z.strictObject({
    id, title: short, author: short, edition: short, kind: z.enum(['ebook', 'syllabus', 'lecture', 'reading', 'original']),
    url: url.optional(), pageCount: z.number().int().min(1).max(100_000).optional(),
    assetId: id.optional(), rights: text, verification: z.enum(['verified', 'unverified', 'original']),
  })).min(1).max(200),
  assets: z.array(z.strictObject({ id, sourceId: id, mediaType: z.literal('application/pdf'), sha256: z.string().regex(/^[a-f0-9]{64}$/).optional(), filename: short })).max(LIMITS.assets),
  concepts: z.array(z.strictObject({
    id, term: short, aliases: z.array(short).max(30), notation: short.optional(), definition: text,
    prerequisiteIds: ids, contrastIds: ids, citations,
  })).max(LIMITS.concepts),
  chapters: z.array(z.strictObject({
    id, number: z.number().int().min(1).max(999), title: short, summary: text,
    outcomeIds: ids, prerequisiteIds: ids, depth: z.enum(['benchmark', 'foundation', 'draft']), blocks: z.array(blockSchema).min(1).max(200),
  })).min(1).max(LIMITS.chapters),
  syllabus: z.strictObject({
    outcomes: z.array(z.strictObject({ id, text, conceptIds: ids })).max(200),
    weeks: z.array(z.strictObject({ id, number: z.number().int().min(1).max(100), title: short, chapterIds: ids, assessmentIds: ids, notes: text })).max(100),
    assessments: z.array(z.strictObject({
      id, title: short, kind: z.enum(['exam', 'project', 'assignment', 'reading']), dueAt: timestamp, timezone: short,
      chapterIds: ids, policyIds: ids, description: text,
      mock: z.strictObject({ durationMinutes: z.number().int().min(1).max(360), questionCount: z.number().int().min(1).max(200), optionCount: z.number().int().min(2).max(10), minCorrect: z.number().int().min(1), maxCorrect: z.number().int().min(1) }).optional(), citations,
    })).max(200),
    policies: z.array(z.strictObject({ id, title: short, text, citations })).max(100),
  }),
  practice: z.array(z.strictObject({
    id, revision: z.number().int().min(1), chapterId: id, conceptIds: ids, prompt: text,
    options: z.array(z.strictObject({ id, text, correct: z.boolean(), explanation: text })).min(2).max(10),
    explanation: text, original: z.literal(true), citations,
  })).max(LIMITS.questions),
  coverage: z.strictObject({
    summary: text.describe('Plain-language learning scope and limitations: explain what is covered and where the learner needs original material. Put QA metrics, implementation details and preservation history in provenance or developer reports.'),
    gaps: z.array(z.strictObject({ id, description: text, status: z.enum(['omitted', 'unreadable', 'unverified', 'partial']), chapterIds: ids, sourceIds: ids })).max(200),
  }),
  provenance: z.strictObject({
    generatedAt: timestamp, generator: short, method: text, contentLicense: short, sourceRights: text, originalExplanations: z.literal(true),
  }),
});
export type CoursePack = z.infer<typeof coursePackSchema>;
export type Block = z.infer<typeof blockSchema>;
export type Citation = z.infer<typeof citationSchema>;
export type Question = CoursePack['practice'][number];
export type EducationLevel = z.infer<typeof educationLevelSchema>;
export type ValidationIssue = { path: string; message: string };
export type ValidationResult = { ok: true; pack: CoursePack } | { ok: false; issues: ValidationIssue[] };

export function validateCoursePack(input: unknown): ValidationResult {
  let bytes: number;
  try { bytes = new TextEncoder().encode(JSON.stringify(input)).length; }
  catch { return { ok: false, issues: [{ path: '$', message: 'Expected a serializable JSON document' }] }; }
  if (bytes > LIMITS.bytes) return { ok: false, issues: [{ path: '$', message: `Course exceeds ${LIMITS.bytes} bytes` }] };
  const result = coursePackSchema.safeParse(input);
  if (!result.success) return { ok: false, issues: result.error.issues.map(issue => ({ path: issue.path.join('.') || '$', message: issue.message })) };
  const pack = result.data;
  const issues: ValidationIssue[] = [];
  const fail = (path: string, message: string) => issues.push({ path, message });
  const seen = new Set<string>();
  const unique = (value: string, path: string) => { if (seen.has(value)) fail(path, `Duplicate ID: ${value}`); seen.add(value); };
  unique(pack.id, 'id');
  const ref = (values: string[], allowed: Set<string>, path: string) => {
    if (new Set(values).size !== values.length) fail(path, 'Duplicate references');
    values.forEach(value => { if (!allowed.has(value)) fail(path, `Unknown reference: ${value}`); });
  };
  const sources = new Map(pack.sources.map(source => [source.id, source]));
  const sourceIds = new Set(sources.keys());
  const assetIds = new Set(pack.assets.map(asset => asset.id));
  const conceptIds = new Set(pack.concepts.map(concept => concept.id));
  const chapterIds = new Set(pack.chapters.map(chapter => chapter.id));
  const outcomeIds = new Set(pack.syllabus.outcomes.map(outcome => outcome.id));
  const assessmentIds = new Set(pack.syllabus.assessments.map(assessment => assessment.id));
  const policyIds = new Set(pack.syllabus.policies.map(policy => policy.id));
  const checkCitations = (values: Citation[], path: string) => values.forEach((citation, index) => {
    const at = `${path}.${index}`;
    const source = sources.get(citation.sourceId);
    if (!source) fail(at, `Unknown source: ${citation.sourceId}`);
    if (citation.pdfPageEnd && (!citation.pdfPage || citation.pdfPageEnd < citation.pdfPage)) fail(at, 'Page range must start before it ends');
    if (source?.pageCount && Math.max(citation.pdfPage ?? 0, citation.pdfPageEnd ?? 0) > source.pageCount) fail(at, `Page outside source bounds (${source.pageCount})`);
    if (citation.verification === 'verified' && source?.verification === 'unverified') fail(at, 'An unverified source cannot support a verified citation');
  });
  if (new Date(pack.metadata.updatedAt) < new Date(pack.metadata.createdAt)) fail('metadata.updatedAt', 'Updated date precedes creation date');
  pack.sources.forEach((source, index) => {
    unique(source.id, `sources.${index}.id`);
    if (source.assetId) {
      ref([source.assetId], assetIds, `sources.${index}.assetId`);
      if (pack.assets.find(asset => asset.id === source.assetId)?.sourceId !== source.id) fail(`sources.${index}.assetId`, 'Asset ownership must match its source');
    }
  });
  pack.assets.forEach((asset, index) => {
    unique(asset.id, `assets.${index}.id`); ref([asset.sourceId], sourceIds, `assets.${index}.sourceId`);
    if (sources.get(asset.sourceId)?.assetId !== asset.id) fail(`assets.${index}.sourceId`, 'Source must reference its own asset ID');
  });
  pack.concepts.forEach((concept, index) => {
    const at = `concepts.${index}`;
    unique(concept.id, `${at}.id`); ref(concept.prerequisiteIds, conceptIds, `${at}.prerequisiteIds`); ref(concept.contrastIds, conceptIds, `${at}.contrastIds`); checkCitations(concept.citations, `${at}.citations`);
  });
  let blocks = 0;
  pack.chapters.forEach((chapter, index) => {
    const at = `chapters.${index}`;
    unique(chapter.id, `${at}.id`); ref(chapter.outcomeIds, outcomeIds, `${at}.outcomeIds`); ref(chapter.prerequisiteIds, chapterIds, `${at}.prerequisiteIds`);
    blocks += chapter.blocks.length;
    chapter.blocks.forEach((block, blockIndex) => {
      const path = `${at}.blocks.${blockIndex}`;
      unique(block.id, `${path}.id`); ref(block.conceptIds, conceptIds, `${path}.conceptIds`); checkCitations(block.citations, `${path}.citations`);
      if (block.kind === 'table' && block.rows.some(row => row.length !== block.columns.length)) fail(path, 'Every row must match the column count');
      if (block.kind === 'diagram') {
        const nodes = new Set(block.nodes.map(node => node.id));
        if (nodes.size !== block.nodes.length) fail(path, 'Duplicate diagram node IDs');
        block.edges.forEach(edge => { if (!nodes.has(edge.from) || !nodes.has(edge.to)) fail(path, 'Unknown diagram edge endpoint'); });
        block.steps.forEach(step => ref(step.activeNodeIds, nodes, path));
      }
    });
  });
  if (blocks > LIMITS.blocks) fail('chapters', `At most ${LIMITS.blocks} total blocks`);
  pack.syllabus.outcomes.forEach((outcome, index) => { unique(outcome.id, `syllabus.outcomes.${index}.id`); ref(outcome.conceptIds, conceptIds, `syllabus.outcomes.${index}.conceptIds`); });
  pack.syllabus.weeks.forEach((week, index) => { unique(week.id, `syllabus.weeks.${index}.id`); ref(week.chapterIds, chapterIds, `syllabus.weeks.${index}.chapterIds`); ref(week.assessmentIds, assessmentIds, `syllabus.weeks.${index}.assessmentIds`); });
  pack.syllabus.policies.forEach((policy, index) => { unique(policy.id, `syllabus.policies.${index}.id`); checkCitations(policy.citations, `syllabus.policies.${index}.citations`); });
  pack.syllabus.assessments.forEach((assessment, index) => {
    const at = `syllabus.assessments.${index}`;
    unique(assessment.id, `${at}.id`); ref(assessment.chapterIds, chapterIds, `${at}.chapterIds`); ref(assessment.policyIds, policyIds, `${at}.policyIds`); checkCitations(assessment.citations, `${at}.citations`);
    try { new Intl.DateTimeFormat('en', { timeZone: assessment.timezone }); }
    catch { fail(`${at}.timezone`, 'Use an IANA timezone (UTC-12 is Etc/GMT+12)'); }
    if (assessment.mock && (assessment.mock.minCorrect > assessment.mock.maxCorrect || assessment.mock.maxCorrect >= assessment.mock.optionCount)) fail(`${at}.mock`, 'Correct option bounds must satisfy 1 <= min <= max < option count');
  });
  pack.practice.forEach((question, index) => {
    const at = `practice.${index}`;
    unique(question.id, `${at}.id`); ref([question.chapterId], chapterIds, `${at}.chapterId`); ref(question.conceptIds, conceptIds, `${at}.conceptIds`); checkCitations(question.citations, `${at}.citations`);
    if (new Set(question.options.map(option => option.id)).size !== question.options.length) fail(`${at}.options`, 'Duplicate option IDs');
    const correct = question.options.filter(option => option.correct).length;
    if (!correct || correct === question.options.length) fail(`${at}.options`, 'Provide at least one correct and one incorrect option');
  });
  pack.coverage.gaps.forEach((gap, index) => { unique(gap.id, `coverage.gaps.${index}.id`); ref(gap.chapterIds, chapterIds, `coverage.gaps.${index}.chapterIds`); ref(gap.sourceIds, sourceIds, `coverage.gaps.${index}.sourceIds`); });
  const acyclic = (entries: { id: string; prerequisiteIds: string[] }[], path: string) => {
    const graph = new Map(entries.map(entry => [entry.id, entry.prerequisiteIds]));
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const walk = (key: string): boolean => {
      if (visiting.has(key)) return false;
      if (visited.has(key)) return true;
      visiting.add(key);
      for (const dep of graph.get(key) ?? []) if (!walk(dep)) return false;
      visiting.delete(key); visited.add(key); return true;
    };
    if (entries.some(entry => !walk(entry.id))) fail(path, 'Prerequisite graph contains a cycle');
  };
  acyclic(pack.concepts, 'concepts'); acyclic(pack.chapters, 'chapters');
  return issues.length ? { ok: false, issues } : { ok: true, pack };
}

export function parseCourseJSON(raw: string): ValidationResult {
  if (new TextEncoder().encode(raw).length > LIMITS.bytes) return { ok: false, issues: [{ path: '$', message: 'File exceeds the 8 MB course limit' }] };
  try { return validateCoursePack(JSON.parse(raw)); }
  catch { return { ok: false, issues: [{ path: '$', message: 'Invalid JSON. Export a JSON document, not HTML or a Markdown code fence.' }] }; }
}

export const privateProfileSchema = z.strictObject({
  version: z.literal(1),
  ageBand: z.enum(['under-13', '13-15', '16-17', '18-24', '25-plus', 'prefer-not-to-say']).default('prefer-not-to-say'),
  goals: z.string().max(2000).default(''), priorKnowledge: z.string().max(2000).default(''), scaffolding: z.string().max(2000).default(''),
  depth: z.enum(['introductory', 'standard', 'deep']).default('standard'),
  studyTimers: z.boolean().default(false), timeBudgetMinutes: z.number().int().min(1).max(10080).nullable().default(null),
});
export type PrivateProfile = z.infer<typeof privateProfileSchema>;
export const defaultProfile: PrivateProfile = privateProfileSchema.parse({ version: 1 });
export { determineEducationLevel, ageBandFromAge } from './learner';
