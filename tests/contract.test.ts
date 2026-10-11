import { describe, expect, it } from 'vitest';
import { coursePackSchema, parseCourseJSON, privateProfileSchema, validateCoursePack, LIMITS } from '../packages/course-pack/src';
import { ageBandFromAge, determineEducationLevel } from '../packages/course-pack/src/learner';
import { samplePack } from '../src/content/sample';
import { z } from 'zod';

describe('shared portable course contract', () => {
  it('accepts an original complete course and publishes a strict schema', () => {
    expect(validateCoursePack(samplePack).ok).toBe(true);
    expect(z.toJSONSchema(coursePackSchema).additionalProperties).toBe(false);
  });
  it.each([
    ['unknown version', (pack: Record<string, unknown>) => { pack.schemaVersion = '2.0'; }],
    ['private age', (pack: Record<string, unknown>) => { pack.age = 16; }],
    ['profile injection', (pack: Record<string, unknown>) => { pack.profile = { ageBand: '13-15' }; }],
    ['unknown block', (pack: Record<string, unknown>) => { const course = pack as unknown as typeof samplePack; course.chapters[0].blocks[0] = { ...course.chapters[0].blocks[0], kind: 'html' } as never; }],
  ])('rejects %s instead of silently stripping it', (_, update) => {
    const pack = structuredClone(samplePack) as unknown as Record<string, unknown>; update(pack);
    expect(validateCoursePack(pack).ok).toBe(false);
  });
  it.each(['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'http://example.com', 'https://user:secret@example.com', 'not-a-url', 'https://[broken'])('rejects unsafe source URL %s', url => {
    const pack = structuredClone(samplePack); pack.sources[0].url = url;
    expect(validateCoursePack(pack).ok).toBe(false);
  });
  it('rejects duplicate identities and dangling references', () => {
    const pack = structuredClone(samplePack);
    pack.concepts[1].id = pack.concepts[0].id; pack.chapters[0].blocks[0].conceptIds = ['missing'];
    const result = validateCoursePack(pack);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some(issue => issue.message.includes('Duplicate ID')) && result.issues.some(issue => issue.message.includes('Unknown reference'))).toBe(true);
  });
  it('rejects concept and chapter prerequisite cycles', () => {
    const pack = structuredClone(samplePack);
    pack.concepts[0].prerequisiteIds = ['controlled-test'];
    pack.chapters[0].prerequisiteIds = [pack.chapters[0].id];
    const result = validateCoursePack(pack); expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.filter(issue => issue.message.includes('cycle'))).toHaveLength(2);
  });
  it('checks graph endpoints, active steps and graph size', () => {
    const pack = structuredClone(samplePack); const diagram = pack.chapters[0].blocks.find(block => block.kind === 'diagram')!;
    if (diagram.kind !== 'diagram') throw new Error('Fixture diagram missing');
    diagram.edges[0].to = 'missing'; diagram.steps[0].activeNodeIds = ['missing'];
    expect(validateCoursePack(pack).ok).toBe(false);
    diagram.nodes = Array.from({ length: LIMITS.nodes + 1 }, (_, i) => ({ id: `node-${i}`, label: 'node', detail: 'detail', column: 0 }));
    expect(validateCoursePack(pack).ok).toBe(false);
  });
  it('checks source page bounds and ordered ranges', () => {
    const pack = structuredClone(samplePack); pack.sources[0].pageCount = 4;
    pack.chapters[0].blocks[0].citations = [{ sourceId: pack.sources[0].id, pdfPage: 5, pdfPageEnd: 3, verification: 'verified' }];
    const result = validateCoursePack(pack); expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some(issue => issue.message.includes('bounds'))).toBe(true);
  });
  it('enforces bidirectional source/asset ownership', () => {
    const pack = structuredClone(samplePack);
    pack.sources.push({ ...pack.sources[0], id: 'other-source', assetId: 'pdf-b' });
    pack.sources[0].assetId = 'pdf-b';
    pack.assets = [{ id: 'pdf-b', sourceId: 'other-source', filename: 'b.pdf', mediaType: 'application/pdf' }];
    const result = validateCoursePack(pack);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.some(issue => issue.message.includes('ownership'))).toBe(true);
    delete pack.sources[0].assetId;
    expect(validateCoursePack(pack).ok).toBe(true);
  });
  it.each(['constructor', 'prototype', '__proto__'])('rejects reserved identity %s throughout the contract', id => {
    expect(validateCoursePack({ ...samplePack, id }).ok).toBe(false);
    const pack = structuredClone(samplePack); pack.chapters[0].blocks[0].id = id;
    expect(validateCoursePack(pack).ok).toBe(false);
    pack.chapters[0].blocks[0].id = 'safe-block'; pack.practice[0].id = id;
    expect(validateCoursePack(pack).ok).toBe(false);
  });
  it('bounds bytes and text and reports malformed JSON', () => {
    expect(parseCourseJSON('{nope}').ok).toBe(false);
    expect(parseCourseJSON('x'.repeat(LIMITS.bytes + 1)).ok).toBe(false);
    const pack = structuredClone(samplePack); pack.metadata.description = 'x'.repeat(LIMITS.text + 1);
    expect(validateCoursePack(pack).ok).toBe(false);
  });
  it('checks table shapes', () => {
    const pack = structuredClone(samplePack);
    pack.chapters[0].blocks.push({ id: 'bad-table', kind: 'table', title: 'Table', columns: ['a', 'b'], rows: [['one']], conceptIds: [], citations: [] });
    expect(validateCoursePack(pack).ok).toBe(false);
  });
});
describe('private learner contract', () => {
  it('allows skipping age and defaults to no study timer', () => {
    const profile = privateProfileSchema.parse({ version: 1 }); expect(profile.ageBand).toBe('prefer-not-to-say'); expect(profile.studyTimers).toBe(false);
  });
  it('accepts an age band but rejects birthdates and exact-age storage', () => {
    expect(privateProfileSchema.parse({ version: 1, ageBand: '16-17' }).ageBand).toBe('16-17');
    expect(privateProfileSchema.safeParse({ version: 1, dateOfBirth: '2010-01-01' }).success).toBe(false);
    expect(privateProfileSchema.safeParse({ version: 1, age: 16 }).success).toBe(false);
  });
  it.each([[null, 'prefer-not-to-say'], [12, 'under-13'], [14, '13-15'], [17, '16-17'], [23, '18-24'], [44, '25-plus']] as const)('maps voluntarily supplied age %s to %s', (age, band) => expect(ageBandFromAge(age)).toBe(band));
  it('refuses invalid age and does not infer capability from it', () => expect(() => ageBandFromAge(-1)).toThrow());
  it('keeps evidence-led inference provisional, handles unknowns and override', () => {
    expect(determineEducationLevel([]).level).toBe('unknown');
    const inferred = determineEducationLevel([{ source: 'Syllabus explicit course level', statedLevel: 'masters', authoritative: true }]);
    expect(inferred.level).toBe('masters'); expect(inferred.confirmed).toBe(false);
    expect(determineEducationLevel([{ source: 'Syllabus', statedLevel: 'high-school', authoritative: true }, { source: 'Catalog', statedLevel: 'bachelors', authoritative: true }]).level).toBe('unknown');
    expect(determineEducationLevel([], 'middle-school')).toMatchObject({ level: 'middle-school', confirmed: true });
  });
});
