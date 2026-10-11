import { useState } from 'react';
import { LIMITS, parseCourseJSON, type CoursePack, type ValidationIssue } from '../../packages/course-pack/src';
import { diffPacks } from '../domain';

export function ImportCourse({ packs, candidate, onCandidate, onInstall, onCancel }: {
  packs: CoursePack[]; candidate: CoursePack | null; onCandidate: (pack: CoursePack | null) => void;
  onInstall: () => Promise<void>; onCancel: () => void;
}) {
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [busy, setBusy] = useState(false);
  async function read(file?: File) {
    onCandidate(null); setIssues([]);
    if (!file) return;
    if (file.size > LIMITS.bytes) { setIssues([{ path: '$', message: 'File exceeds 8 MB. Split the course before importing.' }]); return; }
    const result = parseCourseJSON(await file.text());
    if (!result.ok) { setIssues(result.issues); return; }
    try {
      const old = packs.find(pack => pack.id === result.pack.id);
      if (old && result.pack.contentRevision <= old.contentRevision) throw new Error(`Existing revision is ${old.contentRevision}; use a higher contentRevision for an update.`);
      if (old) diffPacks(old, result.pack);
      onCandidate(result.pack);
    } catch (error) { setIssues([{ path: 'contentRevision', message: error instanceof Error ? error.message : String(error) }]); }
  }
  const old = candidate ? packs.find(pack => pack.id === candidate.id) : null;
  const diff = old && candidate ? diffPacks(old, candidate) : null;
  return <section><h1>{candidate ? 'Review this course' : 'Import a course handbook'}</h1>
    <p className="lead">One course, one JSON file. It stays in this browser; this is not a server upload.</p>
    <label className="file-label">Choose Course Pack JSON<input type="file" accept=".json,application/json" onChange={event => void read(event.target.files?.[0]).catch(error => setIssues([{ path: '$', message: String(error) }]))}/></label>
    {issues.length > 0 && <div className="error" role="alert"><h2>Course not imported</h2><p>Existing courses and private data are untouched.</p><ul>{issues.slice(0, 40).map((issue, i) => <li key={i}><code>{issue.path}</code>: {issue.message}</li>)}</ul>{issues.length > 40 && <p>{issues.length - 40} additional errors. Run the bundled validator for the full report.</p>}</div>}
    {candidate && <section className="import-preview"><h2>{candidate.metadata.title}</h2><p>{candidate.metadata.description}</p><dl><dt>Identity / revision</dt><dd>{candidate.id} / {candidate.contentRevision}</dd><dt>Academic level</dt><dd>{candidate.metadata.educationLevel}; {candidate.metadata.levelInference.confidence} confidence; {candidate.metadata.levelInference.confirmed ? 'confirmed' : 'not confirmed'}</dd><dt>Contents</dt><dd>{candidate.chapters.length} chapters, {candidate.concepts.length} concepts, {candidate.practice.length} original questions</dd></dl>
      <p>{candidate.coverage.summary}</p>
      {candidate.coverage.gaps.map(gap => <p className="warning" key={gap.id}><strong>{gap.status}:</strong> {gap.description}</p>)}
      <h3>Sources and rights</h3><ul>{candidate.sources.map(source => <li key={source.id}>{source.title}, {source.edition} — {source.verification}. {source.rights}</li>)}</ul>
      <p className="small muted">Validation checks structure and references, not factual truth. Review source evidence and rights before sharing.</p>
      {diff && <div className="warning"><h3>Replace revision {old!.contentRevision}</h3><p>{diff.added.length} added, {diff.changed.length} changed, {diff.removed.length} removed blocks; {diff.questionChanges.length} revised questions. Metadata and syllabus will also be replaced.</p><p>Notes, bookmarks and original practice snapshots remain. Changed or missing annotation anchors will be flagged, never guessed.</p>{diff.removed.length > 0 && <details><summary>Removed block anchors</summary><p>{diff.removed.join(', ')}</p></details>}</div>}
      <div className="button-row"><button className="primary" disabled={busy} onClick={async () => { setBusy(true); try { await onInstall(); } catch (error) { setIssues([{ path: '$', message: error instanceof Error ? error.message : String(error) }]); } finally { setBusy(false); } }}>{busy ? 'Installing…' : old ? 'Confirm replace course' : 'Confirm install course'}</button><button onClick={onCancel}>Cancel</button></div>
    </section>}
    <h2>Build a course with your agent</h2><p>Install the portable course-builder skill, give your agent your syllabus and learning materials, review a representative lesson, then import the validated file here.</p>
    <a className="button" href={`${import.meta.env.BASE_URL}downloads/handbook-course-builder.zip`} download>Download course-builder skill</a>
    <p className="small muted">The skill asks optional age or age band, prior knowledge, goals and scaffolding needs. Personal answers belong in a separate private profile, not shared course JSON. No account or API key is required by Handbook.</p>
  </section>;
}
